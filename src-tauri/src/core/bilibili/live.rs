//! Bilibili 直播：房间 / 流 / 推荐 / 分区 / 弹幕发送 / 心跳（P6）。

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use bpi_rs::{BpiClient, BpiError};

use super::models::{
    BiliLiveArea, BiliLiveQuality, BiliLiveRecommendPage, BiliLiveRecommendRoom, BiliLiveRoom,
    BiliLiveRoomPage, BiliLiveSendDanmakuResult, BiliLiveStream, BiliLiveStreamUrl,
    BiliLiveSubArea,
};

/// 直播推荐每页数量。
const RECOMMEND_PAGE_SIZE: i32 = 20;

/// 直播流代理登记上限（超出后清理最旧的一半）。
const STREAM_REGISTRY_LIMIT: usize = 128;

/// 登记过的直播流 URL（key → (url, created_at)）。浏览器无法直接拉 B 站直播 CDN
/// （Referer 校验 403），由本地代理转发；只代理登记过的 URL，符合代理安全原则。
static LIVE_STREAMS: OnceLock<Mutex<HashMap<String, (String, u64)>>> = OnceLock::new();

fn live_streams() -> &'static Mutex<HashMap<String, (String, u64)>> {
    LIVE_STREAMS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// 登记直播流 URL，返回本地代理地址（`/bilibili/live_stream/{key}`）。
pub fn register_proxied_stream(url: String, port: u16) -> Option<String> {
    use rand::Rng;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let nonce: u64 = rand::thread_rng().gen();
    let key = format!("ls{:016x}{:016x}", now, nonce);
    let mut registry = live_streams().lock().unwrap();
    registry.insert(key.clone(), (url, now));
    if registry.len() > STREAM_REGISTRY_LIMIT {
        let mut entries: Vec<(String, u64)> = registry
            .iter()
            .map(|(k, (_, ts))| (k.clone(), *ts))
            .collect();
        entries.sort_by_key(|(_, ts)| *ts);
        for (old_key, _) in entries.into_iter().take(STREAM_REGISTRY_LIMIT / 2) {
            registry.remove(&old_key);
        }
    }
    Some(format!(
        "http://127.0.0.1:{port}/bilibili/live_stream/{key}"
    ))
}

/// 取用登记的直播流 URL（代理 handler 用，取后移除防止复用旧线路）。
pub fn take_stream_url(key: &str) -> Option<String> {
    live_streams()
        .lock()
        .unwrap()
        .remove(key)
        .map(|(url, _)| url)
}

/// 直播间信息。
pub async fn room(client: &BpiClient, room_id: i64) -> Result<BiliLiveRoom, BpiError> {
    let data = client.live().room_info(room_id).await?;
    Ok(BiliLiveRoom {
        room_id: data.room_id,
        uid: data.uid,
        title: data.title,
        cover: data.user_cover,
        live_status: data.live_status,
        online: data.online,
        area_name: data.area_name,
        parent_area_name: data.parent_area_name,
        description: data.description,
        tags: data.tags,
        live_time: data.live_time,
        attention: data.attention,
    })
}

/// 直播流地址（可选 qn 画质）。
pub async fn stream(
    client: &BpiClient,
    room_id: i64,
    qn: Option<i32>,
) -> Result<BiliLiveStream, BpiError> {
    let data = client
        .live()
        .stream(room_id, Some("web"), Some(qn.unwrap_or(10000)), qn)
        .await?;
    Ok(BiliLiveStream {
        current_quality: data.current_quality,
        current_qn: data.current_qn,
        quality_description: data
            .quality_description
            .into_iter()
            .map(|q| BiliLiveQuality {
                qn: q.qn,
                desc: q.desc,
            })
            .collect(),
        durl: data
            .durl
            .into_iter()
            .map(|u| BiliLiveStreamUrl {
                url: u.url,
                order: u.order,
            })
            .collect(),
    })
}

