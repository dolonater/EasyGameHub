//! Minimal protobuf wire reader/writer.
//!
//! Used for Steam CM payloads that aren't generated as `prost` structs (chat
//! service request/response bodies, the CM envelope header). Covers the wire
//! types Steam uses: varint / fixed64 / fixed32 / length-delimited.

/// A parsed field value.
#[derive(Debug, Clone, PartialEq)]
pub enum WireValue {
    Varint(u64),
    Fixed64(u64),
    Fixed32(u32),
    Bytes(Vec<u8>),
}

/// Parse a protobuf message into `(field_number, value)` pairs.
pub fn parse(buf: &[u8]) -> Result<Vec<(u64, WireValue)>, String> {
    let mut fields = Vec::new();
    let mut i = 0;
    while i < buf.len() {
        let tag = read_varint(buf, &mut i)?;
        let number = tag >> 3;
        if number == 0 {
            return Err("invalid field number 0".into());
        }
        match tag & 0x7 {
            0 => {
                let value = read_varint(buf, &mut i)?;
                fields.push((number, WireValue::Varint(value)));
            }
            1 => {
                let value = read_fixed64(buf, &mut i)?;
                fields.push((number, WireValue::Fixed64(value)));
            }
            2 => {
                let len = read_varint(buf, &mut i)? as usize;
                if i + len > buf.len() {
                    return Err("truncated length-delimited field".into());
                }
                fields.push((number, WireValue::Bytes(buf[i..i + len].to_vec())));
                i += len;
            }
            5 => {
                let value = read_fixed32(buf, &mut i)?;
                fields.push((number, WireValue::Fixed32(value)));
            }
            other => return Err(format!("unsupported wire type {}", other)),
        }
    }
    Ok(fields)
}

fn read_varint(buf: &[u8], i: &mut usize) -> Result<u64, String> {
    let mut value = 0u64;
    for shift in (0..64).step_by(7) {
        let byte = *buf.get(*i).ok_or("varint truncated")?;
        *i += 1;
        value |= ((byte & 0x7f) as u64) << shift;
        if byte & 0x80 == 0 {
            return Ok(value);
        }
    }
    Err("varint too long".into())
}

fn read_fixed64(buf: &[u8], i: &mut usize) -> Result<u64, String> {
    if *i + 8 > buf.len() {
        return Err("fixed64 truncated".into());
    }
    let bytes: [u8; 8] = buf[*i..*i + 8].try_into().unwrap();
    *i += 8;
    Ok(u64::from_le_bytes(bytes))
}

fn read_fixed32(buf: &[u8], i: &mut usize) -> Result<u32, String> {
    if *i + 4 > buf.len() {
        return Err("fixed32 truncated".into());
    }
    let bytes: [u8; 4] = buf[*i..*i + 4].try_into().unwrap();
    *i += 4;
    Ok(u32::from_le_bytes(bytes))
}

// ── Helpers to pull specific fields ─────────────────────────

pub fn get_varint(fields: &[(u64, WireValue)], number: u64) -> Option<u64> {
    fields
        .iter()
        .find(|(n, v)| *n == number && matches!(v, WireValue::Varint(_)))
        .and_then(|(_, v)| match v {
            WireValue::Varint(x) => Some(*x),
            _ => None,
        })
}

pub fn get_fixed64(fields: &[(u64, WireValue)], number: u64) -> Option<u64> {
    fields
        .iter()
        .find(|(n, v)| *n == number && matches!(v, WireValue::Fixed64(_)))
        .and_then(|(_, v)| match v {
            WireValue::Fixed64(x) => Some(*x),
            _ => None,
        })
}

pub fn get_fixed32(fields: &[(u64, WireValue)], number: u64) -> Option<u32> {
    fields
        .iter()
        .find(|(n, v)| *n == number && matches!(v, WireValue::Fixed32(_)))
        .and_then(|(_, v)| match v {
            WireValue::Fixed32(x) => Some(*x),
            _ => None,
        })
}

