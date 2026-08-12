//! 空间动态（UP 主页动态流）
//! https://github.com/SocialSisterYi/bilibili-API-collect/tree/master/docs/dynamic/space.md

use serde::{Deserialize, Serialize};

use crate::dynamic::all::DynamicItem;
use crate::ids::Mid;
use crate::{BpiError, BpiResult};

const DEFAULT_SPACE_FEATURES: &str = "itemOpusStyle,listOnlyfans,opusBigCover,onlyfansVote,decorationCard,onlyfansAssetsV2,forwardListHidden,ugcDelete";

fn normalize_non_blank(field: &'static str, value: String) -> BpiResult<String> {
    let trimmed = value.trim().to_string();
    if trimmed.is_empty() {
        return Err(BpiError::invalid_parameter(field, "value cannot be blank"));
    }
    Ok(trimmed)
}

/// 空间动态接口参数。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpaceDynamicParams {
    host_mid: Mid,
    features: String,
    offset: Option<String>,
}

impl SpaceDynamicParams {
    /// 以目标用户 mid 创建参数。
    pub fn new(host_mid: Mid) -> Self {
        Self {
            host_mid,
            features: DEFAULT_SPACE_FEATURES.to_string(),
            offset: None,
        }
    }

    /// 设置分页游标（响应中的 `offset`）。
    pub fn with_offset(mut self, offset: impl Into<String>) -> BpiResult<Self> {
        self.offset = Some(normalize_non_blank("offset", offset.into())?);
        Ok(self)
    }

    pub fn query_pairs(&self) -> Vec<(&'static str, String)> {
        let mut pairs = vec![
            ("host_mid", self.host_mid.get().to_string()),
            ("features", self.features.clone()),
        ];
        if let Some(offset) = &self.offset {
            pairs.push(("offset", offset.clone()));
        }
        pairs
    }
}

/// 空间动态响应数据。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SpaceDynamicData {
    pub has_more: bool,
    pub items: Vec<DynamicItem>,
    pub offset: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::probe::contract::HttpMethod;
    use crate::probe::endpoint_contract::EndpointContract;
    use crate::{BpiClient, BpiResult};

    fn contract() -> BpiResult<EndpointContract> {
        let bytes = include_bytes!("../../tests/contracts/dynamic/feed/space/contract.json");
        EndpointContract::from_slice(bytes)
    }

    #[test]
    fn space_dynamic_params_build_query() -> BpiResult<()> {
        let mid = crate::ids::Mid::new(2_084_572)?;
        let params = SpaceDynamicParams::new(mid);
        let pairs = params.query_pairs();
        assert_eq!(pairs[0], ("host_mid", "2084572".to_string()));
        assert!(pairs.iter().all(|(key, _)| *key != "offset"));

        let with_offset = SpaceDynamicParams::new(mid).with_offset("abc123")?;
        let pairs = with_offset.query_pairs();
        assert!(
            pairs
                .iter()
                .any(|(key, value)| *key == "offset" && value == "abc123")
        );
        Ok(())
    }

    #[test]
    fn contract_requires_authenticated_read_of_space_feed() -> BpiResult<()> {
        let contract = contract()?;
        assert_eq!(contract.module.as_deref(), Some("dynamic"));
        assert_eq!(contract.endpoint.as_deref(), Some("space"));
        assert_eq!(contract.request.method, HttpMethod::Get);
        assert!(
            contract
                .request
                .url
                .as_str()
                .contains("/x/polymer/web-dynamic/v1/feed/space")
        );
        assert_eq!(
            contract.risk,
            Some(crate::probe::endpoint_contract::ApiRisk::AuthenticatedRead)
        );
        Ok(())
    }

    #[ignore = "requires live network"]
    #[tokio::test]
    async fn test_dynamic_get_space() -> Result<(), Box<BpiError>> {
        let bpi = BpiClient::new()?;
        let data = bpi
            .dynamic()
            .space_dynamics(SpaceDynamicParams::new(crate::ids::Mid::new(2_084_572)?))
            .await?;
        println!("成功获取 {} 条空间动态", data.items.len());
        Ok(())
    }
}
