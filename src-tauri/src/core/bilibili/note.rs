//! Bilibili 笔记：视频稿件笔记列表 / 详情（P8）。
//!
//! 公开笔记用 `cvid` 查询；本用户私有笔记仅登录且为自己时可见（`aid` + `note_id`）。

use bpi_rs::ids::{Aid, Cvid, NoteId};
use bpi_rs::note::{
    NotePrivateInfoParams, NotePublicArchiveListParams, NotePublicInfoParams,
    NoteUserPrivateListParams,
};
use bpi_rs::{BpiClient, BpiError};

use super::models::{BiliNoteDetail, BiliNoteItem, BiliNoteListPage};

/// 视频稿件笔记列表：公开 + （登录时）本用户私有合并。
pub async fn note_list(client: &BpiClient, aid: u64) -> Result<BiliNoteListPage, BpiError> {
    let aid_id = Aid::new(aid)?;
    let public_data = client
        .note()
        .public_archive_list(NotePublicArchiveListParams::new(aid_id.clone()))
        .await?;

    let mut notes: Vec<BiliNoteItem> = public_data
        .list
        .unwrap_or_default()
        .into_iter()
        .map(|item| BiliNoteItem {
            cvid: item.cvid as i64,
            note_id: 0,
            title: item.title,
            summary: item.summary,
            pub_time: item.pubtime,
            author_name: item.author.name,
            author_face: item.author.face,
            likes: item.likes as i64,
            has_like: item.has_like,
            is_private: false,
        })
        .collect();

    // 本用户私有笔记（需登录）
    if client.has_login_cookies() {
        if let Ok(private_data) = client
            .note()
            .user_private_list(NoteUserPrivateListParams::new())
            .await
        {
            notes.extend(
                private_data
                    .list
                    .unwrap_or_default()
                    .into_iter()
                    .filter(|item| item.arc.aid == aid)
                    .map(|item| BiliNoteItem {
                        cvid: 0,
                        note_id: item.note_id as i64,
                        title: item.title,
                        summary: item.summary,
                        pub_time: item.mtime,
                        author_name: "我".to_string(),
                        author_face: String::new(),
                        likes: item.likes as i64,
                        has_like: item.has_like,
                        is_private: true,
                    }),
            );
        }
    }

    Ok(BiliNoteListPage {
        notes,
        has_more: false,
    })
}

/// 笔记详情：公开走 cvid，私有走 aid + note_id。
pub async fn note_detail(
    client: &BpiClient,
    cvid: u64,
    note_id: u64,
    aid: u64,
) -> Result<BiliNoteDetail, BpiError> {
    if cvid > 0 {
        let data = client
            .note()
            .public_info(NotePublicInfoParams::new(Cvid::new(cvid)?))
            .await?;
        return Ok(BiliNoteDetail {
            cvid: data.cvid as i64,
            note_id: data.note_id as i64,
            title: data.title,
            summary: data.summary,
            content: data.content,
            pub_time: String::new(),
            author_name: data.author.name,
            author_face: data.author.face,
            likes: 0,
            is_private: false,
        });
    }
    let data = client
        .note()
        .private_info(NotePrivateInfoParams::new(
            Aid::new(aid)?,
            NoteId::new(note_id)?,
        ))
        .await?;
    Ok(BiliNoteDetail {
        cvid: 0,
        note_id: note_id as i64,
        title: data.title,
        summary: data.summary,
        content: data.content,
        pub_time: String::new(),
        author_name: "我".to_string(),
        author_face: String::new(),
        likes: 0,
        is_private: true,
    })
}
