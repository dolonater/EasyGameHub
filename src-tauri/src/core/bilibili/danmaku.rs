use bpi_rs::danmaku::{
    DanmakuRecallParams, DanmakuReportParams, DanmakuSegmentParams, DanmakuSendParams,
    DanmakuThumbupParams, DanmakuXmlListParams,
};
use bpi_rs::ids::{Aid, Bvid, Cid};
use bpi_rs::{BpiClient, BpiError};

use super::models::{BiliDanmakuItem, BiliDanmakuSendResult, BiliOperationResult};

const VIDEO_DANMAKU_TYPE: u8 = 1;
const MAX_DANMAKU_MESSAGE_LEN: usize = 100;
/// 每段弹幕时长（秒），与 B 站 seg.so 分段一致（6 分钟）。
const SEGMENT_SECONDS: f64 = 360.0;

pub async fn danmaku_segment(
    client: &BpiClient,
    cid: u64,
    _aid: Option<u64>,
    segment_index: u32,
) -> Result<Vec<BiliDanmakuItem>, BpiError> {
    let cid = Cid::new(cid)?;
    if segment_index == 0 {
        return Err(BpiError::invalid_parameter(
            "segment_index",
            "segment index must start at 1",
        ));
    }
    let params = DanmakuSegmentParams::new(VIDEO_DANMAKU_TYPE, cid.get(), segment_index)?;
    let data = client.danmaku().web_seg_wbi_proto(params).await?;
    match parse_dm_seg_reply(&data) {
        Ok(elems) => Ok(elems.into_iter().map(danmaku_elem_to_item).collect()),
        Err(_) => {
            // protobuf 解析失败降级：全量 XML 中截取同一段窗口
            let xml_params = DanmakuXmlListParams::new(cid);
            let xml = client.danmaku().xml_list_so(xml_params).await?;
            let segment_start = f64::from(segment_index - 1) * SEGMENT_SECONDS;
            let segment_end = f64::from(segment_index) * SEGMENT_SECONDS;
            let mut items: Vec<_> = xml
                .danmakus
                .into_iter()
                .filter_map(|item| {
                    let meta = item.meta?;
                    let time = f64::from(meta.time).max(0.0);
                    if time < segment_start || time >= segment_end {
                        return None;
                    }
                    let text = clean_text(&item.content);
                    if text.is_empty() {
                        return None;
                    }
                    Some(BiliDanmakuItem {
                        id: meta.dmid.to_string(),
                        time,
                        text,
                        color: color_hex(meta.color),
                        mode: clamp_mode(meta.danmaku_type),
                        font_size: meta.font_size.max(1) as u32,
                        timestamp: meta.send_time,
                    })
                })
                .collect();
            items.sort_by(|a, b| {
                a.time
                    .partial_cmp(&b.time)
                    .unwrap_or(std::cmp::Ordering::Equal)
                    .then_with(|| a.id.cmp(&b.id))
            });
            Ok(items)
        }
    }
}

pub async fn thumbup_danmaku(
    client: &BpiClient,
    cid: u64,
    dmid: u64,
    like: bool,
) -> Result<BiliOperationResult, BpiError> {
    let params = DanmakuThumbupParams::new(Cid::new(cid)?, dmid, if like { 1 } else { 2 })?;
    client.danmaku().thumbup(params).await?;
    Ok(BiliOperationResult::ok("danmaku thumbup"))
}

pub async fn report_danmaku(
    client: &BpiClient,
    cid: u64,
    dmid: u64,
    reason: u8,
    content: Option<String>,
) -> Result<BiliOperationResult, BpiError> {
    let mut params = DanmakuReportParams::new(Cid::new(cid)?, dmid, reason)?;
    if let Some(content) = content {
        if !content.trim().is_empty() {
            params = params.content(content)?;
        }
    }
    client.danmaku().report(params).await?;
    Ok(BiliOperationResult::ok("danmaku reported"))
}

pub async fn recall_danmaku(
    client: &BpiClient,
    cid: u64,
    dmid: u64,
) -> Result<BiliOperationResult, BpiError> {
    let params = DanmakuRecallParams::new(Cid::new(cid)?, dmid)?;
    client.danmaku().recall(params).await?;
    Ok(BiliOperationResult::ok("danmaku recalled"))
}

