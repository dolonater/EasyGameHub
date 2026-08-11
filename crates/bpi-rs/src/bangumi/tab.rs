//! 追番/影视页与 PGC 排行榜
//!
//! [查看 API 文档](https://github.com/Yuelioi/bilibili-API-collect/tree/cfc5fddcc8a94b74d91970bb5b4eaeb349addc47/docs/bangumi)
//! * 追番页: `/pgc/page/pc/bangumi/tab`
//! * 影视页: `/pgc/page/pc/cinema/tab`
//! * PGC 榜: `/pgc/season/rank/web/list`

use serde::{Deserialize, Serialize};

use crate::BilibiliRequest;
use crate::probe::contract::HttpMethod;
use crate::probe::endpoint_contract::EndpointContract;
use crate::response::BpiResult;

const BANGUMI_TAB_ENDPOINT: &str = "https://api.bilibili.com/pgc/page/pc/bangumi/tab";
const CINEMA_TAB_ENDPOINT: &str = "https://api.bilibili.com/pgc/page/pc/cinema/tab";
const SEASON_RANK_ENDPOINT: &str = "https://api.bilibili.com/pgc/season/rank/web/list";

/// 追番/影视页聚合数据：按模块（分区行）组织。
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PgcTabData {
    /// 模块列表（番剧推荐/国创推荐/猜你喜欢 或 正在热播/电影/电视剧/…）
    pub modules: Vec<PgcModule>,
}

/// 追番/影视页中的一个分区行模块。
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PgcModule {
    /// 分区标题。
    #[serde(default)]
    pub title: String,
    /// 样式标记：`double_feed`（猜你喜欢，横图可分页）/ `follow`（横图）/ 其他（竖图）。
    #[serde(default)]
    pub style: String,
    /// 该分区下的番剧/影视条目。
    #[serde(default)]
    pub items: Vec<PgcItem>,
}

/// 追番/影视页中的单个番剧/影视条目。
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PgcItem {
    /// Season ID。
    #[serde(default)]
    pub season_id: i64,
    /// Season 类型（1=番剧 2=电影 3=纪录片 4=国创 5=电视剧 7=综艺）。
    #[serde(default)]
    pub season_type: i64,
    /// 标题。
    #[serde(default)]
    pub title: String,
    /// 封面 URL（兼容竖图 cover 与横图字段）。
    #[serde(default, alias = "ss_horizontal_cover", alias = "cover43")]
    pub cover: String,
    /// 最新一集摘要。
    #[serde(default)]
    pub new_ep: Option<PgcNewEp>,
    /// 评分（可能缺失）。
    #[serde(default)]
    pub score: Option<PgcScore>,
}

/// 最新一集摘要。
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PgcNewEp {
    /// 集数文案，如 "第1话"。
    #[serde(default)]
    pub index_show: String,
    /// 分集长标题。
    #[serde(default)]
    pub long_title: String,
    /// 分集标题。
    #[serde(default)]
    pub title: String,
}

/// 评分信息。
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PgcScore {
    /// 评分文本，如 "9.7"。
    #[serde(default)]
    pub score: String,
    /// 评分人数。
    #[serde(default)]
    pub user_count: i64,
}

/// PGC 排行榜参数。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PgcRankParams {
    season_type: u32,
}

impl PgcRankParams {
    /// 创建 PGC 榜查询参数。
    pub fn new(season_type: u32) -> BpiResult<Self> {
        if season_type == 0 {
            return Err(crate::BpiError::invalid_parameter(
                "season_type",
                "season type must be non-zero",
            ));
        }
        Ok(Self { season_type })
    }

    pub(crate) fn query_pairs(&self) -> Vec<(&'static str, String)> {
        vec![("type", self.season_type.to_string())]
    }
}

/// PGC 排行榜数据。
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PgcRankData {
    /// 榜单条目列表。
    #[serde(default)]
    pub list: Vec<PgcRankItem>,
}

/// PGC 排行榜中的单个条目。
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PgcRankItem {
    /// Season ID。
    #[serde(default)]
    pub season_id: i64,
    /// Season 类型。
    #[serde(default)]
    pub season_type: i64,
    /// 标题。
    #[serde(default)]
    pub title: String,
    /// 封面 URL（兼容横图字段）。
    #[serde(default, alias = "ss_horizontal_cover", alias = "cover43")]
    pub cover: String,
    /// 最新一集摘要。
    #[serde(default)]
    pub new_ep: Option<PgcNewEp>,
    /// 评分（可能缺失）。
    #[serde(default)]
    pub score: Option<PgcScore>,
}

impl<'a> super::BangumiClient<'a> {
    /// 获取追番页聚合数据（番剧推荐/国创推荐/猜你喜欢）。
    pub async fn bangumi_tab(&self) -> BpiResult<PgcTabData> {
        self.client
            .get(BANGUMI_TAB_ENDPOINT)
            .send_bpi_payload("bangumi.bangumi_tab")
            .await
    }

