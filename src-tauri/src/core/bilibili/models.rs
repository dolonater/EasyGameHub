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

/// 发送弹幕结果：携带真实 dmid，供撤回/点赞操作与本地 self 标记使用。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BiliDanmakuSendResult {
    pub ok: bool,
    pub message: String,
    pub dmid: Option<u64>,
}

impl BiliDanmakuSendResult {
    pub fn ok(message: impl Into<String>, dmid: Option<u64>) -> Self {
        Self {
            ok: true,
            message: message.into(),
            dmid,
        }
    }
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
pub struct BiliWeeklySeries {
    pub number: u32,
    pub subject: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BiliHotWord {
    pub keyword: String,
    pub show_name: String,
    pub heat_score: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliPreciousVideos {
    pub title: String,
    pub explain: String,
    pub videos: Vec<BiliVideoCard>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliUserSpace {
    pub mid: u64,
    pub name: String,
    pub face: String,
    pub sign: String,
    pub level: u32,
    pub fans: u64,
    pub following: u64,
    pub likes: u64,
    pub view: u64,
    pub archive_count: u64,
    pub is_followed: bool,
    pub live_room: Option<BiliUserSpaceLive>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliUserSpaceLive {
    pub room_id: u64,
    pub live_status: u8,
    pub title: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliSeasonDetail {
    pub season_id: u64,
    pub media_id: u64,
    pub title: String,
    pub cover: String,
    pub evaluate: String,
    pub total: i64,
    pub is_followed: bool,
    pub new_ep: String,
    pub score: Option<BiliSeasonScore>,
    pub episodes: Vec<BiliSeasonEpisode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliSeasonScore {
    pub score: f64,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliSeasonEpisode {
    pub ep_id: u64,
    pub aid: u64,
    pub cid: u64,
    pub bvid: String,
    pub title: String,
    pub long_title: String,
    pub cover: String,
    pub duration: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliPgcCard {
    pub season_id: i64,
    pub season_type: i64,
    pub title: String,
    pub cover: String,
    pub index_show: String,
    pub score: Option<f64>,
}

/// 动态流/详情统一卡片 DTO（四类：视频/图文/直播/转发，纯文字降级 text）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliDynamicCard {
    pub dyn_id: String,
    pub card_type: String,
    pub uid: i64,
    pub name: String,
    pub face: String,
    pub pub_time: String,
    pub content: String,
    pub video: Option<BiliDynamicVideo>,
    pub images: Vec<String>,
    pub live: Option<BiliDynamicLive>,
    pub forward: Option<Box<BiliDynamicCard>>,
    pub like_count: i64,
    pub liked: bool,
    pub forward_count: i64,
    pub comment_count: i64,
    pub comment_id: String,
    pub comment_type: i64,
    pub visible: bool,
    pub is_top: bool,
    /// 专栏动态的 article id（cvid），点击进专栏阅读页
    pub article_id: i64,
    /// 专栏动态标题
    pub title: String,
}

/// 动态内嵌视频卡片（MAJOR_TYPE_ARCHIVE）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliDynamicVideo {
    pub aid: i64,
    pub bvid: String,
    pub cover: String,
    pub title: String,
    pub duration_text: String,
    pub desc: String,
    pub play: i64,
    pub danmaku: i64,
}

/// 动态内嵌直播卡片（MAJOR_TYPE_LIVE_RCMD）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliDynamicLive {
    pub room_id: i64,
    pub title: String,
    pub cover: String,
    pub area_name: String,
}

/// 动态流分页（offset 游标）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliDynamicPage {
    pub cards: Vec<BiliDynamicCard>,
    pub has_more: bool,
    pub offset: String,
}

/// 转发列表单条。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliDynamicForwardEntry {
    pub dyn_id: String,
    pub pub_time: String,
    pub name: String,
    pub face: String,
    pub content: String,
}

/// 转发列表分页（offset 游标）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliDynamicForwardsPage {
    pub entries: Vec<BiliDynamicForwardEntry>,
    pub has_more: bool,
    pub offset: String,
}

/// 动态发布结果。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliDynamicCreated {
    pub ok: bool,
    pub message: String,
    pub dyn_id: String,
}

impl BiliDynamicCreated {
    pub fn ok(dyn_id: impl Into<String>) -> Self {
        Self {
            ok: true,
            message: "dynamic published".to_string(),
            dyn_id: dyn_id.into(),
        }
    }
}

/// 直播画质选项。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliLiveQuality {
    pub qn: i32,
    pub desc: String,
}

/// 直播流地址。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliLiveStreamUrl {
    pub url: String,
    pub order: i32,
}

/// 直播流信息。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliLiveStream {
    pub current_quality: i32,
    pub current_qn: i32,
    pub quality_description: Vec<BiliLiveQuality>,
    pub durl: Vec<BiliLiveStreamUrl>,
}

/// 直播间信息。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliLiveRoom {
    pub room_id: i64,
    pub uid: i64,
    pub title: String,
    pub cover: String,
    pub live_status: i32,
    pub online: i64,
    pub area_name: String,
    pub parent_area_name: String,
    pub description: String,
    pub tags: String,
    pub live_time: String,
    pub attention: i64,
}

/// 直播推荐房间卡片。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliLiveRecommendRoom {
    pub room_id: i64,
    pub uid: i64,
    pub title: String,
    pub cover: String,
    pub uname: String,
    pub face: String,
    pub online: i32,
    pub area_name: String,
    pub area_parent_name: String,
    pub status: bool,
    pub followers: i32,
}

