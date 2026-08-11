use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliLoginInfo {
    pub provider: String,
    pub logged_in: bool,
    pub user_id: String,
    pub nickname: String,
    pub avatar: String,
    pub login_expired: bool,
    pub message: String,
}

impl Default for BiliLoginInfo {
    fn default() -> Self {
        Self {
            provider: "bilibili".to_string(),
            logged_in: false,
            user_id: String::new(),
            nickname: String::new(),
            avatar: String::new(),
            login_expired: false,
            message: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliQrLoginKey {
    pub key: String,
    pub qr_url: String,
    pub qr_image: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliQrLoginStatus {
    pub code: i32,
    pub message: String,
    pub logged_in: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub login_info: Option<BiliLoginInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BiliOperationResult {
    pub ok: bool,
    pub message: String,
}

impl BiliOperationResult {
    pub fn ok(message: impl Into<String>) -> Self {
        Self {
            ok: true,
            message: message.into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BiliVideoCard {
    pub bvid: String,
    pub aid: u64,
    pub cid: u64,
    pub title: String,
    pub cover: String,
    pub owner_name: String,
    pub owner_mid: u64,
    pub duration: u64,
    pub view_count: u64,
    pub danmaku_count: u64,
    pub published_at: u64,
    pub progress: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BiliOwner {
    pub mid: u64,
    pub name: String,
    pub face: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BiliVideoStats {
    pub view_count: u64,
    pub danmaku_count: u64,
    pub reply_count: u64,
    pub favorite_count: u64,
    pub coin_count: u64,
    pub share_count: u64,
    pub like_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BiliVideoPage {
    pub cid: u64,
    pub page: u32,
    pub title: String,
    pub duration: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BiliLocalProgress {
    pub bvid: String,
    pub aid: u64,
    pub cid: u64,
    pub progress_seconds: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BiliVideoDetail {
    pub bvid: String,
    pub aid: u64,
    pub cid: u64,
    pub title: String,
    pub cover: String,
    pub description: String,
    pub owner: BiliOwner,
    pub stats: BiliVideoStats,
    pub pages: Vec<BiliVideoPage>,
    pub duration: u64,
    pub published_at: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_play_cid: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_play_time: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BiliQualityOption {
    pub id: String,
    pub quality: u64,
    pub label: String,
    pub codecs: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub bandwidth: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BiliPlaybackSource {
    pub playback_id: String,
    pub manifest_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub direct_url: Option<String>,
    pub qualities: Vec<BiliQualityOption>,
    pub expires_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BiliDanmakuItem {
    pub id: String,
    pub time: f64,
    pub text: String,
    pub color: String,
    pub mode: u8,
    pub font_size: u32,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BiliHistoryItem {
    pub video: BiliVideoCard,
    pub viewed_at: u64,
    pub page: u32,
    pub page_title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BiliToViewItem {
    pub video: BiliVideoCard,
    pub added_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BiliFavoriteFolder {
    pub id: u64,
    pub title: String,
    pub cover: String,
    pub owner_mid: u64,
    pub owner_name: String,
    pub media_count: u32,
    pub owned: bool,
    pub fav_state: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BiliVideoInteractionStats {
    pub like_count: u64,
    pub coin_count: u64,
    pub favorite_count: u64,
    pub share_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BiliOwnerInteractionState {
    pub mid: u64,
    pub name: String,
    pub avatar: String,
    pub follower_count: u64,
    pub following: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BiliVideoInteractionState {
    pub aid: u64,
    pub bvid: String,
    pub liked: bool,
    pub coin_count: u8,
    pub favorited: bool,
    pub to_view: bool,
    pub stats: BiliVideoInteractionStats,
    pub owner: BiliOwnerInteractionState,
    pub favorite_folders: Vec<BiliFavoriteFolder>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BiliFavoriteItem {
    pub video: BiliVideoCard,
    pub media_id: u64,
    pub favorite_time: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BiliCommentMember {
    pub mid: u64,
    pub name: String,
    pub avatar: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BiliCommentContent {
    pub message: String,
    pub pictures: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BiliComment {
    pub rpid: u64,
    pub root: u64,
    pub parent: u64,
    pub ctime: u64,
    pub like_count: u64,
    pub liked: bool,
    pub disliked: bool,
    pub replies_count: u64,
    pub member: BiliCommentMember,
    pub content: BiliCommentContent,
    pub replies: Vec<BiliComment>,
    pub can_delete: bool,
    pub can_top: bool,
    pub is_top: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BiliCommentPage {
    pub page: u32,
    pub page_size: u32,
    pub total: u64,
    pub has_more: bool,
    pub sort: String,
    pub comments: Vec<BiliComment>,
    pub top_comments: Vec<BiliComment>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BiliReportReason {
    Other,
    Ad,
    Porn,
    Spam,
    Flame,
    Spoiler,
    Politics,
    Abuse,
    Irrelevant,
    Illegal,
    Vulgar,
    Phishing,
    Scam,
    Rumor,
    Incitement,
    Privacy,
    FloorSnatching,
    HarmfulToYouth,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BiliErrorKind {
    NotLoggedIn,
    LoginExpired,
    VipRequired,
    PermissionDenied,
    RegionRestricted,
    CopyrightRestricted,
    RiskControl,
    Network,
    Proxy,
    Playback,
    Api,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliErrorDto {
    pub kind: BiliErrorKind,
    pub message: String,
    pub retryable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub external_url: Option<String>,
}

impl BiliErrorDto {
    pub fn new(kind: BiliErrorKind, message: impl Into<String>, retryable: bool) -> Self {
        Self {
            kind,
            message: message.into(),
            retryable,
            external_url: None,
        }
    }
}