pub async fn danmaku_list(
    client: &BpiClient,
    cid: u64,
    aid: Option<u64>,
) -> Result<Vec<BiliDanmakuItem>, BpiError> {
    let cid = Cid::new(cid)?;
    let params = DanmakuXmlListParams::new(cid);
    let _ = aid;
    let xml = client.danmaku().xml_list_so(params).await?;
    let mut items: Vec<_> = xml
        .danmakus
        .into_iter()
        .filter_map(|item| {
            let meta = item.meta?;
            let text = clean_text(&item.content);
            if text.is_empty() {
                return None;
            }
            Some(BiliDanmakuItem {
                id: meta.dmid.to_string(),
                time: f64::from(meta.time).max(0.0),
                text,
                color: color_hex(meta.color),
                mode: clamp_mode(meta.danmaku_type),
                font_size: meta.font_size.max(1) as u32,
                timestamp: meta.send_time,
            })
        })
        .collect();
    items.sort_by(|a, b| {
        a.time
            .partial_cmp(&b.time)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.id.cmp(&b.id))
    });
    Ok(items)
}

pub async fn send_danmaku(
    client: &BpiClient,
    aid: u64,
    bvid: String,
    cid: u64,
    message: String,
    progress: u32,
) -> Result<BiliDanmakuSendResult, BpiError> {
    let message = normalize_message(message)?;
    let mut params = DanmakuSendParams::new(Cid::new(cid)?, message)?
        .aid(Aid::new(aid)?)
        .progress(progress)
        .mode(1)
        .danmaku_type(VIDEO_DANMAKU_TYPE)
        .color(16_777_215)
        .font_size(25);
    if !bvid.trim().is_empty() {
        params = params.bvid(Bvid::new(bvid.trim())?);
    }
    let post = client.danmaku().send(params).await?;
    let dmid = if post.dmid > 0 { Some(post.dmid) } else { None };
    Ok(BiliDanmakuSendResult::ok("danmaku sent", dmid))
}

pub fn normalize_message(message: String) -> Result<String, BpiError> {
    let message = clean_text(&message);
    if message.is_empty() {
        return Err(BpiError::invalid_parameter(
            "message",
            "danmaku message cannot be blank",
        ));
    }
    if message.chars().count() > MAX_DANMAKU_MESSAGE_LEN {
        return Err(BpiError::invalid_parameter(
            "message",
            "danmaku message cannot exceed 100 characters",
        ));
    }
    Ok(message)
}

fn clean_text(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(200)
        .collect()
}

fn color_hex(value: i32) -> String {
    let color = value.clamp(0, 0xFF_FF_FF) as u32;
    format!("#{color:06X}")
}

fn clamp_mode(value: i32) -> u8 {
    value.clamp(1, u8::MAX as i32) as u8
}

/// 轻量 protobuf wire format 读取器，只解析 DmSegMobileReply 需要的字段，
/// 避免为单个响应引入 protobuf 代码生成依赖。
struct ProtoReader<'a> {
    buf: &'a [u8],
    pos: usize,
}

impl<'a> ProtoReader<'a> {
    fn new(buf: &'a [u8]) -> Self {
        Self { buf, pos: 0 }
    }

    fn done(&self) -> bool {
        self.pos >= self.buf.len()
    }

    fn read_varint(&mut self) -> Option<u64> {
        let mut value: u64 = 0;
        let mut shift = 0;
        loop {
            let byte = *self.buf.get(self.pos)?;
            self.pos += 1;
            value |= u64::from(byte & 0x7F).wrapping_shl(shift);
            if byte & 0x80 == 0 {
                return Some(value);
            }
            shift += 7;
            if shift >= 64 {
                return None;
            }
        }
    }

    fn read_tag(&mut self) -> Option<(u32, u8)> {
        let tag = self.read_varint()?;
        let field = (tag >> 3) as u32;
        let wire = (tag & 0x07) as u8;
        if field == 0 {
            return None;
        }
        Some((field, wire))
    }

