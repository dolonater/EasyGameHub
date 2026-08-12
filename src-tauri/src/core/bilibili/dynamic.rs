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
    let mut card = parse_card(
        item.type_field.as_str(),
        &item.basic.comment_id_str,
        item.basic.comment_type,
        &item.basic.rid_str,
        &item.modules,
        item.visible,
        item.basic.comment_id_str.parse().unwrap_or(0),
    );
    // dyn_id 一律用 id_str（basic.comment_id_str 是评论 id 不是动态 id）
    card.dyn_id = item.id_str.clone();
    // feed 接口转发动态带 orig（完整原文）优先于 major.forward 简化结构
    if let Some(orig) = &item.orig {
        card.forward = Some(Box::new(parse_dynamic_item(orig)));
    }
    card
}

fn parse_detail_item(item: &bpi_rs::dynamic::detail::DynamicDetailItem) -> BiliDynamicCard {
    let mut card = parse_card(
        item.r#type.as_str(),
        &item.basic.comment_id_str,
        item.basic.comment_type,
        &item.basic.rid_str,
        &item.modules,
        item.visible,
        item.basic.comment_id_str.parse().unwrap_or(0),
    );
    card.dyn_id = item.id_str.clone();
    // 详情接口带转发原文（orig）优先于 major.forward 简化结构
    if let Some(orig) = &item.orig {
        card.forward = Some(Box::new(parse_detail_item(orig)));
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
    basic_comment_id: i64,
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
        // 评论 id/type 优先取 basic（图片动态 opus 体系必需），回退 module_stat
        comment_id: if comment_id.is_empty() {
            json_str(stat, &["comment", "comment_id"])
        } else {
            comment_id.to_string()
        },
        comment_type: if comment_type != 0 {
            comment_type
        } else {
            json_i64(stat, &["comment", "comment_type"])
        },
        visible,
        is_top: !json_str(tag, &["text"]).is_empty()
            || json_bool(Some(modules), &["module_tag", "is_top"]),
        article_id: 0,
        title: String::new(),
    };

    match type_field {
        "DYNAMIC_TYPE_AV" => {
            card.card_type = "video".to_string();
            card.video = Some(parse_archive(json_at(dynamic, &["major", "archive"])));
        }
        "DYNAMIC_TYPE_DRAW" | "DYNAMIC_TYPE_OPUS_DRAW" | "DYNAMIC_TYPE_OPUS" => {
            card.images = parse_draw_images(json_at(dynamic, &["major", "draw", "items"]));
            if card.images.is_empty() {
                card.images = parse_draw_images(json_at(dynamic, &["major", "opus", "pics"]));
            }
            if card.images.is_empty() {
                card.images = parse_draw_images(json_at(dynamic, &["opus", "pics"]));
            }
            if !card.images.is_empty() {
                // 图文动态：image 卡片
                card.card_type = "image".to_string();
            } else if type_field == "DYNAMIC_TYPE_OPUS" {
                // 无图 opus = 专栏/文字动态（转发专栏的 orig 即此形态）→ article 卡片，
                // articleId 由 comment_id_str 兜底（转发原文的 rid 即 cvid）
                card.card_type = "article".to_string();
                card.article_id = basic_comment_id;
                card.title = json_str(dynamic, &["major", "opus", "title"]);
                let opus_summary = json_str(dynamic, &["major", "opus", "summary", "text"]);
                if !opus_summary.is_empty() {
                    card.content = opus_summary;
                } else {
                    card.content = json_str(dynamic, &["opus", "summary", "text"]);
                }
                if card.content.is_empty() {
                    card.content = json_str(dynamic, &["desc", "text"]);
                }
            } else {
                card.card_type = "image".to_string();
            }
            if card.content.is_empty() {
                card.content = json_str(dynamic, &["major", "opus", "summary", "text"]);
            }
            if card.content.is_empty() {
                card.content = json_str(dynamic, &["opus", "summary", "text"]);
            }
        }
        // 专栏动态（MAJOR_TYPE_ARTICLE / 关注流 opus 结构）：articleId 即 cvid、title、desc、covers
        "DYNAMIC_TYPE_ARTICLE" => {
            card.card_type = "article".to_string();
            let article = json_at(dynamic, &["major", "article"]);
            if article.is_null() {
                // 关注流接口为 opus 结构（major.opus）：title/summary/pics，无 cvid（由 comment_id_str 兜底）
                card.article_id = basic_comment_id;
                card.title = json_str(dynamic, &["major", "opus", "title"]);
                card.images = parse_draw_images(json_at(dynamic, &["major", "opus", "pics"]));
                let opus_summary = json_str(dynamic, &["major", "opus", "summary", "text"]);
                if !opus_summary.is_empty() {
                    card.content = opus_summary;
                } else {
                    card.content = json_str(dynamic, &["opus", "summary", "text"]);
                }
                if card.content.is_empty() {
                    card.content = json_str(dynamic, &["desc", "text"]);
                }
            } else {
                card.article_id = json_i64(dynamic, &["major", "article", "id"]);
                card.title = json_str(dynamic, &["major", "article", "title"]);
                card.images = json_str_array(json_at(dynamic, &["major", "article", "covers"]));
                if card.content.is_empty() {
                    card.content = json_str(dynamic, &["major", "article", "desc"]);
                }
                if card.content.is_empty() {
                    card.content = json_str(dynamic, &["desc", "text"]);
                }
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
                article_id: 0,
                title: String::new(),
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
                // draw.items 用 src，opus.pics 用 url
                let src = item
                    .get("src")
                    .and_then(serde_json::Value::as_str)
                    .or_else(|| item.get("url").and_then(serde_json::Value::as_str));
                src.map(str::to_string)
            })
            .collect(),
        None => Vec::new(),
    }
}

