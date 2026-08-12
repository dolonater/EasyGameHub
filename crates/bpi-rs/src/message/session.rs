//! 私信会话与消息（web 版接口）
//! https://github.com/SocialSisterYi/bilibili-API-collect/tree/master/docs/social/session.md

use serde::{Deserialize, Serialize};

use crate::{BpiError, BpiResult};

/// 会话列表接口参数（vc 版 `session_svr/new_sessions`）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MessageSessionsParams {
    begin_ts: Option<u64>,
}

impl Default for MessageSessionsParams {
    fn default() -> Self {
        Self { begin_ts: None }
    }
}

impl MessageSessionsParams {
    pub fn new() -> Self {
        Self::default()
    }

    /// 设置时间游标：0 表示最新；否则为上一页最早会话的时间戳。
    pub fn with_begin_ts(mut self, begin_ts: u64) -> Self {
        self.begin_ts = Some(begin_ts);
        self
    }

    pub fn query_pairs(&self) -> Vec<(&'static str, String)> {
        let mut query = vec![("mobi_app", "web".to_string())];
        if let Some(begin_ts) = self.begin_ts {
            query.push(("begin_ts", begin_ts.to_string()));
        }
        query
    }
}

/// 历史消息接口参数（vc 版 `svr_sync/fetch_session_msgs`）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MessageHistoryParams {
    talker_id: u64,
    session_type: u32,
    begin_seqno: Option<u64>,
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
            begin_seqno: None,
            size: None,
        })
    }

    /// 设置消息序号游标：0 表示最新消息；否则为上一页响应的 `max_seqno`。
    pub fn with_begin_seqno(mut self, begin_seqno: u64) -> Self {
        self.begin_seqno = Some(begin_seqno);
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
            ("sender_device_id", "1".to_string()),
            ("talker_id", self.talker_id.to_string()),
            ("session_type", self.session_type.to_string()),
            ("mobi_app", "web".to_string()),
        ];
        if let Some(begin_seqno) = self.begin_seqno {
            query.push(("begin_seqno", begin_seqno.to_string()));
        }
        if let Some(size) = self.size {
            query.push(("size", size.to_string()));
        }
        query
    }
}

/// 会话列表响应数据（vc 版）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MessageSessionsData {
    #[serde(default)]
    pub session_list: Vec<MessageSession>,
    /// vc 版 has_more 为数字（0/1），容错解析
    #[serde(default, deserialize_with = "deserialize_bool_from_number")]
    pub has_more: bool,
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
    pub msg_seqno: u64,
    /// content 为 JSON 字符串，解析出文本
    #[serde(default, deserialize_with = "deserialize_message_content")]
    pub content: String,
    #[serde(default)]
    pub sender_uid: u64,
    #[serde(default)]
    pub timestamp: i64,
    #[serde(default)]
    pub msg_type: u32,
}

/// 历史消息响应数据（vc 版）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MessageHistoryData {
    #[serde(default)]
    pub messages: Vec<MessageItem>,
    /// vc 版 has_more 为数字（0/1），容错解析
    #[serde(default, deserialize_with = "deserialize_bool_from_number")]
    pub has_more: bool,
    #[serde(default)]
    pub max_seqno: u64,
}

/// 单条消息。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MessageItem {
    #[serde(default)]
    pub msg_seqno: u64,
    #[serde(default)]
    pub msg_key: u64,
    #[serde(default)]
    pub sender_uid: u64,
    #[serde(default)]
    pub msg_type: u32,
    #[serde(default)]
    pub timestamp: i64,
    /// content 为 JSON 字符串（如 {"content":"你好"}），解析为文本。
    #[serde(default, deserialize_with = "deserialize_message_content")]
    pub content: String,
    /// 原始 content JSON 字符串。
    #[serde(default)]
    pub raw_content: String,
}