    fn read_bytes(&mut self) -> Option<&'a [u8]> {
        let len = usize::try_from(self.read_varint()?).ok()?;
        let end = self.pos.checked_add(len)?;
        let slice = self.buf.get(self.pos..end)?;
        self.pos = end;
        Some(slice)
    }

    fn skip(&mut self, wire: u8) -> bool {
        match wire {
            0 => self.read_varint().is_some(),
            1 => {
                self.pos += 8;
                self.pos <= self.buf.len()
            }
            2 => self.read_bytes().is_some(),
            5 => {
                self.pos += 4;
                self.pos <= self.buf.len()
            }
            _ => false,
        }
    }
}

/// 分段弹幕响应（DmSegMobileReply）中的一条弹幕（DanmakuElem 关键字段）。
struct SegDanmakuElem {
    id: u64,
    progress_ms: i64,
    mode: i64,
    font_size: i64,
    color: i64,
    content: String,
    ctime: i64,
}

fn parse_dm_seg_reply(bytes: &[u8]) -> Result<Vec<SegDanmakuElem>, ()> {
    let mut reader = ProtoReader::new(bytes);
    let mut elems = Vec::new();
    while !reader.done() {
        let (field, wire) = reader.read_tag().ok_or(())?;
        if field == 1 && wire == 2 {
            // DmSegMobileReply.elems: repeated DanmakuElem
            let data = reader.read_bytes().ok_or(())?;
            if let Some(elem) = parse_danmaku_elem(data) {
                elems.push(elem);
            }
        } else if !reader.skip(wire) {
            return Err(());
        }
    }
    Ok(elems)
}

fn parse_danmaku_elem(bytes: &[u8]) -> Option<SegDanmakuElem> {
    let mut reader = ProtoReader::new(bytes);
    let mut elem = SegDanmakuElem {
        id: 0,
        progress_ms: 0,
        mode: 1,
        font_size: 25,
        color: 16_777_215,
        content: String::new(),
        ctime: 0,
    };
    while !reader.done() {
        let (field, wire) = reader.read_tag()?;
        match field {
            1 if wire == 0 => elem.id = reader.read_varint()?,
            2 if wire == 0 => elem.progress_ms = reader.read_varint()? as i64,
            3 if wire == 0 => elem.mode = reader.read_varint()? as i64,
            4 if wire == 0 => elem.font_size = reader.read_varint()? as i64,
            5 if wire == 0 => elem.color = reader.read_varint()? as i64,
            7 if wire == 2 => {
                let content = reader.read_bytes()?;
                elem.content = String::from_utf8_lossy(content).into_owned();
            }
            8 if wire == 0 => elem.ctime = reader.read_varint()? as i64,
            _ => {
                if !reader.skip(wire) {
                    return None;
                }
            }
        }
    }
    Some(elem)
}