/// 直播推荐分页。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliLiveRecommendPage {
    pub rooms: Vec<BiliLiveRecommendRoom>,
    pub top_room_id: i64,
}

/// 直播分区（含子分区）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliLiveArea {
    pub id: i32,
    pub name: String,
    pub children: Vec<BiliLiveSubArea>,
}

/// 直播子分区。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliLiveSubArea {
    pub id: i32,
    pub name: String,
    pub pic: String,
}

/// 直播弹幕发送结果。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliLiveSendDanmakuResult {
    pub ok: bool,
    pub message: String,
}

/// 直播弹幕 WS 桥下发的消息（桥把 cmd + 原始 JSON 转发给插件）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliLiveDanmakuMessage {
    pub cmd: String,
    pub data: serde_json::Value,
}

/// 私信会话。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliMessageSession {
    pub talker_id: u64,
    pub unread_count: u32,
    pub last_msg: Option<BiliMessageItem>,
    pub name: String,
    pub face: String,
}

/// 私信消息。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliMessageItem {
    pub msg_id: u64,
    pub sender_uid: u64,
    pub content: String,
    pub timestamp: i64,
    pub msg_type: u32,
}

/// 私信会话列表分页（cursor 游标）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliMessageSessionsPage {
    pub sessions: Vec<BiliMessageSession>,
    pub has_more: bool,
    pub next_offset: Option<String>,
}

/// 私信历史消息分页（cursor 游标）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliMessageHistoryPage {
    pub messages: Vec<BiliMessageItem>,
    pub has_more: bool,
    pub next_offset: Option<u64>,
}

/// 未读消息计数。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliMessageUnread {
    pub reply: u32,
    pub at: u32,
    pub like: u32,
    pub private_msg: u32,
    pub sys_msg: u32,
}

/// 通知流条目（回复/@）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliReplyFeedEntry {
    pub id: u64,
    pub user_name: String,
    pub user_face: String,
    pub reply_time: u64,
    pub title: String,
    pub desc: String,
    /// 对我的回复内容（source_content，区别于源评论 title/desc）
    pub source_content: String,
    pub uri: String,
    pub reply_type: String,
}

/// 通知流分页。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliReplyFeedPage {
    pub entries: Vec<BiliReplyFeedEntry>,
    pub is_end: bool,
    pub cursor_id: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliPgcSection {
    pub title: String,
    pub style: String,
    pub items: Vec<BiliPgcCard>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliBangumiFollow {
    pub season_id: i64,
    pub media_id: i64,
    pub title: String,
    pub cover: String,
    pub total_count: i64,
    pub is_finish: i64,
    pub badge: String,
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
    /// data: URI 内嵌用的 MPD 全文（绝对 BaseURL，可直接初始化 dashjs）
    pub manifest: String,
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

// ---------- P8 专栏 / 笔记 ----------

/// 专栏作者。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliArticleAuthor {
    pub mid: i64,
    pub name: String,
    pub face: String,
}

/// 专栏统计。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliArticleStats {
    pub view: i64,
    pub like: i64,
    pub coin: i64,
    pub favorite: i64,
    pub reply: i64,
}

/// 专栏详情。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliArticleView {
    pub id: i64,
    pub title: String,
    pub summary: String,
    /// type=3 为 JSON 段落；type=0 为 HTML
    pub content_type: String,
    pub content: String,
    pub pub_time: i64,
    pub words: i64,
    pub author: BiliArticleAuthor,
    pub stats: BiliArticleStats,
    pub is_liked: bool,
    pub tags: Vec<String>,
}

/// 专栏卡片（UP 主页列表 / 搜索）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliArticleCard {
    pub id: i64,
    pub title: String,
    pub summary: String,
    pub banner_url: String,
    pub image_urls: Vec<String>,
    pub pub_time: i64,
    pub words: i64,
    pub view_count: i64,
    pub like_count: i64,
}

/// 专栏列表分页。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliArticleListPage {
    pub articles: Vec<BiliArticleCard>,
    pub total: i64,
}

/// 专栏搜索结果项。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliArticleSearchItem {
    pub id: i64,
    pub title: String,
    pub desc: String,
    pub image_urls: Vec<String>,
    pub pub_time: i64,
    pub like: i64,
    pub reply: i64,
    pub mid: i64,
    pub category_name: String,
}

/// 专栏搜索分页。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliArticleSearchPage {
    pub items: Vec<BiliArticleSearchItem>,
    pub has_more: bool,
}

/// 视频笔记列表项。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliNoteItem {
    pub cvid: i64,
    pub note_id: i64,
    pub title: String,
    pub summary: String,
    pub pub_time: String,
    pub author_name: String,
    pub author_face: String,
    pub likes: i64,
    pub has_like: bool,
    /// 本用户私有笔记（仅登录且为自己可见）
    pub is_private: bool,
}

/// 视频笔记列表分页。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliNoteListPage {
    pub notes: Vec<BiliNoteItem>,
    pub has_more: bool,
}

/// 笔记详情。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiliNoteDetail {
    pub cvid: i64,
    pub note_id: i64,
    pub title: String,
    pub summary: String,
    pub content: String,
    pub pub_time: String,
    pub author_name: String,
    pub author_face: String,
    pub likes: i64,
    pub is_private: bool,
}
