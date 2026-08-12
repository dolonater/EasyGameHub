//! 直播弹幕 WebSocket 客户端。
//!
//! 连接 B 站直播弹幕服务器：二进制帧协议（`protocol` 模块）、30 秒心跳（`heartbeat` 模块）、
//! `DANMU_MSG`/`SEND_GIFT`/`SUPER_CHAT_MESSAGE` 等 cmd 分发，以及断线自动重连。

pub mod heartbeat;
pub mod protocol;

use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use tokio::sync::{mpsc, watch};
use tokio_tungstenite::WebSocketStream;
use tokio_tungstenite::tungstenite::Message;

use protocol::{OP_AUTH_REPLY, OP_HEARTBEAT_REPLY, OP_NOTIFY, decode_packets, parse_cmds};

pub use protocol::{Packet, ProtocolError};

/// 一条已解析的直播弹幕消息。
#[derive(Debug, Clone)]
pub struct LiveWsMessage {
    /// 命令名（如 `DANMU_MSG`），后缀已被剥离。
    pub cmd: String,
    /// 命令原始 JSON。
    pub data: Value,
}

/// 断开重连最终失败时对外发送的信号。
pub const CMD_CONNECTION_LOST: &str = "CONNECTION_LOST";

/// WebSocket 错误。
#[derive(Debug, thiserror::Error)]
pub enum LiveWsError {
    #[error("websocket error: {0}")]
    Ws(String),
    #[error("auth timeout")]
    AuthTimeout,
    #[error("auth rejected: {0}")]
    AuthRejected(String),
    #[error("connection closed")]
    Closed,
}

impl From<tokio_tungstenite::tungstenite::Error> for LiveWsError {
    fn from(error: tokio_tungstenite::tungstenite::Error) -> Self {
        LiveWsError::Ws(error.to_string())
    }
}

/// 连接句柄：调用 `shutdown` 停止后台任务。
#[derive(Debug)]
pub struct LiveWsHandle {
    shutdown: watch::Sender<bool>,
}

impl LiveWsHandle {
    /// 请求关闭连接与后台任务。
    pub fn shutdown(&self) {
        let _ = self.shutdown.send(true);
    }
}

/// 直播弹幕 WebSocket 客户端。
#[derive(Debug, Default, Clone, Copy)]
pub struct LiveWsClient;

impl LiveWsClient {
    /// 连接直播弹幕服务器（心跳间隔 30 秒）。`uid` 为登录用户 mid（游客传 0）。
    pub async fn connect(
        host: &str,
        wss_port: u16,
        token: &str,
        room_id: u64,
        uid: u64,
    ) -> Result<(mpsc::Receiver<LiveWsMessage>, LiveWsHandle), LiveWsError> {
        Self::connect_with_heartbeat(
            host,
            wss_port,
            token,
            room_id,
            uid,
            heartbeat::HEARTBEAT_INTERVAL,
        )
        .await
    }

    /// 连接直播弹幕服务器（可指定心跳间隔，测试用）。
    pub async fn connect_with_heartbeat(
        host: &str,
        wss_port: u16,
        token: &str,
        room_id: u64,
        uid: u64,
        heartbeat_interval: Duration,
    ) -> Result<(mpsc::Receiver<LiveWsMessage>, LiveWsHandle), LiveWsError> {
        Self::connect_url(
            &format!("wss://{host}:{wss_port}/sub"),
            room_id,
            token,
            uid,
            heartbeat_interval,
        )
        .await
    }

    /// 按完整 URL 连接（测试可用 `ws://` 本地 mock）。
    async fn connect_url(
        url: &str,
        room_id: u64,
        token: &str,
        uid: u64,
        heartbeat_interval: Duration,
    ) -> Result<(mpsc::Receiver<LiveWsMessage>, LiveWsHandle), LiveWsError> {
        let ws = connect_and_auth(url, room_id, token, uid).await?;
        let url = url.to_string();

        let (tx, rx) = mpsc::channel(512);
        let (shutdown_tx, shutdown_rx) = watch::channel(false);
        let token = token.to_string();

        let client = LiveWsClient;
        tokio::spawn(async move {
            client
                .run(ws, url, room_id, token, uid, heartbeat_interval, tx, shutdown_rx)
                .await;
        });

        Ok((
            rx,
            LiveWsHandle {
                shutdown: shutdown_tx,
            },
        ))
    }

