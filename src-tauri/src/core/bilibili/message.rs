//! 私信与通知：会话列表 / 历史消息 / 发送 / 未读计数 / 通知流（reply_feed）。

use bpi_rs::message::private_msg::MessageType;
use bpi_rs::message::{
    MessageHistoryParams, MessageReplyFeedParams, MessageSendParams, MessageSessionsParams,
    MessageUnreadCountParams, SingleUnreadType,
};
use bpi_rs::{BpiClient, BpiError};

use super::models::{
    BiliMessageHistoryPage, BiliMessageItem, BiliMessageSession, BiliMessageSessionsPage,
    BiliMessageUnread, BiliOperationResult, BiliReplyFeedEntry, BiliReplyFeedPage,
};

/// 私信会话类型：单聊。
const SESSION_TYPE_SINGLE: u32 = 1;
/// 单页消息条数。
const MESSAGE_PAGE_SIZE: u32 = 30;

pub async fn message_sessions(
    client: &BpiClient,
    cursor: Option<String>,
) -> Result<BiliMessageSessionsPage, BpiError> {
    let mut params = MessageSessionsParams::new();
    if let Some(cursor) = cursor {
        if !cursor.trim().is_empty() {
            params = params.with_cursor(cursor)?;
        }
    }
    let data = client.message().sessions(params).await?;
    Ok(BiliMessageSessionsPage {
        sessions: data
            .session_list
            .into_iter()
            .map(|session| BiliMessageSession {
                talker_id: session.talker_id,
                unread_count: session.unread_count,
                last_msg: session.last_msg.map(|msg| BiliMessageItem {
                    msg_id: msg.msg_id,
                    sender_uid: msg.sender_uid,
                    content: msg.content,
                    timestamp: msg.timestamp,
                    msg_type: msg.msg_type,
                }),
            })
            .collect(),
        has_more: data.has_more,
        next_offset: data.next_offset,
    })
}

pub async fn message_history(
    client: &BpiClient,
    talker_uid: u64,
    cursor: Option<u64>,
) -> Result<BiliMessageHistoryPage, BpiError> {
    let mut params = MessageHistoryParams::new(talker_uid, SESSION_TYPE_SINGLE)?;
    if let Some(cursor) = cursor {
        params = params.with_cursor(cursor);
    }
    params = params.with_size(MESSAGE_PAGE_SIZE)?;
    let data = client.message().messages(params).await?;
    Ok(BiliMessageHistoryPage {
        messages: data
            .messages
            .into_iter()
            .map(|msg| BiliMessageItem {
                msg_id: msg.msg_id,
                sender_uid: msg.sender_uid,
                content: msg.content,
                timestamp: msg.timestamp,
                msg_type: msg.msg_type,
            })
            .collect(),
        has_more: data.has_more,
        next_offset: data.next_offset,
    })
}

pub async fn message_send(
    client: &BpiClient,
    uid: u64,
    content: String,
) -> Result<BiliOperationResult, BpiError> {
    let content = content.trim();
    if content.is_empty() {
        return Err(BpiError::invalid_parameter(
            "content",
            "message cannot be blank",
        ));
    }
    if content.chars().count() > 2000 {
        return Err(BpiError::invalid_parameter(
            "content",
            "message cannot exceed 2000 characters",
        ));
    }
    let params = MessageSendParams::new(uid, 1, MessageType::Text(content.to_string()))?;
    client.message().send(params).await?;
    Ok(BiliOperationResult::ok("message sent"))
}

pub async fn message_unread(client: &BpiClient) -> Result<BiliMessageUnread, BpiError> {
    let params = MessageUnreadCountParams::new();
    let data = client.message().unread_count(params).await?;
    let private = client
        .message()
        .single_unread(
            bpi_rs::message::MessageSingleUnreadParams::new()
                .with_unread_type(SingleUnreadType::Custom(4)),
        )
        .await?;
    Ok(BiliMessageUnread {
        reply: data.recv_reply,
        at: 0,
        like: data.recv_like,
        private_msg: private.follow_unread,
        sys_msg: data.sys_msg,
    })
}

pub async fn message_reply_feed(
    client: &BpiClient,
    start_id: Option<u64>,
    start_time: Option<u64>,
) -> Result<BiliReplyFeedPage, BpiError> {
    let mut params = MessageReplyFeedParams::new();
    if let Some(start_id) = start_id {
        params = params.with_start_id(start_id)?;
    }
    if let Some(start_time) = start_time {
        params = params.with_start_time(start_time)?;
    }
    let data = client.message().reply_feed(params).await?;
    Ok(BiliReplyFeedPage {
        entries: data
            .items
            .into_iter()
            .map(|item| BiliReplyFeedEntry {
                id: item.id,
                user_name: item.user.nickname,
                user_face: item.user.avatar,
                reply_time: item.reply_time,
                title: item.item.title,
                desc: item.item.desc,
                uri: item.item.uri,
                reply_type: item.item.reply_type,
            })
            .collect(),
        is_end: data.cursor.is_end,
        cursor_id: data.cursor.id,
    })
}