pub fn get_bytes(fields: &[(u64, WireValue)], number: u64) -> Option<&[u8]> {
    fields
        .iter()
        .find(|(n, v)| *n == number && matches!(v, WireValue::Bytes(_)))
        .and_then(|(_, v)| match v {
            WireValue::Bytes(x) => Some(x.as_slice()),
            _ => None,
        })
}

pub fn get_string(fields: &[(u64, WireValue)], number: u64) -> Option<String> {
    get_bytes(fields, number).and_then(|b| String::from_utf8(b.to_vec()).ok())
}

pub fn get_bool(fields: &[(u64, WireValue)], number: u64) -> Option<bool> {
    get_varint(fields, number).map(|v| v != 0)
}

// ── Writer ──────────────────────────────────────────────────

/// Minimal protobuf message builder.
#[derive(Default)]
pub struct Writer {
    buf: Vec<u8>,
}

impl Writer {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn varint(&mut self, number: u64, value: u64) {
        self.tag(number, 0);
        write_varint(&mut self.buf, value);
    }

    pub fn bool(&mut self, number: u64, value: bool) {
        self.varint(number, if value { 1 } else { 0 });
    }

    pub fn fixed64(&mut self, number: u64, value: u64) {
        self.tag(number, 1);
        self.buf.extend_from_slice(&value.to_le_bytes());
    }

    pub fn fixed32(&mut self, number: u64, value: u32) {
        self.tag(number, 5);
        self.buf.extend_from_slice(&value.to_le_bytes());
    }

    pub fn bytes(&mut self, number: u64, value: &[u8]) {
        self.tag(number, 2);
        write_varint(&mut self.buf, value.len() as u64);
        self.buf.extend_from_slice(value);
    }

    pub fn string(&mut self, number: u64, value: &str) {
        self.bytes(number, value.as_bytes());
    }

    pub fn finish(self) -> Vec<u8> {
        self.buf
    }

    fn tag(&mut self, number: u64, wire: u64) {
        write_varint(&mut self.buf, (number << 3) | wire);
    }
}

fn write_varint(buf: &mut Vec<u8>, mut value: u64) {
    loop {
        let byte = (value & 0x7f) as u8;
        value >>= 7;
        if value == 0 {
            buf.push(byte);
            break;
        }
        buf.push(byte | 0x80);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_fields() {
        let mut w = Writer::new();
        w.fixed64(1, 76561198000000000);
        w.varint(2, 7);
        w.string(3, "hello 中文");
        w.bool(4, true);
        w.fixed32(5, 12345);
        let buf = w.finish();

        let fields = parse(&buf).unwrap();
        assert_eq!(get_fixed64(&fields, 1), Some(76561198000000000));
        assert_eq!(get_varint(&fields, 2), Some(7));
        assert_eq!(get_string(&fields, 3).as_deref(), Some("hello 中文"));
        assert_eq!(get_bool(&fields, 4), Some(true));
        assert_eq!(get_fixed32(&fields, 5), Some(12345));
    }

    #[test]
    fn parses_known_steam_envelope_header() {
        // CMsgProtoBufHeader with steamid(1)=765..., sessionid(2)=3,
        // jobid_source(10)=42, target_job_name(12)="FriendMessages.SendMessage#1".
        let mut w = Writer::new();
        w.fixed64(1, 76561198000000000);
        w.varint(2, 3);
        w.fixed64(10, 42);
        w.string(12, "FriendMessages.SendMessage#1");
        let buf = w.finish();
        let fields = parse(&buf).unwrap();
        assert_eq!(get_fixed64(&fields, 1), Some(76561198000000000));
        assert_eq!(get_varint(&fields, 2), Some(3));
        assert_eq!(get_fixed64(&fields, 10), Some(42));
        assert_eq!(get_string(&fields, 12).as_deref(), Some("FriendMessages.SendMessage#1"));
    }

    #[test]
    fn rejects_bad_wire_type() {
        // tag = (field 1 << 3) | wire 6 (reserved/unsupported).
        assert!(parse(&[0x0E]).is_err());
    }
}
