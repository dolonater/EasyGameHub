use std::collections::HashSet;

use bpi_rs::comment::list::CommentListData;
use bpi_rs::comment::types::Comment;
use bpi_rs::comment::{
    CommentActionParams, CommentAddParams, CommentDeleteParams, CommentListParams,
    CommentRepliesParams, CommentSort, CommentTarget, CommentType, ReportReason,
};
use bpi_rs::{BpiClient, BpiError};

use super::models::{
    BiliComment, BiliCommentContent, BiliCommentMember, BiliCommentPage, BiliOperationResult,
    BiliReportReason,
};
use super::video;

const COMMENT_TYPE_VIDEO: i32 = 1;
const COMMENT_PAGE_SIZE: u32 = 20;

pub async fn list(
    client: &BpiClient,
    oid: u64,
    page: Option<u32>,
    sort: Option<String>,
    current_mid: Option<u64>,
    comment_type: Option<i64>,
) -> Result<BiliCommentPage, BpiError> {
    let sort = parse_sort(sort.as_deref());
    let params = CommentListParams::new(typed_target(comment_type, oid)?)
        .with_page(page.unwrap_or(1))?
        .with_page_size(COMMENT_PAGE_SIZE)?
        .with_sort(sort)
        .without_hot(false);
    let data = client.comment().list(params).await?;
    Ok(page_to_dto(
        data,
        page.unwrap_or(1),
        sort_name(sort),
        current_mid,
    ))
}

pub async fn replies(
    client: &BpiClient,
    oid: u64,
    root: u64,
    page: Option<u32>,
    current_mid: Option<u64>,
) -> Result<BiliCommentPage, BpiError> {
    let params = CommentRepliesParams::new(target(oid)?, i64::try_from(root).unwrap_or(i64::MAX))?
        .with_page(page.unwrap_or(1))?
        .with_page_size(COMMENT_PAGE_SIZE)?;
    let data = client.comment().replies(params).await?;
    Ok(page_to_dto(data, page.unwrap_or(1), "replies", current_mid))
}

pub async fn add(
    client: &BpiClient,
    oid: u64,
    message: String,
    root: Option<u64>,
    parent: Option<u64>,
    current_mid: Option<u64>,
) -> Result<BiliComment, BpiError> {
    let normalized = normalize_non_blank("message", message)?;
    let mut params = CommentAddParams::new(CommentType::Video, oid, normalized.clone())?;
    if let Some(root) = root.filter(|value| *value > 0) {
        params = params.root(root)?;
    }
    if let Some(parent) = parent.filter(|value| *value > 0) {
        params = params.parent(parent)?;
    }

    let data = client.comment().add(params).await?;
    Ok(BiliComment {
        rpid: data.rpid,
        root: data.root,
        parent: data.parent,
        ctime: 0,
        like_count: 0,
        liked: false,
        disliked: false,
        replies_count: 0,
        member: BiliCommentMember {
            mid: current_mid.unwrap_or_default(),
            name: "我".to_string(),
            avatar: String::new(),
        },
        content: BiliCommentContent {
            message: normalized,
            pictures: Vec::new(),
        },
        replies: Vec::new(),
        can_delete: true,
        can_top: false,
        is_top: false,
    })
}

pub async fn like(
    client: &BpiClient,
    oid: u64,
    rpid: u64,
    like: bool,
) -> Result<BiliOperationResult, BpiError> {
    let params = CommentActionParams::new(CommentType::Video, oid, rpid, u8::from(like))?;
    client.comment().like(params).await?;
    Ok(BiliOperationResult::ok(if like {
        "comment liked"
    } else {
        "comment like canceled"
    }))
}

pub async fn dislike(
    client: &BpiClient,
    oid: u64,
    rpid: u64,
    dislike: bool,
) -> Result<BiliOperationResult, BpiError> {
    let params = CommentActionParams::new(CommentType::Video, oid, rpid, u8::from(dislike))?;
    client.comment().dislike(params).await?;
    Ok(BiliOperationResult::ok(if dislike {
        "comment disliked"
    } else {
        "comment dislike canceled"
    }))
}

pub async fn delete(
    client: &BpiClient,
    oid: u64,
    rpid: u64,
) -> Result<BiliOperationResult, BpiError> {
    let params = CommentDeleteParams::new(CommentType::Video, oid, rpid)?;
    client.comment().delete(params).await?;
    Ok(BiliOperationResult::ok("comment deleted"))
}

pub async fn top(
    client: &BpiClient,
    oid: u64,
    rpid: u64,
    top: bool,
) -> Result<BiliOperationResult, BpiError> {
    let params = CommentActionParams::new(CommentType::Video, oid, rpid, u8::from(top))?;
    client.comment().top(params).await?;
    Ok(BiliOperationResult::ok(if top {
        "comment topped"
    } else {
        "comment top canceled"
    }))
}

