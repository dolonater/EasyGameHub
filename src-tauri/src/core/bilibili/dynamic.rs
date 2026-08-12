//! 动态流：关注流 / 详情 / 点赞 / 发布 / 置顶 / 转发列表 / 空间动态。
//!
//! bpi-rs 动态接口的 `modules` 字段为原始 JSON（对齐 wiliwili 的
//! DynamicArticleModule* 模型），这里把 modules 解析为统一的
//! [`BiliDynamicCard`] 四类卡片（视频/图文/直播/转发，纯文字降级 text）。

use bpi_rs::dynamic::{
    DynamicAllParams, DynamicDetailParams, DynamicForwardsParams, DynamicLikeParams,
    DynamicTextCreateParams, DynamicTopParams, SpaceDynamicParams,
};
use bpi_rs::ids::{DynamicId, Mid};
use bpi_rs::{BpiClient, BpiError};

use super::models::{
    BiliDynamicCard, BiliDynamicCreated, BiliDynamicForwardEntry, BiliDynamicForwardsPage,
    BiliDynamicLive, BiliDynamicPage, BiliDynamicVideo, BiliOperationResult,
};

/// 单页动态条数（bilibili-API-collect 建议值，配合 offset 游标翻页）。
const DYNAMIC_PAGE_SIZE: u32 = 20;

pub async fn dynamic_all(
    client: &BpiClient,
    offset: Option<String>,
    is_space: bool,
    host_mid: Option<u64>,
) -> Result<BiliDynamicPage, BpiError> {
    let mut params = DynamicAllParams::new();
    if let Some(offset) = offset {
        if !offset.trim().is_empty() {
            params = params.with_offset(offset)?;
        }
    }
    if is_space {
        let mid = host_mid.ok_or_else(|| BpiError::invalid_parameter("host_mid", "missing"))?;
        let space_params = SpaceDynamicParams::new(Mid::new(mid)?);
        let data = client.dynamic().space_dynamics(space_params).await?;
        return Ok(BiliDynamicPage {
            cards: data
                .items
                .into_iter()
                .map(|item| parse_dynamic_item(&item))
                .collect(),
            has_more: data.has_more,
            offset: data.offset,
        });
    }
    let data = client.dynamic().all(params).await?;
    Ok(BiliDynamicPage {
        cards: data
            .items
            .into_iter()
            .map(|item| parse_dynamic_item(&item))
            .collect(),
        has_more: data.has_more,
        offset: data.offset,
    })
}

pub async fn dynamic_detail(
    client: &BpiClient,
    dyn_id: String,
) -> Result<BiliDynamicCard, BpiError> {
    let id = DynamicId::new(dyn_id)?;
    let data = client
        .dynamic()
        .detail(DynamicDetailParams::new(id))
        .await?;
    let card = parse_detail_item(&data.item);
    Ok(card)
}

pub async fn dynamic_like(
    client: &BpiClient,
    dyn_id: String,
    like: bool,
) -> Result<BiliOperationResult, BpiError> {
    let params = DynamicLikeParams::new(dyn_id, if like { 1 } else { 2 })?;
    client.dynamic().like(params).await?;
    Ok(BiliOperationResult::ok("dynamic like updated"))
}

pub async fn dynamic_create_text(
    client: &BpiClient,
    content: String,
) -> Result<BiliDynamicCreated, BpiError> {
    let params = DynamicTextCreateParams::new(content)?;
    let data = client.dynamic().create_text(params).await?;
    let dyn_id = if data.dynamic_id != 0 {
        data.dynamic_id.to_string()
    } else {
        data.dynamic_id_str.clone()
    };
    Ok(BiliDynamicCreated::ok(dyn_id))
}

pub async fn dynamic_top(
    client: &BpiClient,
    dyn_id: String,
    top: bool,
) -> Result<BiliOperationResult, BpiError> {
    let params = DynamicTopParams::new(dyn_id)?;
    if top {
        client.dynamic().set_top(params).await?;
    } else {
        client.dynamic().remove_top(params).await?;
    }
    Ok(BiliOperationResult::ok("dynamic top updated"))
}

pub async fn dynamic_forwards(
    client: &BpiClient,
    dyn_id: String,
    offset: Option<String>,
) -> Result<BiliDynamicForwardsPage, BpiError> {
    let id = DynamicId::new(dyn_id)?;
    let mut params = DynamicForwardsParams::new(id);
    if let Some(offset) = offset {
        if !offset.trim().is_empty() {
            params = params.with_offset(offset)?;
        }
    }
    let data = client.dynamic().forwards(params).await?;
    Ok(BiliDynamicForwardsPage {
        entries: data
            .items
            .into_iter()
            .map(|item| BiliDynamicForwardEntry {
                dyn_id: item.id_str.clone(),
                pub_time: item.pub_time.clone(),
                name: item.user.name.clone(),
                face: item.user.face.clone(),
                content: item.desc.text.clone(),
            })
            .collect(),
        has_more: data.has_more,
        offset: data.offset,
    })
}