    /// 获取影视页聚合数据（正在热播/电影/电视剧/纪录片/综艺/猜你喜欢）。
    pub async fn cinema_tab(&self) -> BpiResult<PgcTabData> {
        self.client
            .get(CINEMA_TAB_ENDPOINT)
            .send_bpi_payload("bangumi.cinema_tab")
            .await
    }

    /// 获取 PGC 排行榜（番剧/国创/电影/电视剧/纪录片/综艺 分榜）。
    pub async fn season_rank(&self, params: PgcRankParams) -> BpiResult<PgcRankData> {
        self.client
            .get(SEASON_RANK_ENDPOINT)
            .query(&params.query_pairs())
            .send_bpi_payload("bangumi.season_rank")
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::BpiClient;
    use crate::BpiError;
    use crate::bangumi::BangumiClient;

    fn contract(name: &str) -> BpiResult<EndpointContract> {
        let bytes = match name {
            "bangumi-tab" => {
                include_bytes!("../../tests/contracts/bangumi/tab/bangumi-tab/contract.json")
                    .as_slice()
            }
            "cinema-tab" => {
                include_bytes!("../../tests/contracts/bangumi/tab/cinema-tab/contract.json")
                    .as_slice()
            }
            "season-rank" => {
                include_bytes!("../../tests/contracts/bangumi/tab/season-rank/contract.json")
                    .as_slice()
            }
            _ => unreachable!("unknown bangumi tab contract"),
        };
        EndpointContract::from_slice(bytes)
    }

    #[test]
    fn pgc_rank_params_serializes_type() -> Result<(), BpiError> {
        let params = PgcRankParams::new(1)?;
        assert_eq!(params.query_pairs(), vec![("type", "1".to_string())]);
        Ok(())
    }

    #[test]
    fn pgc_rank_params_rejects_zero_type() {
        let err = PgcRankParams::new(0).unwrap_err();
        assert!(matches!(err, BpiError::InvalidParameter { .. }));
    }

    #[test]
    fn bangumi_tab_contract_matches_request() {
        let contract = contract("bangumi-tab").expect("contract should parse");
        assert_eq!(contract.name, "bangumi.bangumi_tab");
        assert_eq!(contract.request.method, HttpMethod::Get);
        assert_eq!(
            contract.request.url.as_str(),
            "https://api.bilibili.com/pgc/page/pc/bangumi/tab"
        );
    }

    #[test]
    fn cinema_tab_contract_matches_request() {
        let contract = contract("cinema-tab").expect("contract should parse");
        assert_eq!(contract.name, "bangumi.cinema_tab");
        assert_eq!(
            contract.request.url.as_str(),
            "https://api.bilibili.com/pgc/page/pc/cinema/tab"
        );
    }

    #[test]
    fn season_rank_contract_matches_request() {
        let contract = contract("season-rank").expect("contract should parse");
        assert_eq!(contract.name, "bangumi.season_rank");
        assert_eq!(
            contract.request.url.as_str(),
            "https://api.bilibili.com/pgc/season/rank/web/list"
        );
    }

    #[test]
    fn pgc_module_deserializes_minimal_item() {
        let json = r#"{"modules":[{"title":"番剧推荐","style":"double_feed","items":[{"season_id":1172,"season_type":1,"title":"测试","cover":"https://i0.hdslb.com/x.jpg","new_ep":{"index_show":"第1话"},"score":{"score":"9.7","user_count":100}}]}]}"#;
        let data: PgcTabData = serde_json::from_str(json).expect("parse should succeed");
        assert_eq!(data.modules.len(), 1);
        assert_eq!(data.modules[0].style, "double_feed");
        let item = &data.modules[0].items[0];
        assert_eq!(item.season_id, 1172);
        assert_eq!(
            item.new_ep.as_ref().map(|ep| ep.index_show.as_str()),
            Some("第1话")
        );
    }

    #[test]
    fn pgc_item_accepts_horizontal_cover_alias() {
        let json = r#"{"modules":[{"items":[{"season_id":1,"title":"t","ss_horizontal_cover":"https://x/y.jpg"}]}]}"#;
        let data: PgcTabData = serde_json::from_str(json).expect("parse should succeed");
        assert_eq!(data.modules[0].items[0].cover, "https://x/y.jpg");
    }

    #[test]
    fn pgc_rank_deserializes() {
        let json = r#"{"list":[{"season_id":1172,"title":"t","ss_horizontal_cover":"https://x/y.jpg","new_ep":{"index_show":"更新至3话"}}]}"#;
        let data: PgcRankData = serde_json::from_str(json).expect("parse should succeed");
        assert_eq!(data.list.len(), 1);
        assert_eq!(data.list[0].season_id, 1172);
    }
}
