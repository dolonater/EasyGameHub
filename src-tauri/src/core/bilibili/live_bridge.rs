//! 直播弹幕 WS 桥（P6）：B 站弹幕 WS 经本地 axum WS 中转给插件。
//!
//! 路由 `GET /bilibili/live/:room_id/danmaku`：按房间创建/复用 bpi-rs `LiveWsClient`
//! （同一个房间的多个插件连接共享一条上游连接，引用计数管理生命周期）；
//! 无插件连接时自动断开上游（引用计数归零后 shutdown）。

use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::Path;
use axum::response::Response;
use bpi_rs::live::ws::{LiveWsClient, LiveWsHandle, LiveWsMessage};
use serde_json::json;
use tokio::sync::broadcast;
use tokio::sync::Mutex as AsyncMutex;

use super::client::anonymous_client;

/// 房间注册表：room_id → 房间桥。
static REGISTRY: OnceLock<AsyncMutex<HashMap<u64, Arc<RoomBridge>>>> = OnceLock::new();

/// 单个直播间的上游连接桥。
struct RoomBridge {
    room_id: u64,
    broadcast: broadcast::Sender<LiveWsMessage>,
    handle: Mutex<Option<LiveWsHandle>>,
    refcount: AtomicUsize,
}

impl RoomBridge {
    fn subscribe(&self) -> broadcast::Receiver<LiveWsMessage> {
        self.broadcast.subscribe()
    }
}

/// axum WS 升级处理：把房间弹幕流接到插件 WebSocket。
pub async fn live_danmaku_ws(Path(room_id): Path<u64>, ws: WebSocketUpgrade) -> Response {
    ws.on_upgrade(move |socket| bridge_socket(room_id, socket))
}

async fn bridge_socket(room_id: u64, mut socket: WebSocket) {
    let bridge = match ensure_bridge(room_id).await {
        Ok(bridge) => bridge,
        Err(error) => {
            let _ = socket
                .send(Message::Text(
                    json!({"cmd": "CONNECTION_ERROR", "data": {"message": error}}).to_string(),
                ))
                .await;
            let _ = socket.close().await;
            return;
        }
    };

    let mut rx = bridge.subscribe();
    loop {
        tokio::select! {
            message = rx.recv() => {
                let Ok(message) = message else { break };
                let text = json!({"cmd": message.cmd, "data": message.data}).to_string();
                if socket.send(Message::Text(text)).await.is_err() {
                    break;
                }
            }
            incoming = socket.recv() => {
                match incoming {
                    Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                    Some(Ok(_)) => {} // 插件侧的 ping/文本不处理
                }
            }
        }
    }

    release_bridge(room_id);
}

/// 获取（或创建）房间桥并增加引用计数。
async fn ensure_bridge(room_id: u64) -> Result<Arc<RoomBridge>, String> {
    let registry = REGISTRY.get_or_init(|| AsyncMutex::new(HashMap::new()));
    let mut guard = registry.lock().await;
    if let Some(bridge) = guard.get(&room_id) {
        bridge.refcount.fetch_add(1, Ordering::SeqCst);
        return Ok(bridge.clone());
    }

    // 创建上游连接：匿名客户端取 danmu_info（host + token）
    let client = anonymous_client().map_err(|e| e.to_string())?;
    let info = client
        .live()
        .danmu_info(room_id, 0)
        .await
        .map_err(|e| e.to_string())?;
    let host = info
        .host_list
        .first()
        .ok_or_else(|| "danmu host list is empty".to_string())?;
    let (mut rx, handle) =
        LiveWsClient::connect(&host.host, host.wss_port as u16, &info.token, room_id)
            .await
            .map_err(|e| e.to_string())?;

    let (broadcast_tx, _) = broadcast::channel(512);
    let forward_tx = broadcast_tx.clone();
    // 上游消息 → 广播给所有插件连接；上游断开（rx 关闭）时任务自然退出
    tokio::spawn(async move {
        while let Some(message) = rx.recv().await {
            let _ = forward_tx.send(message);
        }
    });

    let bridge = Arc::new(RoomBridge {
        room_id,
        broadcast: broadcast_tx,
        handle: Mutex::new(Some(handle)),
        refcount: AtomicUsize::new(1),
    });
    guard.insert(room_id, bridge.clone());
    Ok(bridge)
}

/// 释放房间桥引用；归零时断开上游连接并移除注册。
async fn release_bridge(room_id: u64) {
    let registry = REGISTRY.get_or_init(|| AsyncMutex::new(HashMap::new()));
    let mut guard = registry.lock().await;
    let remove = {
        let Some(bridge) = guard.get(&room_id) else {
            return;
        };
        let remaining = bridge.refcount.fetch_sub(1, Ordering::SeqCst) - 1;
        if remaining == 0 {
            if let Some(handle) = bridge.handle.lock().unwrap().take() {
                handle.shutdown();
            }
            true
        } else {
            false
        }
    };
    if remove {
        guard.remove(&room_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_starts_empty() {
        let registry = REGISTRY.get_or_init(|| AsyncMutex::new(HashMap::new()));
        let guard = registry.blocking_lock();
        assert!(guard.is_empty());
    }
}
