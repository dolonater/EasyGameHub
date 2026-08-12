//! 直播弹幕 WebSocket 二进制协议。
//!
//! B 站直播弹幕协议：每个数据包为 16 字节包头 + 变长负载。
//! 包头：`packet_len(u32 BE) | header_len(u16 BE) | protover(u16 BE) | op(u32 BE) | seq(u32 BE)`。
//! `protover`：0/1 = 普通 JSON，2 = zlib 压缩，3 = brotli 压缩。

use serde_json::Value;

/// 包头固定长度。
pub const HEADER_LEN: usize = 16;

/// 客户端认证包操作码。
pub const OP_AUTH: u32 = 7;
/// 心跳包操作码。
pub const OP_HEARTBEAT: u32 = 2;
/// 服务端心跳回应。
pub const OP_HEARTBEAT_REPLY: u32 = 3;
/// 服务端消息推送。
pub const OP_NOTIFY: u32 = 5;
/// 服务端认证回应。
pub const OP_AUTH_REPLY: u32 = 8;

/// 协议错误。
#[derive(Debug, thiserror::Error)]
pub enum ProtocolError {
    #[error("packet too short: {0} bytes")]
    PacketTooShort(usize),
    #[error("invalid packet length: {0}")]
    InvalidPacketLen(usize),
    #[error("invalid header length: {0}")]
    InvalidHeaderLen(usize),
    #[error("unsupported protover: {0}")]
    UnsupportedProtover(u16),
    #[error("decompress failed: {0}")]
    DecompressFailed(String),
    #[error("payload is not valid json: {0}")]
    InvalidJson(String),
}

/// 解析后的数据包（负载可能仍为压缩态）。
#[derive(Debug, Clone)]
pub struct Packet {
    pub op: u32,
    pub ver: u16,
    pub body: Vec<u8>,
}

/// 构造一个数据包帧（包头 + 负载）。
pub fn encode_packet(op: u32, ver: u16, body: &[u8]) -> Vec<u8> {
    let total = HEADER_LEN + body.len();
    let mut out = Vec::with_capacity(total);
    out.extend_from_slice(&(total as u32).to_be_bytes());
    out.extend_from_slice(&(HEADER_LEN as u16).to_be_bytes());
    out.extend_from_slice(&ver.to_be_bytes());
    out.extend_from_slice(&op.to_be_bytes());
    out.extend_from_slice(&0u32.to_be_bytes());
    out.extend_from_slice(body);
    out
}

/// 解析字节流中的全部数据包（支持多个包粘合在同一个缓冲区）。
pub fn decode_packets(data: &[u8]) -> Result<Vec<Packet>, ProtocolError> {
    let mut packets = Vec::new();
    let mut rest = data;
    while !rest.is_empty() {
        let packet = decode_one(rest)?;
        rest = &rest[packet.len..];
        packets.push(packet.into_packet());
    }
    Ok(packets)
}

struct DecodedPacket {
    len: usize,
    op: u32,
    ver: u16,
    body: Vec<u8>,
}

impl DecodedPacket {
    fn into_packet(self) -> Packet {
        Packet {
            op: self.op,
            ver: self.ver,
            body: self.body,
        }
    }
}

fn decode_one(data: &[u8]) -> Result<DecodedPacket, ProtocolError> {
    if data.len() < HEADER_LEN {
        return Err(ProtocolError::PacketTooShort(data.len()));
    }
    let total = u32::from_be_bytes([data[0], data[1], data[2], data[3]]) as usize;
    let header_len = u16::from_be_bytes([data[4], data[5]]) as usize;
    let ver = u16::from_be_bytes([data[6], data[7]]);
    let op = u32::from_be_bytes([data[8], data[9], data[10], data[11]]);
    if total < HEADER_LEN {
        return Err(ProtocolError::InvalidPacketLen(total));
    }
    if header_len != HEADER_LEN {
        return Err(ProtocolError::InvalidHeaderLen(header_len));
    }
    if total > data.len() {
        return Err(ProtocolError::PacketTooShort(data.len()));
    }
    let body = data[header_len..total].to_vec();
    Ok(DecodedPacket {
        len: total,
        op,
        ver,
        body,
    })
}

/// 按 `protover` 解压负载；`ver` 为 0/1 时原样返回。
pub fn decompress_body(ver: u16, body: &[u8]) -> Result<Vec<u8>, ProtocolError> {
    match ver {
        0 | 1 => Ok(body.to_vec()),
        2 => {
            use std::io::Read;
            let mut decoder = flate2::read::ZlibDecoder::new(body);
            let mut out = Vec::new();
            decoder
                .read_to_end(&mut out)
                .map_err(|e| ProtocolError::DecompressFailed(e.to_string()))?;
            Ok(out)
        }
        3 => {
            use brotli::Decompressor;
            use std::io::Read;
            let mut decoder = Decompressor::new(body, 4096);
            let mut out = Vec::new();
            decoder
                .read_to_end(&mut out)
                .map_err(|e| ProtocolError::DecompressFailed(e.to_string()))?;
            Ok(out)
        }
        other => Err(ProtocolError::UnsupportedProtover(other)),
    }
}

