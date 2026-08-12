//! 直播分区房间列表（web 端 second/getList）。
//!
//! [查看 API 文档](https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/live/video_area_list.md)
use serde::{Deserialize, Serialize};

use crate::{BpiError, BpiResult};

pub(crate) const ROOM_LIST_ENDPOINT: &str =
    "https://api.live.bilibili.com/xlive/web-interface/v1/second/getList";

fn validate_positive(field: &'static str, value: u32) -> BpiResult<u32> {
    if value == 0 {
        return Err(BpiError::invalid_parameter(field, "value must be non-zero"));
    }
    Ok(value)
}

/// 分区房间列表查询参数。
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LiveRoomListParams {
    /// 父分区 id（全站用 0；具体分区必填）
    pub parent_area_id: u32,
    /// 子分区 id（0 = 父分区下全部）
    pub area_id: u32,
    pub page: u32,
    pub page_size: u32,
    pub sort_type: String,
}

impl LiveRoomListParams {
    pub fn new(parent_area_id: u32, area_id: u32) -> Self {
        Self {
            parent_area_id,
            area_id,
            page: 1,
            page_size: 30,
            sort_type: "online".to_string(),
        }
    }

    pub fn page(mut self, page: u32) -> BpiResult<Self> {
        self.page = validate_positive("page", page)?;
        Ok(self)
    }

    pub fn page_size(mut self, page_size: u32) -> BpiResult<Self> {
        self.page_size = validate_positive("page_size", page_size)?;
        Ok(self)
    }
}

/// 分区房间列表响应。
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LiveRoomListData {
    /// 当前分区在线房间总数
    pub count: u64,
    pub list: Vec<LiveRoomListItem>,
    pub has_more: u8,
}

/// 分区房间（web second/getList 房间字段）。
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LiveRoomListItem {
    pub roomid: i64,
    pub uid: i64,
    pub title: String,
    pub uname: String,
    pub online: i64,
    #[serde(default)]
    pub cover: String,
    #[serde(rename = "user_cover", default)]
    pub user_cover: String,
    #[serde(default)]
    pub face: String,
    #[serde(rename = "area_id")]
    pub area_id: i64,
    #[serde(rename = "area_name", default)]
    pub area_name: String,
    #[serde(rename = "parent_area_id")]
    pub parent_area_id: i64,
    #[serde(rename = "parent_area_name", default)]
    pub parent_area_name: String,
    #[serde(rename = "live_status")]
    pub live_status: i32,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::probe::contract::HttpMethod;
    use crate::probe::endpoint_contract::EndpointContract;
    use crate::{ApiEnvelope, BpiClient, BpiError, BpiResult};
    use tracing::info;

    fn contract() -> BpiResult<EndpointContract> {
        EndpointContract::from_slice(include_bytes!(
            "../../tests/contracts/live/room-list/contract.json"
        ))
    }

    #[test]
    fn room_list_contract_matches_endpoint_request() -> BpiResult<()> {
        let contract = contract()?;
        let params = LiveRoomListParams::new(1, 0);

        assert_eq!(contract.name, "live.room_list");
        assert_eq!(contract.request.url.as_str(), ROOM_LIST_ENDPOINT);
        assert_eq!(contract.request.method, HttpMethod::Get);
        assert!(!contract.request.auth.requires_wbi());
        assert_eq!(
            contract.request.query.get("parent_area_id").map(String::as_str),
            Some("1")
        );
        assert_eq!(
            contract.request.query.get("area_id").map(String::as_str),
            Some("0")
        );
        assert_eq!(
            contract.request.query.get("page").map(String::as_str),
            Some("1")
        );
        assert_eq!(
            contract.request.query.get("page_size").map(String::as_str),
            Some("30")
        );
        assert_eq!(
            contract.request.query.get("sort_type").map(String::as_str),
            Some("online")
        );
        assert!(contract.cases.iter().all(|case| case.response.api_code == Some(0)));
        Ok(())
    }

    #[test]
    fn room_list_fixtures_parse_declared_model() -> BpiResult<()> {
        let payload = ApiEnvelope::<LiveRoomListData>::from_slice(include_bytes!(
            "../../tests/contracts/live/room-list/responses/success.json"
        ))?
        .into_payload()?;

        assert!(payload.count > 0);
        let first = payload.list.first().ok_or_else(|| {
            BpiError::unsupported_response("fixture should contain at least one room")
        })?;
        assert!(first.roomid > 0);
        info!("分区房间示例: {} {}", first.uname, first.title);
        Ok(())
    }

    #[ignore = "legacy live API test; requires explicit BPI_LIVE_TEST review"]
    #[tokio::test]
    async fn test_live_room_list_by_parent_area() -> Result<(), BpiError> {
        let bpi = BpiClient::new().expect("client should build");
        let params = LiveRoomListParams::new(1, 0).page(1)?;
        let data = bpi.live().room_list(params).await?;
        info!("动画分区房间数: {}", data.count);
        assert!(data.list.iter().all(|room| room.parent_area_id == 1));
        Ok(())
    }

}