fn danmaku_elem_to_item(elem: SegDanmakuElem) -> BiliDanmakuItem {
    let text = clean_text(&elem.content);
    BiliDanmakuItem {
        id: if elem.id != 0 {
            elem.id.to_string()
        } else {
            format!("seg-{}-{}-{}", elem.ctime, elem.progress_ms, text.len())
        },
        time: (elem.progress_ms as f64 / 1000.0).max(0.0),
        text,
        color: color_hex(elem.color as i32),
        mode: clamp_mode(elem.mode as i32),
        font_size: elem.font_size.max(1) as u32,
        timestamp: elem.ctime,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_message_rejects_blank_and_long_text() {
        assert!(normalize_message("   ".to_string()).is_err());
        assert!(normalize_message("x".repeat(101)).is_err());
    }

    #[test]
    fn normalize_message_trims_internal_whitespace() -> Result<(), BpiError> {
        assert_eq!(
            normalize_message("  hello\n  world  ".to_string())?,
            "hello world"
        );
        Ok(())
    }

    #[test]
    fn color_hex_clamps_to_rgb888() {
        assert_eq!(color_hex(16_777_215), "#FFFFFF");
        assert_eq!(color_hex(-1), "#000000");
        assert_eq!(color_hex(20_000_000), "#FFFFFF");
    }

    /// 构造 protobuf 编码的弹幕 elem，字段对齐 DanmakuElem。
    fn encode_elem(
        id: u64,
        progress_ms: i64,
        mode: i64,
        font_size: i64,
        color: i64,
        content: &str,
        ctime: i64,
    ) -> Vec<u8> {
        let mut out = Vec::new();
        fn varint(out: &mut Vec<u8>, value: u64) {
            let mut value = value;
            while value >= 0x80 {
                out.push((value as u8 & 0x7F) | 0x80);
                value >>= 7;
            }
            out.push(value as u8);
        }
        fn tag(out: &mut Vec<u8>, field: u32, wire: u8) {
            varint(out, (u64::from(field) << 3) | u64::from(wire));
        }
        fn field_varint(out: &mut Vec<u8>, field: u32, value: i64) {
            tag(out, field, 0);
            varint(out, value as u64);
        }
        fn field_bytes(out: &mut Vec<u8>, field: u32, value: &[u8]) {
            tag(out, field, 2);
            varint(out, value.len() as u64);
            out.extend_from_slice(value);
        }
        field_varint(&mut out, 1, id as i64);
        field_varint(&mut out, 2, progress_ms);
        field_varint(&mut out, 3, mode);
        field_varint(&mut out, 4, font_size);
        field_varint(&mut out, 5, color);
        field_bytes(&mut out, 7, content.as_bytes());
        field_varint(&mut out, 8, ctime);
        out
    }

    #[test]
    fn parse_dm_seg_reply_decodes_elems() {
        let mut reply = Vec::new();
        // DmSegMobileReply.elems: field 1, length-delimited
        varint_proto(&mut reply, (1_u64 << 3) | 2);
        let elem = encode_elem(42, 6_500, 2, 30, 0x00FF00, "顶部弹幕", 1_700_000_000);
        varint_proto(&mut reply, elem.len() as u64);
        reply.extend_from_slice(&elem);

        let elems = parse_dm_seg_reply(&reply).expect("should parse");
        assert_eq!(elems.len(), 1);
        assert_eq!(elems[0].id, 42);
        assert_eq!(elems[0].progress_ms, 6_500);
        assert_eq!(elems[0].mode, 2);
        assert_eq!(elems[0].font_size, 30);
        assert_eq!(elems[0].color, 0x00FF00);
        assert_eq!(elems[0].content, "顶部弹幕");
        assert_eq!(elems[0].ctime, 1_700_000_000);
    }

    fn varint_proto(out: &mut Vec<u8>, value: u64) {
        let mut value = value;
        while value >= 0x80 {
            out.push((value as u8 & 0x7F) | 0x80);
            value >>= 7;
        }
        out.push(value as u8);
    }

    #[test]
    fn parse_dm_seg_reply_tolerates_unknown_fields() {
        let mut reply = Vec::new();
        // 未知字段 field 99, wire 0
        varint_proto(&mut reply, (99_u64 << 3) | 0);
        varint_proto(&mut reply, 7);
        // 未知字段 field 50, wire 2
        varint_proto(&mut reply, (50_u64 << 3) | 2);
        varint_proto(&mut reply, 2);
        reply.extend_from_slice(&[0x41, 0x42]);
        // 一个合法 elem
        varint_proto(&mut reply, (1_u64 << 3) | 2);
        let elem = encode_elem(1, 1_000, 1, 25, 16_777_215, "hello", 100);
        varint_proto(&mut reply, elem.len() as u64);
        reply.extend_from_slice(&elem);

        let elems = parse_dm_seg_reply(&reply).expect("should parse");
        assert_eq!(elems.len(), 1);
        assert_eq!(elems[0].content, "hello");
    }

    #[test]
    fn parse_dm_seg_reply_rejects_garbage() {
        assert!(parse_dm_seg_reply(&[0xFF, 0xFF, 0xFF, 0xFF, 0xFF]).is_err());
        assert!(parse_dm_seg_reply(&[]).is_ok());
    }

    #[test]
    fn danmaku_elem_to_item_maps_fields() {
        let elem = SegDanmakuElem {
            id: 7,
            progress_ms: 12_345,
            mode: 3,
            font_size: 28,
            color: 0x0000FF,
            content: "  bottom  ".to_string(),
            ctime: 999,
        };
        let item = danmaku_elem_to_item(elem);
        assert_eq!(item.id, "7");
        assert_eq!(item.time, 12.345);
        assert_eq!(item.text, "bottom");
        assert_eq!(item.mode, 3);
        assert_eq!(item.font_size, 28);
        assert_eq!(item.color, "#0000FF");
        assert_eq!(item.timestamp, 999);
    }
}