    async fn run(
        &self,
        initial_ws: WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>,
        url: String,
        room_id: u64,
        token: String,
        uid: u64,
        heartbeat_interval: Duration,
        tx: mpsc::Sender<LiveWsMessage>,
        mut shutdown: watch::Receiver<bool>,
    ) {
        let mut ws = initial_ws;
        let mut attempts = 0u32;
        loop {
            let exited = self
                .serve_connection(&mut ws, heartbeat_interval, &tx, &mut shutdown)
                .await;
            if exited || *shutdown.borrow() {
                return;
            }
            // 连接中断：按 1/2/4/8/16/30 秒退避重连，最多 6 次
            attempts += 1;
            if attempts > 6 {
                let _ = tx.send(LiveWsMessage {
                    cmd: CMD_CONNECTION_LOST.to_string(),
                    data: Value::Null,
                });
                return;
            }
            let delay = Duration::from_secs(1u64 << attempts.min(5));
            tokio::select! {
                _ = tokio::time::sleep(delay) => {}
                _ = shutdown.changed() => return,
            }
            match connect_and_auth(&url, room_id, &token, uid).await {
                Ok(next) => {
                    ws = next;
                    attempts = 0;
                }
                Err(error) => tracing::warn!("live ws reconnect {attempts} failed: {error}"),
            }
        }
    }

    /// 服务单条连接：读消息分发 + 心跳。返回 `true` 表示应停止（收到关闭信号），
    /// `false` 表示连接中断需要退避重连。
    async fn serve_connection(
        &self,
        ws: &mut WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>,
        heartbeat_interval: Duration,
        tx: &mpsc::Sender<LiveWsMessage>,
        shutdown: &mut watch::Receiver<bool>,
    ) -> bool {
        let mut heartbeat_tick = tokio::time::interval(heartbeat_interval);
        heartbeat_tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
            tokio::select! {
                _ = shutdown.changed() => return true,
                _ = heartbeat_tick.tick() => {
                    if ws.send(Message::Binary(heartbeat::heartbeat_frame())).await.is_err() {
                        return false;
                    }
                }
                message = ws.next() => {
                    let Some(Ok(message)) = message else {
                        return false;
                    };
                    if let Message::Binary(bytes) = message {
                        for packet in decode_packets(&bytes).unwrap_or_default() {
                            match packet.op {
                                OP_NOTIFY => {
                                    for (cmd, data) in parse_cmds(&packet).unwrap_or_default() {
                                        if tx.send(LiveWsMessage { cmd, data }).await.is_err() {
                                            return false;
                                        }
                                    }
                                }
                                OP_HEARTBEAT_REPLY | OP_AUTH_REPLY => {}
                                _ => {}
                            }
                        }
                    }
                }
            }
        }
    }
}