// -------------------
// modules 解析
// -------------------

fn parse_dynamic_item(item: &bpi_rs::dynamic::all::DynamicItem) -> BiliDynamicCard {
    parse_card(
        item.type_field.as_str(),
        &item.basic.comment_id_str,
        item.basic.comment_type,
        &item.basic.rid_str,
        &item.modules,
        item.visible,
    )
}

fn parse_detail_item(item: &bpi_rs::dynamic::detail::DynamicDetailItem) -> BiliDynamicCard {
    let mut card = parse_card(
        item.r#type.as_str(),
        &item.basic.comment_id_str,
        item.basic.comment_type,
        &item.basic.rid_str,
        &item.modules,
        item.visible,
    );
    // 详情接口带转发原文（orig），feed 里转发动态带 major.forward
    if card.forward.is_none() && item.orig.is_some() {
        if let Some(orig) = &item.orig {
            card.forward = Some(Box::new(parse_detail_item(orig)));
        }
    }
    card
}

fn parse_card(
    type_field: &str,
    comment_id: &str,
    comment_type: i64,
    rid_str: &str,
    modules: &serde_json::Value,
    visible: bool,
) -> BiliDynamicCard {
    let author = modules.get("module_author");
    let dynamic = modules.get("module_dynamic");
    let stat = modules.get("module_stat");
    let tag = modules.get("module_tag");

    let mut card = BiliDynamicCard {
        dyn_id: if comment_id.is_empty() {
            rid_str.to_string()
        } else {
            comment_id.to_string()
        },
        card_type: "text".to_string(),
        uid: json_i64(author, &["mid"]),
        name: json_str(author, &["name"]),
        face: json_str(author, &["face"]),
        pub_time: json_str(author, &["pub_time"]),
        content: json_str(dynamic, &["desc", "text"]),
        video: None,
        images: Vec::new(),
        live: None,
        forward: None,
        like_count: json_i64(stat, &["like", "count"]),
        liked: json_bool(stat, &["like", "like_state"]),
        forward_count: json_i64(stat, &["forward", "count"]),
        comment_count: json_i64(stat, &["comment", "count"]),
        comment_id: json_str(stat, &["comment", "comment_id"]),
        comment_type: json_i64(stat, &["comment", "comment_type"]),
        visible,
        is_top: !json_str(tag, &["text"]).is_empty()
            || json_bool(Some(modules), &["module_tag", "is_top"]),
    };

    match type_field {
        "DYNAMIC_TYPE_AV" => {
            card.card_type = "video".to_string();
            card.video = Some(parse_archive(json_at(dynamic, &["major", "archive"])));
        }
        "DYNAMIC_TYPE_DRAW" | "DYNAMIC_TYPE_OPUS_DRAW" | "DYNAMIC_TYPE_OPUS" => {
            card.card_type = "image".to_string();
            card.images = parse_draw_images(json_at(dynamic, &["major", "draw", "items"]));
            if card.images.is_empty() {
                card.images = parse_draw_images(json_at(dynamic, &["opus", "pics"]));
            }
            if card.content.is_empty() {
                card.content = json_str(dynamic, &["opus", "summary", "text"]);
            }
        }
        "DYNAMIC_TYPE_LIVE_RCMD" | "DYNAMIC_TYPE_LIVE" => {
            card.card_type = "live".to_string();
            card.live = Some(parse_live(json_at(dynamic, &["major", "live_play_info"])));
        }
        "DYNAMIC_TYPE_FORWARD" => {
            card.card_type = "forward".to_string();
            let forward = json_at(dynamic, &["major", "forward"]);
            let mut inner = BiliDynamicCard {
                dyn_id: json_str(Some(forward), &["id"]),
                card_type: "text".to_string(),
                uid: json_i64(Some(forward), &["user", "uid"]),
                name: json_str(Some(forward), &["user", "name"]),
                face: json_str(Some(forward), &["user", "face"]),
                pub_time: String::new(),
                content: json_str(Some(forward), &["desc", "text"]),
                video: None,
                images: Vec::new(),
                live: None,
                forward: None,
                like_count: 0,
                liked: false,
                forward_count: 0,
                comment_count: 0,
                comment_id: String::new(),
                comment_type: 0,
                visible: true,
                is_top: false,
            };
            let archives = json_at(Some(forward), &["archives"]);
            if !archives.as_array().map(Vec::is_empty).unwrap_or(true) {
                if let Some(archive) = archives.as_array().and_then(|list| list.first()) {
                    inner.card_type = "video".to_string();
                    inner.video = Some(parse_archive(archive));
                }
            }
            let pics = json_at(Some(forward), &["pics"]);
            if !pics.as_array().map(Vec::is_empty).unwrap_or(true) {
                inner.card_type = "image".to_string();
                inner.images = parse_draw_images(pics);
            }
            if inner.card_type == "text" && inner.content.is_empty() {
                inner.content = card.content.clone();
            }
            card.forward = Some(Box::new(inner));
        }
        _ => {
            // 纯文字/专栏/其他：text 卡片显示正文
            card.card_type = "text".to_string();
            if card.content.is_empty() {
                card.content = json_str(dynamic, &["desc", "text"]);
            }
        }
    }
    card
}

