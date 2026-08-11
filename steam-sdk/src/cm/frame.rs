//! Steam CM message envelope framing + `CMsgMulti` unwrapping.
//!
//! Each WebSocket binary message is a protobuf-flagged envelope:
//! `[u32 eMsg | 0x80000000][u32 header_len][CMsgProtoBufHeader][body protobuf]`.
//! Large bursts arrive wrapped in `CMsgMulti` (EMsg 1) and must be unwrapped.

use crate::cm::proto_wire::{self, Writer};
use std::io::Read;

pub const EMSG_MULTI: u32 = 1;
pub const EMSG_SERVICE_METHOD: u32 = 146;
pub const EMSG_SERVICE_METHOD_RESPONSE: u32 = 147;
pub const EMSG_SERVICE_METHOD_CALL_FROM_CLIENT: u32 = 151;
pub const EMSG_SERVICE_METHOD_SEND_TO_CLIENT: u32 = 152;
pub const EMSG_CLIENT_LOGON: u32 = 5514;
pub const EMSG_CLIENT_LOGON_RESPONSE: u32 = 751;
pub const EMSG_CLIENT_LOGGED_OFF: u32 = 757;
pub const EMSG_CLIENT_FRIENDS_LIST: u32 = 767;
pub const EMSG_CLIENT_PERSONA_STATE: u32 = 704;
pub const EMSG_CLIENT_HEARTBEAT: u32 = 703;
pub const EMSG_CLIENT_LOG_OFF: u32 = 738;
pub const EMSG_CLIENT_GET_EMOTICON_LIST: u32 = 9330;
pub const EMSG_CLIENT_EMOTICON_LIST: u32 = 9331;

pub const JOB_ID_NONE: i64 = -1;

/// Parsed CM envelope header (CMsgProtoBufHeader wire fields).
#[derive(Debug, Clone, Default)]
pub struct CmHeader {
    pub steam_id: u64,
    pub session_id: u32,
    pub job_id_source: i64,
    pub job_id_target: i64,
    pub target_job_name: Option<String>,
    pub eresult: Option<i32>,
    pub error_message: Option<String>,
    pub transport_error: Option<i32>,
}

/// One decoded CM message.
#[derive(Debug, Clone)]
pub struct Envelope {
    pub emsg: u32,
    pub header: CmHeader,
    pub body: Vec<u8>,
}

/// Encode an outbound envelope for the WebSocket.
pub fn encode_envelope(
    emsg: u32,
    steam_id: u64,
    session_id: u32,
    job_id_source: i64,
    target_job_name: Option<&str>,
    body: &[u8],
) -> Vec<u8> {
    let mut h = Writer::new();
    h.fixed64(1, steam_id);
    h.varint(2, session_id as u64);
    h.fixed64(10, job_id_source as u64);
    if let Some(name) = target_job_name {
        h.string(12, name);
    }
    let header = h.finish();

    let mut out = Vec::with_capacity(8 + header.len() + body.len());
    out.extend_from_slice(&(emsg | 0x8000_0000).to_le_bytes());
    out.extend_from_slice(&(header.len() as u32).to_le_bytes());
    out.extend_from_slice(&header);
    out.extend_from_slice(body);
    out
}

/// Decode a WebSocket binary payload into one or more envelopes, unwrapping
/// `CMsgMulti` (recursively, bounded depth) and gzip when compressed.
pub fn decode_envelopes(payload: &[u8]) -> Result<Vec<Envelope>, String> {
    let mut out = Vec::new();
    decode_into(payload, 0, &mut out)?;
    Ok(out)
}

fn decode_into(payload: &[u8], depth: u32, out: &mut Vec<Envelope>) -> Result<(), String> {
    if depth > 2 {
        return Err("CMsgMulti nesting too deep".into());
    }
    let envelope = decode_single(payload)?;
    if envelope.emsg == EMSG_MULTI {
        let fields = proto_wire::parse(&envelope.body)?;
        let compressed_size = proto_wire::get_varint(&fields, 1).unwrap_or(0);
        let packed = proto_wire::get_bytes(&fields, 2).ok_or("CMsgMulti has no body")?;
        let unpacked = if compressed_size > 0 {
            let mut decoder = flate2::read::GzDecoder::new(packed);
            let mut buf = Vec::new();
            decoder
                .read_to_end(&mut buf)
                .map_err(|e| format!("CMsgMulti gunzip: {}", e))?;
            buf
        } else {
            packed.to_vec()
        };
        let mut i = 0;
        while i + 4 <= unpacked.len() {
            let len = u32::from_le_bytes(unpacked[i..i + 4].try_into().unwrap()) as usize;
            i += 4;
            if i + len > unpacked.len() {
                return Err("CMsgMulti item truncated".into());
            }
            decode_into(&unpacked[i..i + len], depth + 1, out)?;
            i += len;
        }
        Ok(())
    } else {
        out.push(envelope);
        Ok(())
    }
}

