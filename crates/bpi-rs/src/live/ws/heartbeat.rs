//! 直播弹幕 WebSocket 心跳与认证帧构造。

use std::time::Duration;

use serde_json::json;

use super::protocol::{OP_AUTH, OP_HEARTBEAT, encode_packet};

/// 心跳间隔（B 站要求 30 秒一次）。
pub const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(30);

/// 认证超时。
pub const AUTH_TIMEOUT: Duration = Duration::from_secs(5);

/// 认证协议版本（brotli 压缩）。
pub const AUTH_PROTOVER: u16 = 3;

/// 构造认证帧（op=7）。`uid` 为登录用户 mid，游客传 0。
pub fn auth_frame(room_id: u64, token: &str, uid: u64) -> Vec<u8> {
    let body = json!({
        "uid": uid,
        "roomid": room_id,
        "protover": AUTH_PROTOVER,
        "platform": "web",
        "type": 2,
        "key": token,
    })
    .to_string();
    encode_packet(OP_AUTH, AUTH_PROTOVER, body.as_bytes())
}

/// 构造心跳帧（op=2，空负载）。
pub fn heartbeat_frame() -> Vec<u8> {
    encode_packet(OP_HEARTBEAT, 1, &[])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::live::ws::protocol::{OP_HEARTBEAT, decode_packets};

    #[test]
    fn auth_frame_contains_room_and_token() {
        let frame = auth_frame(12345, "secret-token", 42);
        let packets = decode_packets(&frame).expect("decode");
        assert_eq!(packets.len(), 1);
        assert_eq!(packets[0].op, OP_AUTH);
        assert_eq!(packets[0].ver, AUTH_PROTOVER);
        let value: serde_json::Value = serde_json::from_slice(&packets[0].body).expect("json body");
        assert_eq!(value["roomid"], 12345);
        assert_eq!(value["key"], "secret-token");
        assert_eq!(value["uid"], 42);
        assert_eq!(value["protover"], AUTH_PROTOVER);
    }

    #[test]
    fn heartbeat_frame_is_op_heartbeat_with_empty_body() {
        let frame = heartbeat_frame();
        assert_eq!(frame.len(), 16);
        let packets = decode_packets(&frame).expect("decode");
        assert_eq!(packets[0].op, OP_HEARTBEAT);
        assert!(packets[0].body.is_empty());
    }
}