/// 字符串数组（major.article.covers 等）。
fn json_str_array(value: &serde_json::Value) -> Vec<String> {
    match value.as_array() {
        Some(items) => items
            .iter()
            .filter_map(serde_json::Value::as_str)
            .map(str::to_string)
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
        let card = parse_card("DYNAMIC_TYPE_AV", "d1", 11, "0", &modules, true, 0);
        assert_eq!(card.card_type, "video");
        assert_eq!(card.uid, 2084572);
        assert_eq!(card.name, "示例UP");
        assert_eq!(card.content, "新视频");
        let video = card.video.unwrap();
        assert_eq!(video.bvid, "BV1xx");
        assert_eq!(video.play, 100);
        assert_eq!(card.like_count, 5);
        assert!(card.liked);
        // 评论 id/type 优先取 basic（图片动态 opus 体系必需），回退 module_stat
        assert_eq!(card.comment_id, "d1");
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
            0,
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
            0,
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
            0,
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
            0,
        );
        assert_eq!(forward.card_type, "forward");
        assert_eq!(forward.content, "转发一下");
        let inner = forward.forward.unwrap();
        assert_eq!(inner.card_type, "video");
        assert_eq!(inner.name, "原UP");
        assert_eq!(inner.video.unwrap().bvid, "BV2");
    }

    #[test]
    fn parse_article_dynamic_with_opus_major() {
        // 关注流（feed/all）专栏动态：DYNAMIC_TYPE_ARTICLE + major.opus（无 major.article）
        let modules = json!({
            "module_author": author(),
            "module_dynamic": {
                "type": "DYNAMIC_TYPE_ARTICLE",
                "desc": {"text": "分享专栏"},
                "major": {
                    "type": "MAJOR_TYPE_OPUS",
                    "opus": {
                        "id": 533433825771917183_i64,
                        "title": "我在B站写高考作文 - 2021",
                        "summary": {"text": "2021高考季，哔哩哔哩专栏邀你一起"},
                        "pics": []
                    }
                }
            }
        });
        let card = parse_card(
            "DYNAMIC_TYPE_ARTICLE",
            "11609866",
            12,
            "11609866",
            &modules,
            true,
            11609866,
        );
        assert_eq!(card.card_type, "article");
        assert_eq!(card.article_id, 11609866);
        assert_eq!(card.title, "我在B站写高考作文 - 2021");
        assert_eq!(card.content, "2021高考季，哔哩哔哩专栏邀你一起");
    }

    #[test]
    fn parse_feed_forward_with_orig_article() {
        // feed/all 转发动态：orig 完整原文（专栏 opus）优先于 major.forward
        let item = serde_json::from_value::<bpi_rs::dynamic::all::DynamicItem>(json!({
            "basic": {"comment_id_str": "fwd1", "comment_type": 12, "rid_str": "fwd1", "like_icon": {}},
            "id_str": "fwd1",
            "type": "DYNAMIC_TYPE_FORWARD",
            "visible": true,
            "modules": {
                "module_author": {"mid": 1, "name": "转发者", "face": "f.jpg", "pub_time": "2024-03-10 12:00:00"},
                "module_dynamic": {
                    "type": "DYNAMIC_TYPE_FORWARD",
                    "desc": {"text": "直接在初版的专栏上修改的"},
                    "major": {
                        "type": "MAJOR_TYPE_FORWARD",
                        "forward": {"id": "o1", "desc": {"text": "原动态文案"}, "user": {"uid": 2, "name": "原UP", "face": "f2.jpg"}}
                    }
                },
                "module_stat": {"like": {"count": 1, "like_state": false}, "forward": {"count": 0}, "comment": {"count": 0}}
            },
            "orig": {
                "basic": {"comment_id_str": "11609866", "comment_type": 12, "rid_str": "11609866", "like_icon": {}},
                "id_str": "o1",
                "type": "DYNAMIC_TYPE_OPUS",
                "visible": true,
                "modules": {
                    "module_author": {"mid": 2, "name": "原UP", "face": "f2.jpg", "pub_time": "2024-03-10 11:00:00"},
                    "module_dynamic": {
                        "type": "DYNAMIC_TYPE_OPUS",
                        "desc": {"text": "分享专栏"},
                        "major": {
                            "type": "MAJOR_TYPE_OPUS",
                            "opus": {
                                "id": 533433825771917183_i64,
                                "title": "我在B站写高考作文 - 2021",
                                "summary": {"text": "2021高考季，哔哩哔哩专栏邀你一起"},
                                "pics": []
                            }
                        }
                    },
                    "module_stat": {"like": {"count": 1672, "like_state": false}, "forward": {"count": 124}, "comment": {"count": 675, "comment_id": "11609866", "comment_type": 12}}
                }
            }
        })).expect("parse item");
        let card = parse_dynamic_item(&item);
        assert_eq!(card.card_type, "forward");
        let inner = card.forward.expect("inner");
        assert_eq!(inner.card_type, "article");
        assert_eq!(inner.article_id, 11609866);
        assert_eq!(inner.title, "我在B站写高考作文 - 2021");
        assert_eq!(inner.content, "2021高考季，哔哩哔哩专栏邀你一起");
    }

    #[test]
    fn parse_real_opus_draw() {
        // 真实响应结构（用户 log.txt）：图片动态 = DYNAMIC_TYPE_DRAW + module_dynamic.major.opus
        let item = serde_json::from_value::<bpi_rs::dynamic::detail::DynamicDetailItem>(json!({
            "id_str": "1235346999402823705",
            "basic": {"comment_id_str": "405151925", "comment_type": 11, "rid_str": "405151925", "like_icon": {}},
            "type": "DYNAMIC_TYPE_DRAW",
            "visible": true,
            "modules": {
                "module_author": {"mid": 2860983, "name": "咖喱FPS", "face": "https://f.jpg", "pub_time": "2026年08月12日 00:17"},
                "module_dynamic": {
                    "desc": null,
                    "major": {
                        "type": "MAJOR_TYPE_OPUS",
                        "opus": {
                            "pics": [
                                {"url": "http://i0.hdslb.com/bfs/new_dyn/1.webp", "width": 3641, "height": 2048},
                                {"url": "http://i0.hdslb.com/bfs/new_dyn/2.webp", "width": 3641, "height": 2048}
                            ],
                            "summary": {"text": "星际公民超重甲捆绑包，明天上号试试看[吃瓜]"},
                            "title": null
                        }
                    }
                },
                "module_stat": {
                    "comment": {"count": 10},
                    "forward": {"count": 1},
                    "like": {"count": 230, "status": false}
                }
            }
        })).expect("detail item should deserialize");

        let card = parse_detail_item(&item);
        assert_eq!(card.dyn_id, "1235346999402823705");
        assert_eq!(card.card_type, "image");
        assert_eq!(card.images.len(), 2);
        assert!(card.images[0].contains("1.webp"));
        assert_eq!(card.content, "星际公民超重甲捆绑包，明天上号试试看[吃瓜]");
        // 图片动态（opus）评论体系：oid=basic.comment_id_str、type=basic.comment_type
        assert_eq!(card.comment_id, "405151925");
        assert_eq!(card.comment_type, 11);
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
            0,
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
