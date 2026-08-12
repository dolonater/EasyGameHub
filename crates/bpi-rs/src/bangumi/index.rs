//! 番剧/影视全量列表（pgc season index）。
//!
//! [查看 API 文档](https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/pgc/index.md)
use serde::{Deserialize, Serialize};

use crate::bangumi::tab::PgcScore;
use crate::{BpiError, BpiResult};

pub(crate) const PGC_INDEX_ENDPOINT: &str = "https://api.bilibili.com/pgc/season/index/result";

/// PGC 列表查询参数。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PgcIndexParams {
    /// Season 类型（1=番剧 2=电影 3=纪录片 4=国创 5=电视剧 7=综艺）。
    pub season_type: u32,
    /// 排序：0=最热 1=最新 2=开播时间。
    pub order: u32,
    /// -1=全部 0=未完结 1=已完结。
    pub is_finish: i32,
    pub page: u32,
    pub pagesize: u32,
}

impl PgcIndexParams {
    pub fn new(season_type: u32) -> BpiResult<Self> {
        if season_type == 0 {
            return Err(BpiError::invalid_parameter(
                "season_type",
                "value must be non-zero",
            ));
        }
        Ok(Self {
            season_type,
            order: 0,
            is_finish: -1,
            page: 1,
            pagesize: 30,
        })
    }

    pub fn order(mut self, order: u32) -> Self {
        self.order = order;
        self
    }

    pub fn is_finish(mut self, is_finish: i32) -> Self {
        self.is_finish = is_finish;
        self
    }

    pub fn page(mut self, page: u32) -> BpiResult<Self> {
        self.page = validate_positive("page", page)?;
        Ok(self)
    }
}

/// PGC 列表响应。
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PgcIndexData {
    #[serde(default)]
    pub list: Vec<PgcIndexItem>,
    #[serde(rename = "has_next", default)]
    pub has_next: bool,
}

/// PGC 列表条目。
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PgcIndexItem {
    #[serde(default)]
    pub season_id: i64,
    #[serde(default)]
    pub season_type: i64,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub cover: String,
    #[serde(rename = "index_show", default)]
    pub index_show: String,
    #[serde(default)]
    pub score: Option<PgcScore>,
}

fn validate_positive(field: &'static str, value: u32) -> BpiResult<u32> {
    if value == 0 {
        return Err(BpiError::invalid_parameter(field, "value must be non-zero"));
    }
    Ok(value)
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
            "../../tests/contracts/pgc/index/contract.json"
        ))
    }

    #[test]
    fn pgc_index_contract_matches_endpoint_request() -> BpiResult<()> {
        let contract = contract()?;
        let params = PgcIndexParams::new(1)?.order(0).is_finish(-1);

        assert_eq!(contract.name, "pgc.index");
        assert_eq!(contract.request.method, HttpMethod::Get);
        assert_eq!(contract.request.url.as_str(), PGC_INDEX_ENDPOINT);
        assert!(!contract.request.auth.requires_wbi());
        assert_eq!(
            contract.request.query.get("season_type").map(String::as_str),
            Some("1")
        );
        assert_eq!(
            contract.request.query.get("order").map(String::as_str),
            Some("0")
        );
        assert_eq!(
            contract.request.query.get("is_finish").map(String::as_str),
            Some("-1")
        );
        assert_eq!(
            contract.request.query.get("page").map(String::as_str),
            Some("1")
        );
        assert_eq!(
            contract.request.query.get("pagesize").map(String::as_str),
            Some("30")
        );
        assert!(contract.cases.iter().all(|case| case.response.api_code == Some(0)));
        Ok(())
    }

    #[test]
    fn pgc_index_fixtures_parse_declared_model() -> BpiResult<()> {
        let payload = ApiEnvelope::<PgcIndexData>::from_slice(include_bytes!(
            "../../tests/contracts/pgc/index/responses/success.json"
        ))?
        .into_payload()?;

        assert!(!payload.list.is_empty());
        let first = payload.list.first().ok_or_else(|| {
            BpiError::unsupported_response("fixture should contain at least one season")
        })?;
        assert!(first.season_id > 0);
        info!("PGC 列表示例: {} score={:?}", first.title, first.score);
        Ok(())
    }

    #[ignore = "legacy live API test; requires explicit BPI_LIVE_TEST review"]
    #[tokio::test]
    async fn test_pgc_index_bangumi() -> Result<(), BpiError> {
        let bpi = BpiClient::new().expect("client should build");
        let params = PgcIndexParams::new(1)?.page(1)?;
        let data = bpi.bangumi().season_index(params).await?;
        info!("番剧列表数量: {}", data.list.len());
        assert!(!data.list.is_empty());
        Ok(())
    }
}