pub async fn report(
    client: &BpiClient,
    oid: u64,
    rpid: u64,
    reason: String,
    content: Option<String>,
) -> Result<BiliOperationResult, BpiError> {
    let reason = parse_report_reason(&reason)?;
    let mut params = bpi_rs::comment::CommentReportParams::new(
        CommentType::Video,
        oid,
        rpid,
        report_reason_to_bpi(reason),
    )?;
    if let Some(content) = content {
        params = params.content(normalize_non_blank("content", content)?)?;
    }

    client.comment().report(params).await?;
    Ok(BiliOperationResult::ok("comment reported"))
}

fn page_to_dto(
    data: CommentListData,
    fallback_page: u32,
    sort: &str,
    current_mid: Option<u64>,
) -> BiliCommentPage {
    let upper_mid = data.upper.as_ref().map(|upper| upper.mid);
    let top_ids = data
        .top_replies
        .as_deref()
        .unwrap_or_default()
        .iter()
        .map(|comment| positive_i64_to_u64(comment.rpid))
        .collect::<HashSet<_>>();
    let page_info = data.page.as_ref();
    let total = page_info
        .and_then(|page| page.acount)
        .or_else(|| page_info.map(|page| page.count))
        .or_else(|| {
            data.cursor
                .as_ref()
                .and_then(|cursor| cursor.all_count)
                .and_then(i64_to_u64)
        })
        .unwrap_or_default();
    let comments = data
        .replies
        .as_deref()
        .unwrap_or_default()
        .iter()
        .map(|comment| comment_to_dto(comment, current_mid, upper_mid, &top_ids))
        .collect::<Vec<_>>();
    let top_comments = data
        .top_replies
        .as_deref()
        .unwrap_or_default()
        .iter()
        .map(|comment| comment_to_dto(comment, current_mid, upper_mid, &top_ids))
        .collect::<Vec<_>>();

    BiliCommentPage {
        page: page_info
            .and_then(|page| u32::try_from(page.num).ok())
            .unwrap_or(fallback_page),
        page_size: page_info
            .and_then(|page| u32::try_from(page.size).ok())
            .unwrap_or(COMMENT_PAGE_SIZE),
        total,
        has_more: data
            .cursor
            .as_ref()
            .map(|cursor| !cursor.is_end)
            .unwrap_or_else(|| comments.len() >= COMMENT_PAGE_SIZE as usize),
        sort: sort.to_string(),
        comments,
        top_comments,
    }
}

fn comment_to_dto(
    comment: &Comment,
    current_mid: Option<u64>,
    upper_mid: Option<u64>,
    top_ids: &HashSet<u64>,
) -> BiliComment {
    let rpid = positive_i64_to_u64(comment.rpid);
    let member_mid = comment.member.mid.parse::<u64>().unwrap_or_default();
    let is_self = current_mid == Some(member_mid) && member_mid > 0;
    let is_upper = current_mid.is_some() && current_mid == upper_mid;
    BiliComment {
        rpid,
        root: positive_i64_to_u64(comment.root),
        parent: positive_i64_to_u64(comment.parent),
        ctime: positive_i64_to_u64(comment.ctime),
        like_count: positive_i64_to_u64(comment.like),
        liked: comment.action == 1,
        disliked: comment.action == 2,
        replies_count: positive_i64_to_u64(comment.rcount.max(comment.count)),
        member: BiliCommentMember {
            mid: member_mid,
            name: clean_text(&comment.member.uname),
            avatar: video::normalize_image_url(&comment.member.avatar),
        },
        content: BiliCommentContent {
            message: clean_text(&comment.content.message),
            pictures: comment
                .content
                .pictures
                .as_deref()
                .unwrap_or_default()
                .iter()
                .map(|picture| video::normalize_image_url(&picture.img_src))
                .filter(|url| !url.is_empty())
                .collect(),
        },
        replies: comment
            .replies
            .as_deref()
            .unwrap_or_default()
            .iter()
            .map(|reply| comment_to_dto(reply, current_mid, upper_mid, top_ids))
            .collect(),
        can_delete: is_self,
        can_top: is_upper && comment.root == 0,
        is_top: top_ids.contains(&rpid),
    }
}

fn target(oid: u64) -> Result<CommentTarget, BpiError> {
    let oid =
        i64::try_from(oid).map_err(|_| BpiError::invalid_parameter("oid", "value is too large"))?;
    CommentTarget::new(COMMENT_TYPE_VIDEO, oid)
}

/// 构造带类型的评论区目标（默认视频 type=1；动态 type=17 等）。
fn typed_target(comment_type: Option<i64>, oid: u64) -> Result<CommentTarget, BpiError> {
    let oid =
        i64::try_from(oid).map_err(|_| BpiError::invalid_parameter("oid", "value is too large"))?;
    let r#type = i32::try_from(comment_type.unwrap_or(COMMENT_TYPE_VIDEO as i64))
        .map_err(|_| BpiError::invalid_parameter("type", "value is too large"))?;
    CommentTarget::new(r#type, oid)
}

fn parse_sort(value: Option<&str>) -> CommentSort {
    match value {
        Some("time") => CommentSort::Time,
        Some("like") => CommentSort::Like,
        _ => CommentSort::Replies,
    }
}

fn sort_name(sort: CommentSort) -> &'static str {
    match sort {
        CommentSort::Time => "time",
        CommentSort::Like => "like",
        CommentSort::Replies => "replies",
    }
}