/// 建立连接并完成认证（发送认证帧并等待 op=8 确认 code=0）。
async fn connect_and_auth(
    url: &str,
    room_id: u64,
    token: &str,
    uid: u64,
) -> Result<WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>, LiveWsError>
{
    let (mut ws, _) = tokio_tungstenite::connect_async(url).await?;
    ws.send(Message::Binary(heartbeat::auth_frame(room_id, token, uid)))
        .await?;

    let deadline = tokio::time::sleep(heartbeat::AUTH_TIMEOUT);
    tokio::pin!(deadline);
    loop {
        tokio::select! {
            _ = &mut deadline => return Err(LiveWsError::AuthTimeout),
            message = ws.next() => {
                let Some(Ok(message)) = message else {
                    return Err(LiveWsError::Closed);
                };
                let Message::Binary(bytes) = message else {
                    continue;
                };
                for packet in decode_packets(&bytes).unwrap_or_default() {
                    if packet.op == OP_AUTH_REPLY {
                        let value: Value = serde_json::from_slice(&packet.body).unwrap_or_default();
                        if value.get("code").and_then(Value::as_i64) == Some(0) {
                            return Ok(ws);
                        }
                        return Err(LiveWsError::AuthRejected(value.to_string()));
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::live::ws::heartbeat::AUTH_PROTOVER;
    use crate::live::ws::protocol::{OP_AUTH, OP_HEARTBEAT, encode_packet};
    use std::io::Write;

    /// 本地 mock 弹幕服务器：收认证 → 回 op=8 → 推送一条 DANMU_MSG → 收心跳后回 op=3 → 推送 SEND_GIFT。
    async fn mock_server(port: u16) -> tokio::task::JoinHandle<std::io::Result<()>> {
        tokio::spawn(async move {
            let listener = tokio::net::TcpListener::bind(("127.0.0.1", port)).await?;
            let (stream, _) = listener.accept().await?;
            let mut ws = tokio_tungstenite::accept_async(stream)
                .await
                .map_err(|e| std::io::Error::other(e.to_string()))?;

            // 认证帧
            let first = ws
                .next()
                .await
                .expect("auth frame")
                .map_err(|e| std::io::Error::other(e.to_string()))?;
            let Message::Binary(auth) = first else {
                panic!("expected binary auth frame");
            };
            let packets = decode_packets(&auth).expect("decode auth");
            assert_eq!(packets[0].op, OP_AUTH);
            assert_eq!(packets[0].ver, AUTH_PROTOVER);
            let value: Value = serde_json::from_slice(&packets[0].body).expect("auth json");
            assert_eq!(value["roomid"], 424242);
            assert_eq!(value["key"], "mock-token");
            assert_eq!(value["uid"], 96868451);

            // 回认证成功
            ws.send(Message::Binary(encode_packet(
                OP_AUTH_REPLY,
                0,
                br#"{"code":0}"#,
            )))
            .await
            .expect("auth reply");

            // 推送一条未压缩 DANMU_MSG
            ws.send(Message::Binary(encode_packet(
                OP_NOTIFY,
                0,
                br#"[{"cmd":"DANMU_MSG","info":[["hello"]]}]"#,
            )))
            .await
            .expect("danmu push");

            // 等待心跳帧
            let heartbeat = ws
                .next()
                .await
                .expect("heartbeat frame")
                .map_err(|e| std::io::Error::other(e.to_string()))?;
            let Message::Binary(hb) = heartbeat else {
                panic!("expected binary heartbeat frame");
            };
            let packets = decode_packets(&hb).expect("decode heartbeat");
            assert_eq!(packets[0].op, OP_HEARTBEAT);
            ws.send(Message::Binary(encode_packet(OP_HEARTBEAT_REPLY, 0, b"{}")))
                .await
                .expect("heartbeat reply");

            // 推送一条 brotli 压缩的 SEND_GIFT
            let inner = encode_packet(
                OP_NOTIFY,
                0,
                br#"{"cmd":"SEND_GIFT","data":{"giftName":"latiandou"}}"#,
            );
            let mut writer = brotli::CompressorWriter::new(Vec::new(), 4096, 5, 22);
            writer.write_all(&inner).expect("compress");
            let compressed = writer.into_inner();
            ws.send(Message::Binary(encode_packet(OP_NOTIFY, 3, &compressed)))
                .await
                .expect("gift push");

            // 等待客户端关闭
            while ws.next().await.is_some() {}
            Ok(())
        })
    }

    #[ignore = "本地 mock 服务器集成测试（连接/认证/分发/心跳）"]
    #[tokio::test]
    async fn connect_auth_dispatch_and_heartbeat() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind");
        let port = listener.local_addr().expect("addr").port();
        drop(listener);
        let server = mock_server(port).await;

        let (mut rx, handle) = LiveWsClient::connect_url(
            &format!("ws://127.0.0.1:{port}/sub"),
            424242,
            "mock-token",
            96868451,
            Duration::from_millis(100),
        )
        .await
        .expect("connect");

        let first = rx.recv().await.expect("danmu message");
        assert_eq!(first.cmd, "DANMU_MSG");
        let second = rx.recv().await.expect("gift message");
        assert_eq!(second.cmd, "SEND_GIFT");
        assert_eq!(second.data["data"]["giftName"], "latiandou");

        handle.shutdown();
        server.await.expect("server").expect("server ok");
    }

    #[ignore = "本地 mock 服务器集成测试（认证拒绝）"]
    #[tokio::test]
    async fn connect_rejects_when_auth_fails() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind");
        let port = listener.local_addr().expect("addr").port();
        drop(listener);
        tokio::spawn(async move {
            let listener = tokio::net::TcpListener::bind(("127.0.0.1", port))
                .await
                .expect("bind");
            let (stream, _) = listener.accept().await.expect("accept");
            let mut ws = tokio_tungstenite::accept_async(stream)
                .await
                .expect("accept ws");
            let _ = ws.next().await;
            ws.send(Message::Binary(encode_packet(
                OP_AUTH_REPLY,
                0,
                br#"{"code":-101,"message":"key invalid"}"#,
            )))
            .await
            .expect("auth reply");
            tokio::time::sleep(Duration::from_millis(50)).await;
        });

        let result = LiveWsClient::connect_url(
            &format!("ws://127.0.0.1:{port}/sub"),
            1,
            "bad-token",
            0,
            Duration::from_secs(30),
        )
        .await;
        assert!(matches!(result, Err(LiveWsError::AuthRejected(_))));
    }
}