/// 私信 content 解析：content 字段是 JSON 字符串，兼容多种结构：
/// - {"content":"你好"}（普通文本）
/// - {"title":"...","text":"..."}（系统通知等复杂 JSON）
/// - {"content":{"text":"..."}}（嵌套）
/// 全部提取失败回退原文。
fn deserialize_message_content<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let raw = String::deserialize(deserializer).unwrap_or_default();
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) {
        if let Some(text) = value
            .get("content")
            .and_then(serde_json::Value::as_str)
            .or_else(|| value.get("text").and_then(serde_json::Value::as_str))
            .or_else(|| {
                value
                    .get("content")
                    .and_then(|content| content.get("text"))
                    .and_then(serde_json::Value::as_str)
            })
        {
            return Ok(text.to_string());
        }
    }
    Ok(raw)
}

/// vc 版 has_more 为数字（0/1），兼容 bool。
fn deserialize_bool_from_number<'de, D>(deserializer: D) -> Result<bool, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum BoolValue {
        Bool(bool),
        Int(i64),
    }
    match BoolValue::deserialize(deserializer)? {
        BoolValue::Bool(value) => Ok(value),
        BoolValue::Int(value) => Ok(value != 0),
    }
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
    fn sessions_params_serializes_begin_ts() {
        let params = MessageSessionsParams::new();
        assert_eq!(params.query_pairs(), vec![("mobi_app", "web".to_string())]);

        let params = MessageSessionsParams::new().with_begin_ts(1710000000);
        assert_eq!(
            params.query_pairs(),
            vec![
                ("mobi_app", "web".to_string()),
                ("begin_ts", "1710000000".to_string()),
            ]
        );
    }

    #[test]
    fn history_params_validates_and_serializes() -> BpiResult<()> {
        assert!(MessageHistoryParams::new(0, 1).is_err());

        let params = MessageHistoryParams::new(123, 1)?
            .with_begin_seqno(999)
            .with_size(30)?;
        assert_eq!(
            params.query_pairs(),
            vec![
                ("sender_device_id", "1".to_string()),
                ("talker_id", "123".to_string()),
                ("session_type", "1".to_string()),
                ("mobi_app", "web".to_string()),
                ("begin_seqno", "999".to_string()),
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
    fn session_last_msg_parses_json_content() {
        let sessions: MessageSessionsData = serde_json::from_str(
            r#"{"session_list":[{"talker_id":1,"last_msg":{"content":"{\"content\":\"你好\"}"}}]}"#,
        )
        .expect("should parse");
        assert_eq!(
            sessions.session_list[0].last_msg.as_ref().map(|m| m.content.as_str()),
            Some("你好")
        );
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
    fn has_more_accepts_number() {
        let sessions: MessageSessionsData =
            serde_json::from_str(r#"{"session_list":[],"has_more":1}"#).expect("number should parse");
        assert!(sessions.has_more);
        let history: MessageHistoryData =
            serde_json::from_str(r#"{"messages":[],"has_more":0,"max_seqno":5}"#).expect("number should parse");
        assert!(!history.has_more);
        assert_eq!(history.max_seqno, 5);
    }

    #[test]
    fn message_content_parses_json_content() {
        let item: MessageItem = serde_json::from_str(
            r#"{"msg_seqno":10,"sender_uid":1,"content":"{\"content\":\"你好\"}","timestamp":1710000000,"msg_type":2}"#,
        )
        .expect("should parse");
        assert_eq!(item.content, "你好");
        assert_eq!(item.msg_seqno, 10);

        // 非 JSON 原文回退
        let item: MessageItem =
            serde_json::from_str(r#"{"content":"纯文本"}"#).expect("should parse");
        assert_eq!(item.content, "纯文本");

        // 系统通知复杂 JSON：取 text 字段
        let item: MessageItem = serde_json::from_str(
            r#"{"content":"{\"title\":\"登录操作通知\",\"text\":\"你的账号在新设备登录成功\"}"}"#,
        )
        .expect("should parse");
        assert_eq!(item.content, "你的账号在新设备登录成功");

        // 嵌套 content.text
        let item: MessageItem = serde_json::from_str(
            r#"{"content":"{\"content\":{\"text\":\"嵌套文本\"}}"}"#,
        )
        .expect("should parse");
        assert_eq!(item.content, "嵌套文本");
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
            .contains("/session_svr/v1/session_svr/new_sessions"));
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
            .contains("/svr_sync/v1/svr_sync/fetch_session_msgs"));
        Ok(())
    }
}
