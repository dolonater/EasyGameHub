//! 私信会话与消息（web 版接口）
//! https://github.com/SocialSisterYi/bilibili-API-collect/tree/master/docs/social/session.md

use serde::{Deserialize, Serialize};

use crate::{BpiError, BpiResult};

/// 会话列表接口参数。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MessageSessionsParams {
    cursor: Option<String>,
}

impl Default for MessageSessionsParams {
    fn default() -> Self {
        Self { cursor: None }
    }
}

impl MessageSessionsParams {
    pub fn new() -> Self {
        Self::default()
    }

    /// 设置分页游标（响应中的 `next_offset`）。
    pub fn with_cursor(mut self, cursor: impl Into<String>) -> BpiResult<Self> {
        self.cursor = Some(normalize_non_blank("cursor", cursor.into())?);
        Ok(self)
    }

    pub fn query_pairs(&self) -> Vec<(&'static str, String)> {
        let mut query = Vec::new();
        if let Some(cursor) = &self.cursor {
            query.push(("cursor", cursor.clone()));
        }
        query
    }
}

/// 历史消息接口参数。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MessageHistoryParams {
    talker_id: u64,
    session_type: u32,
    cursor: Option<u64>,
    size: Option<u32>,
}

impl MessageHistoryParams {
    pub fn new(talker_id: u64, session_type: u32) -> BpiResult<Self> {
        if talker_id == 0 {
            return Err(BpiError::invalid_parameter(
                "talker_id",
                "id must be non-zero",
            ));
        }
        Ok(Self {
            talker_id,
            session_type,
            cursor: None,
            size: None,
        })
    }

    /// 设置游标：0 表示最新消息；否则为响应中的 `next_offset`。
    pub fn with_cursor(mut self, cursor: u64) -> Self {
        self.cursor = Some(cursor);
        self
    }

    /// 设置单页条数。
    pub fn with_size(mut self, size: u32) -> BpiResult<Self> {
        if size == 0 || size > 200 {
            return Err(BpiError::invalid_parameter(
                "size",
                "value must be between 1 and 200",
            ));
        }
        self.size = Some(size);
        Ok(self)
    }

    pub fn query_pairs(&self) -> Vec<(&'static str, String)> {
        let mut query = vec![
            ("talker_id", self.talker_id.to_string()),
            ("session_type", self.session_type.to_string()),
        ];
        if let Some(cursor) = self.cursor {
            query.push(("cursor", cursor.to_string()));
        }
        if let Some(size) = self.size {
            query.push(("size", size.to_string()));
        }
        query
    }
}

/// 会话列表响应数据。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MessageSessionsData {
    #[serde(default)]
    pub session_list: Vec<MessageSession>,
    #[serde(default)]
    pub has_more: bool,
    #[serde(default)]
    pub next_offset: Option<String>,
}

/// 单个会话。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MessageSession {
    #[serde(default)]
    pub talker_id: u64,
    #[serde(default)]
    pub session_type: u32,
    #[serde(default)]
    pub unread_count: u32,
    #[serde(default)]
    pub last_msg: Option<MessageLastMsg>,
}

/// 会话最后一条消息。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MessageLastMsg {
    #[serde(default)]
    pub msg_id: u64,
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub sender_uid: u64,
    #[serde(default)]
    pub timestamp: i64,
    #[serde(default)]
    pub msg_type: u32,
}

/// 历史消息响应数据。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MessageHistoryData {
    #[serde(default)]
    pub messages: Vec<MessageItem>,
    #[serde(default)]
    pub has_more: bool,
    #[serde(default)]
    pub next_offset: Option<u64>,
}

/// 单条消息。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MessageItem {
    #[serde(default)]
    pub msg_id: u64,
    #[serde(default)]
    pub sender_uid: u64,
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub timestamp: i64,
    #[serde(default)]
    pub msg_type: u32,
}

fn normalize_non_blank(field: &'static str, value: String) -> BpiResult<String> {
    let trimmed = value.trim().to_string();
    if trimmed.is_empty() {
        return Err(BpiError::invalid_parameter(
            field,
            "value cannot be blank",
        ));
    }
    Ok(trimmed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sessions_params_serializes_cursor() -> BpiResult<()> {
        let params = MessageSessionsParams::new();
        assert!(params.query_pairs().is_empty());

        let params = MessageSessionsParams::new().with_cursor("abc")?;
        assert_eq!(params.query_pairs(), vec![("cursor", "abc".to_string())]);
        Ok(())
    }

    #[test]
    fn history_params_validates_and_serializes() -> BpiResult<()> {
        assert!(MessageHistoryParams::new(0, 1).is_err());

        let params = MessageHistoryParams::new(123, 1)?.with_cursor(999).with_size(30)?;
        assert_eq!(
            params.query_pairs(),
            vec![
                ("talker_id", "123".to_string()),
                ("session_type", "1".to_string()),
                ("cursor", "999".to_string()),
                ("size", "30".to_string()),
            ]
        );
        Ok(())
    }

    #[test]
    fn history_params_rejects_bad_size() {
        assert!(MessageHistoryParams::new(123, 1).unwrap().with_size(0).is_err());
        assert!(MessageHistoryParams::new(123, 1).unwrap().with_size(201).is_err());
    }

    #[test]
    fn session_models_tolerate_missing_fields() {
        let sessions: MessageSessionsData =
            serde_json::from_str(r#"{"session_list":[{"talker_id":1}]}"#).expect("should parse");
        assert_eq!(sessions.session_list.len(), 1);
        assert_eq!(sessions.session_list[0].talker_id, 1);
        assert_eq!(sessions.session_list[0].unread_count, 0);
        assert!(!sessions.has_more);
    }

    #[test]
    fn contract_requires_authenticated_read_of_sessions() -> BpiResult<()> {
        use crate::probe::contract::HttpMethod;
        use crate::probe::endpoint_contract::EndpointContract;

        let bytes =
            include_bytes!("../../tests/contracts/message/session/sessions/contract.json");
        let contract = EndpointContract::from_slice(bytes)?;
        assert_eq!(contract.module.as_deref(), Some("message"));
        assert_eq!(contract.endpoint.as_deref(), Some("sessions"));
        assert_eq!(contract.request.method, HttpMethod::Get);
        assert!(contract
            .request
            .url
            .as_str()
            .contains("/x/session/web/v1/session/sessions"));
        Ok(())
    }

    #[test]
    fn contract_requires_authenticated_read_of_history() -> BpiResult<()> {
        use crate::probe::contract::HttpMethod;
        use crate::probe::endpoint_contract::EndpointContract;

        let bytes = include_bytes!("../../tests/contracts/message/session/history/contract.json");
        let contract = EndpointContract::from_slice(bytes)?;
        assert_eq!(contract.module.as_deref(), Some("message"));
        assert_eq!(contract.endpoint.as_deref(), Some("history"));
        assert_eq!(contract.request.method, HttpMethod::Get);
        assert!(contract
            .request
            .url
            .as_str()
            .contains("/x/session/web/v1/session/msg"));
        Ok(())
    }
}