fn parse_archive(value: &serde_json::Value) -> BiliDynamicVideo {
    let stat = value.get("stat");
    BiliDynamicVideo {
        aid: json_i64(Some(value), &["aid"]),
        bvid: json_str(Some(value), &["bvid"]),
        cover: json_str(Some(value), &["cover"]),
        title: json_str(Some(value), &["title"]),
        duration_text: json_str(Some(value), &["duration_text"]),
        desc: json_str(Some(value), &["desc"]),
        play: json_i64(stat, &["play"]),
        danmaku: json_i64(stat, &["danmaku"]),
    }
}

fn parse_draw_images(value: &serde_json::Value) -> Vec<String> {
    match value.as_array() {
        Some(items) => items
            .iter()
            .filter_map(|item| {
                let src = item.get("src").and_then(serde_json::Value::as_str);
                src.map(str::to_string)
            })
            .collect(),
        None => Vec::new(),
    }
}

fn parse_live(value: &serde_json::Value) -> BiliDynamicLive {
    BiliDynamicLive {
        room_id: json_i64(Some(value), &["room_id"]),
        title: json_str(Some(value), &["title"]),
        cover: json_str(Some(value), &["cover"]),
        area_name: json_str(Some(value), &["area_name"]),
    }
}

/// 按路径取字符串（容错：缺失/null/非字符串 → 空串）。
fn json_str(root: Option<&serde_json::Value>, path: &[&str]) -> String {
    let mut node = root.unwrap_or(&serde_json::Value::Null);
    for key in path {
        node = node.get(*key).unwrap_or(&serde_json::Value::Null);
    }
    node.as_str().unwrap_or("").to_string()
}

fn json_i64(root: Option<&serde_json::Value>, path: &[&str]) -> i64 {
    let mut node = root.unwrap_or(&serde_json::Value::Null);
    for key in path {
        node = node.get(*key).unwrap_or(&serde_json::Value::Null);
    }
    node.as_i64().unwrap_or(0)
}

fn json_bool(root: Option<&serde_json::Value>, path: &[&str]) -> bool {
    let mut node = root.unwrap_or(&serde_json::Value::Null);
    for key in path {
        node = node.get(*key).unwrap_or(&serde_json::Value::Null);
    }
    node.as_bool().unwrap_or(false)
}