/// 直播推荐（分页）。
pub async fn recommend(
    client: &BpiClient,
    page: Option<u32>,
) -> Result<BiliLiveRecommendPage, BpiError> {
    let data = client
        .live()
        .recommend_page(page.unwrap_or(1) as i32, RECOMMEND_PAGE_SIZE)
        .await?;
    Ok(BiliLiveRecommendPage {
        rooms: data
            .recommend_room_list
            .into_iter()
            .map(|room| BiliLiveRecommendRoom {
                room_id: room.roomid,
                uid: room.uid,
                title: room.title,
                cover: room.cover,
                uname: room.uname,
                face: room.face,
                online: room.online,
                area_name: room.area_v2_name,
                area_parent_name: room.area_v2_parent_name,
                status: room.status,
                followers: room.followers,
            })
            .collect(),
        top_room_id: data.top_room_id,
    })
}

/// 按分区获取直播房间列表（web second/getList；area_id=0 表示父分区全部）。
pub async fn room_list(
    client: &BpiClient,
    parent_area_id: u32,
    area_id: u32,
    page: Option<u32>,
) -> Result<BiliLiveRoomPage, BpiError> {
    let params = bpi_rs::live::room_list::LiveRoomListParams::new(parent_area_id, area_id)
        .page(page.unwrap_or(1))?;
    let data = client.live().room_list(params).await?;
    Ok(BiliLiveRoomPage {
        rooms: data
            .list
            .into_iter()
            .map(|room| BiliLiveRecommendRoom {
                room_id: room.roomid,
                uid: room.uid,
                title: room.title,
                cover: room.cover,
                uname: room.uname,
                face: room.face,
                online: room.online as i32,
                area_name: room.area_name,
                area_parent_name: room.parent_area_name,
                status: room.live_status == 1,
                followers: 0,
            })
            .collect(),
        count: data.count,
        has_more: data.has_more == 1,
    })
}

/// 直播分区列表。
pub async fn areas(client: &BpiClient) -> Result<Vec<BiliLiveArea>, BpiError> {
    let data = client.live().area_list().await?;
    Ok(data
        .into_iter()
        .map(|area| BiliLiveArea {
            id: area.id,
            name: area.name,
            children: area
                .list
                .into_iter()
                .map(|sub| BiliLiveSubArea {
                    id: sub.id.parse().unwrap_or(0),
                    name: sub.name,
                    pic: sub.pic,
                })
                .collect(),
        })
        .collect())
}

/// 发送直播间弹幕（需登录）。
pub async fn send_danmaku(
    client: &BpiClient,
    room_id: u64,
    text: &str,
) -> Result<BiliLiveSendDanmakuResult, BpiError> {
    client
        .live()
        .live_send_danmu(room_id, text, None, None)
        .await?;
    Ok(BiliLiveSendDanmakuResult {
        ok: true,
        message: String::new(),
    })
}

/// 直播心跳（HTTP 通道，配合 WS 协议 30s 心跳）。
pub async fn heartbeat(client: &BpiClient, room_id: u64) -> Result<(), BpiError> {
    let params = bpi_rs::live::report::LiveWebHeartBeatParams::new(room_id as i64)?;
    client.live().web_heart_beat(params).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn live_stream_registry_roundtrip() {
        let url = "https://example.com/live/flv?sign=1".to_string();
        let proxy_url = register_proxied_stream(url.clone(), 8899).expect("register");
        assert!(proxy_url.starts_with("http://127.0.0.1:8899/bilibili/live_stream/ls"));
        let key = proxy_url.rsplit('/').next().expect("key");
        assert_eq!(take_stream_url(key), Some(url));
        assert_eq!(take_stream_url(key), None);
    }

    #[test]
    fn live_stream_registry_cleans_old_entries() {
        for index in 0..(STREAM_REGISTRY_LIMIT + 20) {
            register_proxied_stream(format!("https://example.com/{index}"), 1);
        }
        let registry = live_streams().lock().unwrap();
        assert!(registry.len() <= STREAM_REGISTRY_LIMIT);
    }
}