fn parse_report_reason(value: &str) -> Result<BiliReportReason, BpiError> {
    match value.trim() {
        "other" => Ok(BiliReportReason::Other),
        "ad" => Ok(BiliReportReason::Ad),
        "porn" => Ok(BiliReportReason::Porn),
        "spam" => Ok(BiliReportReason::Spam),
        "flame" => Ok(BiliReportReason::Flame),
        "spoiler" => Ok(BiliReportReason::Spoiler),
        "politics" => Ok(BiliReportReason::Politics),
        "abuse" => Ok(BiliReportReason::Abuse),
        "irrelevant" => Ok(BiliReportReason::Irrelevant),
        "illegal" => Ok(BiliReportReason::Illegal),
        "vulgar" => Ok(BiliReportReason::Vulgar),
        "phishing" => Ok(BiliReportReason::Phishing),
        "scam" => Ok(BiliReportReason::Scam),
        "rumor" => Ok(BiliReportReason::Rumor),
        "incitement" => Ok(BiliReportReason::Incitement),
        "privacy" => Ok(BiliReportReason::Privacy),
        "floorSnatching" => Ok(BiliReportReason::FloorSnatching),
        "harmfulToYouth" => Ok(BiliReportReason::HarmfulToYouth),
        _ => Err(BpiError::invalid_parameter(
            "reason",
            "unknown report reason",
        )),
    }
}

fn report_reason_to_bpi(value: BiliReportReason) -> ReportReason {
    match value {
        BiliReportReason::Other => ReportReason::Other,
        BiliReportReason::Ad => ReportReason::Ad,
        BiliReportReason::Porn => ReportReason::Porn,
        BiliReportReason::Spam => ReportReason::Spam,
        BiliReportReason::Flame => ReportReason::Flame,
        BiliReportReason::Spoiler => ReportReason::Spoiler,
        BiliReportReason::Politics => ReportReason::Politics,
        BiliReportReason::Abuse => ReportReason::Abuse,
        BiliReportReason::Irrelevant => ReportReason::Irrelevant,
        BiliReportReason::Illegal => ReportReason::Illegal,
        BiliReportReason::Vulgar => ReportReason::Vulgar,
        BiliReportReason::Phishing => ReportReason::Phishing,
        BiliReportReason::Scam => ReportReason::Scam,
        BiliReportReason::Rumor => ReportReason::Rumor,
        BiliReportReason::Incitement => ReportReason::Incitement,
        BiliReportReason::Privacy => ReportReason::Privacy,
        BiliReportReason::FloorSnatching => ReportReason::FloorSnatching,
        BiliReportReason::HarmfulToYouth => ReportReason::HarmfulToYouth,
    }
}

fn normalize_non_blank(field: &'static str, value: String) -> Result<String, BpiError> {
    let value = clean_text(&value);
    if value.is_empty() {
        return Err(BpiError::invalid_parameter(field, "value cannot be blank"));
    }
    Ok(value)
}

fn clean_text(value: &str) -> String {
    value
        .replace("&quot;", "\"")
        .replace("&amp;", "&")
        .trim()
        .to_string()
}

fn positive_i64_to_u64(value: i64) -> u64 {
    i64_to_u64(value).unwrap_or_default()
}

fn i64_to_u64(value: i64) -> Option<u64> {
    u64::try_from(value).ok()
}

#[cfg(test)]
mod tests {
    use bpi_rs::comment::CommentSort;

    use super::*;

    #[test]
    fn parse_sort_defaults_to_replies() {
        assert_eq!(parse_sort(Some("time")), CommentSort::Time);
        assert_eq!(parse_sort(Some("like")), CommentSort::Like);
        assert_eq!(parse_sort(Some("replies")), CommentSort::Replies);
        assert_eq!(parse_sort(Some("unknown")), CommentSort::Replies);
        assert_eq!(parse_sort(None), CommentSort::Replies);
    }

    #[test]
    fn parse_report_reason_rejects_unknown_value() {
        let err = parse_report_reason("missing").unwrap_err();
        assert!(matches!(
            err,
            BpiError::InvalidParameter {
                field: "reason",
                ..
            }
        ));
    }

    #[test]
    fn normalize_comment_text_rejects_blank_values() {
        let err = normalize_non_blank("message", "  ".to_string()).unwrap_err();
        assert!(matches!(
            err,
            BpiError::InvalidParameter {
                field: "message",
                ..
            }
        ));
    }
}
