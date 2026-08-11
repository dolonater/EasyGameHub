use bpi_rs::danmaku::{DanmakuSendParams, DanmakuXmlListParams};
use bpi_rs::ids::{Aid, Bvid, Cid};
use bpi_rs::{BpiClient, BpiError};

use super::models::{BiliDanmakuItem, BiliOperationResult};

const VIDEO_DANMAKU_TYPE: u8 = 1;
const MAX_DANMAKU_MESSAGE_LEN: usize = 100;

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
) -> Result<BiliOperationResult, BpiError> {
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
    client.danmaku().send(params).await?;
    Ok(BiliOperationResult::ok("danmaku sent"))
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
}