fn decode_single(payload: &[u8]) -> Result<Envelope, String> {
    if payload.len() < 8 {
        return Err("CM message too short".into());
    }
    let raw = u32::from_le_bytes(payload[0..4].try_into().unwrap());
    if raw & 0x8000_0000 == 0 {
        return Err("CM message has no protobuf header flag".into());
    }
    let emsg = raw & 0x7fff_ffff;
    let header_len = u32::from_le_bytes(payload[4..8].try_into().unwrap()) as usize;
    if 8 + header_len > payload.len() {
        return Err("CM header length invalid".into());
    }
    let fields = proto_wire::parse(&payload[8..8 + header_len])?;
    let header = CmHeader {
        steam_id: proto_wire::get_fixed64(&fields, 1).unwrap_or(0),
        session_id: proto_wire::get_varint(&fields, 2).unwrap_or(0) as u32,
        job_id_source: proto_wire::get_fixed64(&fields, 10)
            .map(|v| v as i64)
            .unwrap_or(JOB_ID_NONE),
        job_id_target: proto_wire::get_fixed64(&fields, 11)
            .map(|v| v as i64)
            .unwrap_or(JOB_ID_NONE),
        target_job_name: proto_wire::get_string(&fields, 12),
        eresult: proto_wire::get_varint(&fields, 13).map(|v| v as i32),
        error_message: proto_wire::get_string(&fields, 14),
        transport_error: proto_wire::get_varint(&fields, 17).map(|v| v as i32),
    };
    Ok(Envelope {
        emsg,
        header,
        body: payload[8 + header_len..].to_vec(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_envelope() {
        let mut body = Writer::new();
        body.fixed64(1, 76561198000000000);
        body.varint(2, 1);
        body.string(3, "hello");
        body.bool(4, true);
        let body = body.finish();

        let wire = encode_envelope(
            EMSG_CLIENT_LOGON,
            76561198000000000,
            7,
            42,
            Some("X.Y#1"),
            &body,
        );
        let decoded = decode_envelopes(&wire).unwrap();
        assert_eq!(decoded.len(), 1);
        let env = &decoded[0];
        assert_eq!(env.emsg, EMSG_CLIENT_LOGON);
        assert_eq!(env.header.steam_id, 76561198000000000);
        assert_eq!(env.header.session_id, 7);
        assert_eq!(env.header.job_id_source, 42);
        assert_eq!(env.header.target_job_name.as_deref(), Some("X.Y#1"));

        let fields = proto_wire::parse(&env.body).unwrap();
        assert_eq!(proto_wire::get_fixed64(&fields, 1), Some(76561198000000000));
        assert_eq!(proto_wire::get_string(&fields, 3).as_deref(), Some("hello"));
    }

    #[test]
    fn unwraps_multi() {
        let inner_a = encode_envelope(EMSG_SERVICE_METHOD, 0, 1, -1, Some("A.B"), &[]);
        let inner_b = encode_envelope(EMSG_SERVICE_METHOD, 0, 1, -1, Some("C.D"), &[]);

        let mut packed = Vec::new();
        for msg in [&inner_a, &inner_b] {
            packed.extend_from_slice(&(msg.len() as u32).to_le_bytes());
            packed.extend_from_slice(msg);
        }
        // CMsgMulti: field 2 = message_body (length-delimited).
        let mut m = Writer::new();
        m.bytes(2, &packed);
        let multi_body = m.finish();
        let multi = encode_envelope(EMSG_MULTI, 0, 1, -1, None, &multi_body);

        let decoded = decode_envelopes(&multi).unwrap();
        assert_eq!(decoded.len(), 2);
        assert_eq!(decoded[0].header.target_job_name.as_deref(), Some("A.B"));
        assert_eq!(decoded[1].header.target_job_name.as_deref(), Some("C.D"));
    }

    #[test]
    fn rejects_non_protobuf_message() {
        // A plain TCP-style message (no 0x80000000 flag) must be rejected.
        let wire = [0x01u8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
        assert!(decode_envelopes(&wire).is_err());
    }
}