/// 解析一个消息包：解压（如需）后取出 JSON 与其中的 `cmd` 字段。
///
/// `op=5`（通知）的负载为 JSON 数组（未压缩时）或连续数据包流（压缩时），
/// 其中每条又包含独立 JSON，本函数展开为多条消息。心跳/认证回应等非内容包返回空列表。
pub fn parse_cmds(packet: &Packet) -> Result<Vec<(String, Value)>, ProtocolError> {
    if packet.op != OP_NOTIFY {
        return Ok(Vec::new());
    }
    let raw = decompress_body(packet.ver, &packet.body)?;
    match serde_json::from_slice::<Value>(&raw) {
        // 未压缩：body 直接是 JSON 数组或单对象
        Ok(Value::Array(items)) => {
            let mut cmds = Vec::with_capacity(items.len());
            for item in items {
                if let Some(cmd) = extract_cmd(&item) {
                    cmds.push((cmd, item));
                }
            }
            Ok(cmds)
        }
        Ok(value) => Ok(extract_cmd(&value)
            .map(|cmd| vec![(cmd, value)])
            .unwrap_or_default()),
        // 压缩：body 是连续 16 字节头数据包流
        Err(_) => {
            let mut cmds = Vec::new();
            for nested in decode_packets(&raw).unwrap_or_default() {
                let payload = decompress_body(nested.ver, &nested.body).unwrap_or_default();
                if let Ok(value) = serde_json::from_slice::<Value>(&payload) {
                    if let Some(cmd) = extract_cmd(&value) {
                        cmds.push((cmd, value));
                    }
                }
            }
            Ok(cmds)
        }
    }
}

fn extract_cmd(value: &Value) -> Option<String> {
    value
        .get("cmd")
        .and_then(Value::as_str)
        .map(|cmd| cmd.split(':').next().unwrap_or(cmd).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_decode_roundtrip() {
        let body = br#"{"roomid":123,"key":"token"}"#;
        let frame = encode_packet(OP_AUTH, 3, body);
        assert_eq!(frame.len(), HEADER_LEN + body.len());
        let packets = decode_packets(&frame).expect("decode");
        assert_eq!(packets.len(), 1);
        assert_eq!(packets[0].op, OP_AUTH);
        assert_eq!(packets[0].ver, 3);
        assert_eq!(packets[0].body, body);
    }

    #[test]
    fn decode_multiple_coalesced_packets() {
        let a = encode_packet(OP_HEARTBEAT, 0, &[]);
        let b = encode_packet(OP_NOTIFY, 0, br#"{"cmd":"DANMU_MSG"}"#);
        let mut merged = a.clone();
        merged.extend_from_slice(&b);
        let packets = decode_packets(&merged).expect("decode");
        assert_eq!(packets.len(), 2);
        assert_eq!(packets[0].op, OP_HEARTBEAT);
        assert_eq!(packets[1].op, OP_NOTIFY);
    }

    #[test]
    fn decode_truncated_packet_is_error() {
        let frame = encode_packet(OP_NOTIFY, 0, b"short");
        assert!(decode_packets(&frame[..frame.len() - 3]).is_err());
    }

    #[test]
    fn zlib_payload_decompresses() {
        use std::io::Write;
        let mut encoder =
            flate2::write::ZlibEncoder::new(Vec::new(), flate2::Compression::default());
        encoder.write_all(br#"{"cmd":"DANMU_MSG"}"#).unwrap();
        let compressed = encoder.finish().unwrap();
        let out = decompress_body(2, &compressed).expect("zlib");
        assert_eq!(out, br#"{"cmd":"DANMU_MSG"}"#);
    }

    #[test]
    fn brotli_payload_decompresses() {
        use std::io::Write;
        let mut writer = brotli::CompressorWriter::new(Vec::new(), 4096, 5, 22);
        writer.write_all(br#"{"cmd":"SEND_GIFT"}"#).unwrap();
        let compressed = writer.into_inner();
        let out = decompress_body(3, &compressed).expect("brotli");
        assert_eq!(out, br#"{"cmd":"SEND_GIFT"}"#);
    }

    #[test]
    fn parse_plain_notify_returns_cmds() {
        let body = br#"[{"cmd":"DANMU_MSG","info":[]},{"cmd":"SEND_GIFT"}]"#;
        let packet = Packet {
            op: OP_NOTIFY,
            ver: 0,
            body: body.to_vec(),
        };
        let cmds = parse_cmds(&packet).expect("parse");
        assert_eq!(cmds.len(), 2);
        assert_eq!(cmds[0].0, "DANMU_MSG");
        assert_eq!(cmds[1].0, "SEND_GIFT");
    }

    #[test]
    fn parse_compressed_notify_returns_cmds() {
        use std::io::Write;
        let inner = encode_packet(OP_NOTIFY, 0, br#"{"cmd":"SUPER_CHAT_MESSAGE"}"#);
        let mut encoder =
            flate2::write::ZlibEncoder::new(Vec::new(), flate2::Compression::default());
        encoder.write_all(&inner).unwrap();
        let compressed = encoder.finish().unwrap();
        // 压缩负载包整体包在一个 op=5 包中
        let frame = encode_packet(OP_NOTIFY, 2, &compressed);
        let packets = decode_packets(&frame).expect("decode");
        let cmds = parse_cmds(&packets[0]).expect("parse");
        assert_eq!(cmds.len(), 1);
        assert_eq!(cmds[0].0, "SUPER_CHAT_MESSAGE");
    }

    #[test]
    fn parse_non_notify_returns_empty() {
        let packet = Packet {
            op: OP_HEARTBEAT_REPLY,
            ver: 0,
            body: b"{}".to_vec(),
        };
        assert!(parse_cmds(&packet).expect("parse").is_empty());
    }

    #[test]
    fn cmd_with_suffix_keeps_base_name() {
        let body = br#"{"cmd":"DANMU_MSG:4:0:2:2:2:0"}"#;
        let packet = Packet {
            op: OP_NOTIFY,
            ver: 0,
            body: body.to_vec(),
        };
        let cmds = parse_cmds(&packet).expect("parse");
        assert_eq!(cmds[0].0, "DANMU_MSG");
    }
}