fn json_at<'a>(root: Option<&'a serde_json::Value>, path: &[&str]) -> &'a serde_json::Value {
    let mut node = root.unwrap_or(&serde_json::Value::Null);
    for key in path {
        node = node.get(*key).unwrap_or(&serde_json::Value::Null);
    }
    node
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn author() -> serde_json::Value {
        json!({
            "mid": 2084572,
            "name": "示例UP",
            "face": "https://face.example/a.jpg",
            "pub_time": "2024-03-10 12:00:00"
        })
    }

    #[test]
    fn parse_video_card() {
        let modules = json!({
            "module_author": author(),
            "module_dynamic": {
                "type": "DYNAMIC_TYPE_AV",
                "desc": {"text": "新视频"},
                "major": {
                    "type": "MAJOR_TYPE_ARCHIVE",
                    "archive": {
                        "aid": 1001, "bvid": "BV1xx", "cover": "c.jpg", "title": "T",
                        "duration_text": "10:30", "desc": "简介",
                        "stat": {"play": 100, "danmaku": 5}
                    }
                }
            },
            "module_stat": {
                "comment": {"count": 2, "comment_id": "c1", "comment_type": 11},
                "forward": {"count": 1},
                "like": {"count": 5, "like_state": true}
            }
        });
        let card = parse_card("DYNAMIC_TYPE_AV", "d1", 11, "0", &modules, true);
        assert_eq!(card.card_type, "video");
        assert_eq!(card.uid, 2084572);
        assert_eq!(card.name, "示例UP");
        assert_eq!(card.content, "新视频");
        let video = card.video.unwrap();
        assert_eq!(video.bvid, "BV1xx");
        assert_eq!(video.play, 100);
        assert_eq!(card.like_count, 5);
        assert!(card.liked);
        assert_eq!(card.comment_id, "c1");
        assert_eq!(card.comment_type, 11);
    }

    #[test]
    fn parse_draw_and_text_cards() {
        let draw = parse_card(
            "DYNAMIC_TYPE_DRAW",
            "d2",
            11,
            "0",
            &json!({
                "module_dynamic": {
                    "type": "DYNAMIC_TYPE_DRAW",
                    "major": {"type": "MAJOR_TYPE_DRAW", "draw": {"items": [{"src": "a.jpg"}, {"src": "b.jpg"}]}}
                }
            }),
            true,
        );
        assert_eq!(draw.card_type, "image");
        assert_eq!(draw.images, vec!["a.jpg", "b.jpg"]);

        let word = parse_card(
            "DYNAMIC_TYPE_WORD",
            "d3",
            11,
            "0",
            &json!({
                "module_dynamic": {
                    "type": "DYNAMIC_TYPE_WORD",
                    "desc": {"text": "今天天气不错"}
                }
            }),
            true,
        );
        assert_eq!(word.card_type, "text");
        assert_eq!(word.content, "今天天气不错");
    }

    #[test]
    fn parse_live_and_forward_cards() {
        let live = parse_card(
            "DYNAMIC_TYPE_LIVE_RCMD",
            "d4",
            11,
            "0",
            &json!({
                "module_dynamic": {
                    "type": "DYNAMIC_TYPE_LIVE_RCMD",
                    "major": {
                        "type": "MAJOR_TYPE_LIVE_RCMD",
                        "live_play_info": {"room_id": 123, "title": "在直播", "cover": "l.jpg", "area_name": "游戏"}
                    }
                }
            }),
            true,
        );
        assert_eq!(live.card_type, "live");
        assert_eq!(live.live.unwrap().room_id, 123);

        let forward = parse_card(
            "DYNAMIC_TYPE_FORWARD",
            "d5",
            11,
            "0",
            &json!({
                "module_dynamic": {
                    "type": "DYNAMIC_TYPE_FORWARD",
                    "desc": {"text": "转发一下"},
                    "major": {
                        "type": "MAJOR_TYPE_FORWARD",
                        "forward": {
                            "id": "o1", "uid": 999, "desc": {"text": "原动态文本"},
                            "user": {"uid": 999, "name": "原UP", "face": "f.jpg"},
                            "archives": [{"aid": 2002, "bvid": "BV2", "cover": "c2.jpg", "title": "原视频", "duration_text": "5:00", "desc": "", "stat": {"play": 1, "danmaku": 0}}]
                        }
                    }
                }
            }),
            true,
        );
        assert_eq!(forward.card_type, "forward");
        assert_eq!(forward.content, "转发一下");
        let inner = forward.forward.unwrap();
        assert_eq!(inner.card_type, "video");
        assert_eq!(inner.name, "原UP");
        assert_eq!(inner.video.unwrap().bvid, "BV2");
    }

    #[test]
    fn parse_card_tolerates_missing_modules() {
        let card = parse_card(
            "DYNAMIC_TYPE_AV",
            "d6",
            11,
            "0",
            &serde_json::Value::Null,
            true,
        );
        assert_eq!(card.card_type, "video");
        assert_eq!(card.uid, 0);
        // AV 类型固定挂 video（缺失时字段为空），容错不 panic
        assert_eq!(card.video.map(|video| video.aid), Some(0));
    }

    #[test]
    fn forwards_maps_entries() {
        let data = json!({
            "items": [
                {"id_str": "f1", "pub_time": "2024-03-10 12:00:00", "user": {"name": "甲", "face": "a.jpg"}, "desc": {"text": "转发内容"}}
            ]
        });
        let items: Vec<BiliDynamicForwardEntry> = serde_json::from_value(data)
            .map(|d: serde_json::Value| {
                d["items"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|item| BiliDynamicForwardEntry {
                        dyn_id: item["id_str"].as_str().unwrap_or("").to_string(),
                        pub_time: item["pub_time"].as_str().unwrap_or("").to_string(),
                        name: item["user"]["name"].as_str().unwrap_or("").to_string(),
                        face: item["user"]["face"].as_str().unwrap_or("").to_string(),
                        content: item["desc"]["text"].as_str().unwrap_or("").to_string(),
                    })
                    .collect()
            })
            .unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].name, "甲");
        assert_eq!(items[0].content, "转发内容");
    }
}
