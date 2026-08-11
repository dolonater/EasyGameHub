//! 番剧基本信息
//!
//! [查看 API 文档](https://github.com/Yuelioi/bilibili-API-collect/tree/cfc5fddcc8a94b74d91970bb5b4eaeb349addc47/docs/bangumi/info.md)
use crate::models::VipLabel;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// 容错反序列化：字段缺失/为 null/类型漂移时返回默认值（对齐 wiliwili 的 contains+get_to 容错策略）。
pub(crate) mod tolerant {
    use serde::{Deserialize, Deserializer};
    use serde_json::Value;

    fn scalar<'de, D>(d: D) -> Result<Value, D::Error>
    where
        D: Deserializer<'de>,
    {
        Ok(Value::deserialize(d).unwrap_or(Value::Null))
    }

    pub fn de_string<'de, D>(d: D) -> Result<String, D::Error>
    where
        D: Deserializer<'de>,
    {
        Ok(match scalar(d)? {
            Value::String(s) => s,
            Value::Number(n) => n.to_string(),
            _ => String::new(),
        })
    }

    pub fn de_u64<'de, D>(d: D) -> Result<u64, D::Error>
    where
        D: Deserializer<'de>,
    {
        Ok(match scalar(d)? {
            Value::Number(n) => n
                .as_u64()
                .or_else(|| n.as_i64().and_then(|v| u64::try_from(v).ok()))
                .unwrap_or(0),
            Value::String(s) => s.trim().parse().unwrap_or(0),
            _ => 0,
        })
    }

    pub fn de_u32<'de, D>(d: D) -> Result<u32, D::Error>
    where
        D: Deserializer<'de>,
    {
        Ok(de_u64(d)? as u32)
    }

    pub fn de_i64<'de, D>(d: D) -> Result<i64, D::Error>
    where
        D: Deserializer<'de>,
    {
        Ok(match scalar(d)? {
            Value::Number(n) => n
                .as_i64()
                .or_else(|| n.as_u64().and_then(|v| i64::try_from(v).ok()))
                .unwrap_or(0),
            Value::String(s) => s.trim().parse().unwrap_or(0),
            _ => 0,
        })
    }

    pub fn de_f64<'de, D>(d: D) -> Result<f64, D::Error>
    where
        D: Deserializer<'de>,
    {
        Ok(match scalar(d)? {
            Value::Number(n) => n.as_f64().unwrap_or(0.0),
            Value::String(s) => s.trim().parse().unwrap_or(0.0),
            _ => 0.0,
        })
    }

    pub fn de_bool<'de, D>(d: D) -> Result<bool, D::Error>
    where
        D: Deserializer<'de>,
    {
        Ok(match scalar(d)? {
            Value::Bool(b) => b,
            Value::Number(n) => n.as_u64().unwrap_or(0) != 0,
            Value::String(s) => s == "1" || s.eq_ignore_ascii_case("true"),
            _ => false,
        })
    }
}

/// 剧集地区
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BangumiArea {
    /// 中国大陆
    MainlandChina = 1,
    /// 日本
    Japan = 2,
    /// 美国
    UnitedStates = 3,
    /// 英国
    UnitedKingdom = 4,
    /// 加拿大
    Canada = 5,
    /// 中国香港
    HongKong = 6,
    /// 中国台湾
    Taiwan = 7,
    /// 韩国
    SouthKorea = 8,
    /// 法国
    France = 9,
    /// 泰国
    Thailand = 10,
    /// 马来西亚
    Malaysia = 11,
    /// 新加坡
    Singapore = 12,
    /// 西班牙
    Spain = 13,
    /// 俄罗斯
    Russia = 14,
    /// 德国
    Germany = 15,
    /// 其他
    Other = 16,
    /// 丹麦
    Denmark = 17,
    /// 乌克兰
    Ukraine = 18,
    /// 以色列
    Israel = 19,
    /// 伊朗
    Iran = 20,
    /// 保加利亚
    Bulgaria = 21,
    /// 克罗地亚
    Croatia = 22,
    /// 冰岛
    Iceland = 23,
    /// 匈牙利
    Hungary = 24,
    /// 南非
    SouthAfrica = 25,
    /// 印尼
    Indonesia = 26,
    /// 印度
    India = 27,
    /// 哥伦比亚
    Colombia = 28,
    /// 土耳其
    Turkey = 30,
    /// 墨西哥
    Mexico = 31,
    /// 委内瑞拉
    Venezuela = 32,
    /// 巴西
    Brazil = 33,
    /// 希腊
    Greece = 34,
    /// 意大利
    Italy = 35,
    /// 挪威
    Norway = 36,
    /// 捷克
    CzechRepublic = 37,
    /// 摩洛哥
    Morocco = 38,
    /// 新西兰
    NewZealand = 39,
    /// 智利
    Chile = 40,
    /// 比利时
    Belgium = 41,
    /// 波兰
    Poland = 42,
    /// 澳大利亚
    Australia = 43,
    /// 爱尔兰
    Ireland = 44,
    /// 瑞典
    Sweden = 45,
    /// 瑞士
    Switzerland = 46,
    /// 芬兰
    Finland = 47,
    /// 苏联
    SovietUnion = 48,
    /// 荷兰
    Netherlands = 49,
    /// 越南
    Vietnam = 50,
    /// 阿根廷
    Argentina = 51,
    /// 马耳他
    Malta = 52,
    /// 古巴
    Cuba = 53,
    /// 菲律宾
    Philippines = 54,
    /// 哈萨克斯坦
    Kazakhstan = 55,
    /// 黎巴嫩
    Lebanon = 56,
    /// 塞浦路斯
    Cyprus = 57,
    /// 卡塔尔
    Qatar = 58,
    /// 阿联酋
    UnitedArabEmirates = 59,
    /// 奥地利
    Austria = 60,
    /// 西德
    WestGermany = 61,
    /// 卢森堡
    Luxembourg = 62,
    /// 罗马尼亚
    Romania = 63,
    /// 印度尼西亚
    Indonesia2 = 64,
    /// 南斯拉夫
    Yugoslavia = 65,
    /// 蒙古
    Mongolia = 66,
    /// 葡萄牙
    Portugal = 70,
}

impl BangumiArea {
    pub fn as_u32(self) -> u32 {
        self as u32
    }
}

/// 剧集类型
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BangumiType {
    /// 番剧
    Anime = 1,
    /// 电影
    Movie = 2,
    /// 纪录片
    Documentary = 3,
    /// 国创
    ChineseAnimation = 4,
    /// 电视剧
    TVSeries = 5,
    /// 漫画
    Manga = 6,
    /// 综艺
    Variety = 7,
}

impl BangumiType {
    pub fn as_u32(self) -> u32 {
        self as u32
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiInfoResult {
    pub media: BangumiMedia,
    pub review: Option<BangumiReview>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiMedia {
    pub areas: Vec<BangumiAreaInfo>,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub cover: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub horizontal_picture: String,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub media_id: u64,
    pub new_ep: BangumiMediaNewEp,
    pub rating: BangumiRating,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub season_id: u64,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub share_url: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub title: String,
    pub r#type: u32,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub type_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiAreaInfo {
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub id: u32,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiMediaNewEp {
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub id: u64,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub index: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub index_show: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiDetailNewEp {
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub id: u64,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub desc: String,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub is_new: u32,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiRating {
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub count: u64,
    #[serde(default, deserialize_with = "tolerant::de_f64")]
    pub score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiReview {
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub is_coin: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub is_open: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiDetailResult {
    pub activity: Option<BangumiActivity>,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub actors: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub alias: String,
    pub areas: Vec<BangumiAreaInfo>,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub bkg_cover: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub cover: String,
    #[serde(default, deserialize_with = "tolerant::de_bool")]
    pub delivery_fragment_video: bool,
    #[serde(default, deserialize_with = "tolerant::de_bool")]
    pub enable_vt: bool,
    pub episodes: Vec<BangumiEpisode>,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub evaluate: String,
    pub freya: Option<BangumiFreya>,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub hide_ep_vv_vt_dm: u32,
    pub icon_font: Option<BangumiIconFont>,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub jp_title: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub link: String,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub media_id: u64,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub mode: u32,
    pub multi_view_info: Option<BangumiMultiViewInfo>,
    pub new_ep: BangumiDetailNewEp,
    pub payment: Option<BangumiPayment>,
    #[serde(rename = "payPack")]
    pub pay_pack: Option<BangumiPayPack>,
    pub play_strategy: Option<BangumiPlayStrategy>,
    pub positive: Option<BangumiPositive>,
    pub publish: BangumiPublish,
    pub rating: Option<BangumiRating>,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub record: String,
    pub rights: BangumiRights,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub season_id: u64,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub season_title: String,
    pub seasons: Vec<BangumiSeason>,
    pub section: Option<Vec<BangumiSection>>,
    pub section_bottom_desc: Option<String>,
    pub series: Option<BangumiSeries>,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub share_copy: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub share_sub_title: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub share_url: String,
    pub show: Option<BangumiShow>,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub show_season_type: u32,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub square_cover: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub staff: String,
    pub stat: BangumiStat,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub status: u32,
    pub styles: Vec<String>,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub subtitle: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub title: String,
    #[serde(default, deserialize_with = "tolerant::de_i64")]
    pub total: i64,
    pub r#type: u32,
    pub up_info: Option<BangumiUpInfo>,
    pub user_status: Option<BangumiUserStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiActivity {
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub head_bg_url: String,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub id: u64,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub title: String,
    #[serde(default)]
    pub link: Option<String>,
    #[serde(default)]
    pub pendants: Option<Vec<BangumiPendant>>,
    #[serde(default)]
    pub cover: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiPendant {
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub image: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub name: String,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub pid: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiEpisode {
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub aid: u64,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub badge: String,
    #[serde(default)]
    pub badge_info: Option<BangumiBadgeInfo>,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub badge_type: u32,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub bvid: String,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub cid: u64,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub cover: String,
    #[serde(default)]
    pub dimension: Option<BangumiDimension>,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub duration: u64,
    #[serde(default, deserialize_with = "tolerant::de_bool")]
    pub enable_vt: bool,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub ep_id: u64,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub from: String,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub id: u64,
    #[serde(default)]
    pub interaction: Option<BangumiInteraction>,
    #[serde(default, deserialize_with = "tolerant::de_bool")]
    pub is_view_hide: bool,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub link: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub long_title: String,
    #[serde(default)]
    pub multi_view_eps: Option<Vec<BangumiMultiViewEp>>,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub pub_time: u64,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub pv: u64,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub release_date: String,
    #[serde(default)]
    pub rights: Option<BangumiEpisodeRights>,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub section_type: u32,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub share_copy: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub share_url: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub short_link: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub show_title: String,
    #[serde(
        rename = "showDrmLoginDialog",
        default,
        deserialize_with = "tolerant::de_bool"
    )]
    pub show_drm_login_dialog: bool,
    #[serde(default)]
    pub skip: Option<BangumiSkip>,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub status: u32,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub subtitle: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub title: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub vid: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BangumiBadgeInfo {
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub bg_color: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub bg_color_night: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiDimension {
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub height: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub rotate: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub width: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiInteraction {
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub graph_version: u32,
    #[serde(default, deserialize_with = "tolerant::de_bool")]
    pub interaction: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiMultiViewEp {
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub ep_id: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiEpisodeRights {
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub allow_dm: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub allow_download: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub area_limit: u32,

    #[serde(default)]
    pub allow_demand: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiSkip {
    #[serde(default)]
    pub ed: Option<BangumiSkipTime>,
    #[serde(default)]
    pub op: Option<BangumiSkipTime>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiSkipTime {
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub end: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub start: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiFreya {
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub bubble_desc: String,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub bubble_show_cnt: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub icon_show: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiIconFont {
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub name: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiMultiViewInfo {
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub changing_dance: String,
    #[serde(default, deserialize_with = "tolerant::de_bool")]
    pub is_multi_view_season: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiPayment {
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub discount: u32,
    #[serde(default)]
    pub pay_type: BangumiPayType,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub price: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub promotion: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub tip: String,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub view_start_time: u64,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub vip_discount: u32,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub vip_first_promotion: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub vip_price: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub vip_promotion: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BangumiPayType {
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub allow_discount: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub allow_pack: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub allow_ticket: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub allow_time_limit: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub allow_vip_discount: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub forbid_bb: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiPayPack {
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub id: u64,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub not_paid_text_for_app: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub paid_text_for_app: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub pay_pack_url: String,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub status: u32,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiPlayStrategy {
    #[serde(default)]
    pub strategies: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiPositive {
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub id: u64,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiPublish {
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub is_finish: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub is_started: u32,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub pub_time: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub pub_time_show: String,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub unknow_pub_date: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub weekday: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiRights {
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub allow_bp: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub allow_bp_rank: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub allow_download: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub allow_review: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub area_limit: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub ban_area_show: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub can_watch: u32,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub copyright: String,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub forbid_pre: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub freya_white: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub is_cover_show: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub is_preview: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub only_vip_download: u32,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub resource: String,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub watch_platform: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiSeason {
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub badge: String,
    #[serde(default)]
    pub badge_info: Option<BangumiBadgeInfo>,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub badge_type: u32,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub cover: String,
    #[serde(default, deserialize_with = "tolerant::de_bool")]
    pub enable_vt: bool,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub horizontal_cover_1610: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub horizontal_cover_169: String,
    #[serde(default)]
    pub icon_font: Option<BangumiIconFont>,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub media_id: u64,
    #[serde(default)]
    pub new_ep: Option<BangumiSeasonNewEp>,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub season_id: u64,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub season_title: String,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub season_type: u32,
    #[serde(default)]
    pub stat: Option<BangumiSeasonStat>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiSeasonNewEp {
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub cover: String,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub id: u64,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub index_show: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiSeasonStat {
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub favorites: u64,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub series_follow: u64,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub views: u64,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub vt: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiSection {
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub attr: u32,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub episode_id: u64,
    #[serde(default)]
    pub episode_ids: Vec<u64>,
    #[serde(default)]
    pub episodes: Vec<BangumiSectionEpisode>,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub id: u64,
    #[serde(default)]
    pub report: Option<BangumiReport>,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub title: String,
    pub r#type: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub type2: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiSectionEpisode {
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub aid: u64,
    #[serde(default)]
    pub archive_attr: Option<u32>,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub badge: String,
    #[serde(default)]
    pub badge_info: Option<BangumiBadgeInfo>,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub badge_type: u32,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub bvid: String,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub cid: u64,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub cover: String,
    #[serde(default)]
    pub dimension: Option<BangumiDimension>,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub duration: u64,
    #[serde(default, deserialize_with = "tolerant::de_bool")]
    pub enable_vt: bool,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub ep_id: u64,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub from: String,
    #[serde(default)]
    pub icon_font: Option<BangumiIconFont>,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub id: u64,
    #[serde(default)]
    pub interaction: Option<BangumiInteraction>,
    #[serde(default, deserialize_with = "tolerant::de_bool")]
    pub is_view_hide: bool,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub link: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub link_type: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub long_title: String,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub pub_time: u64,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub pv: u64,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub release_date: String,
    #[serde(default)]
    pub report: Option<BangumiReport>,
    #[serde(default)]
    pub rights: Option<BangumiEpisodeRights>,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub section_type: u32,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub share_copy: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub share_url: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub short_link: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub show_title: String,
    #[serde(
        rename = "showDrmLoginDialog",
        default,
        deserialize_with = "tolerant::de_bool"
    )]
    pub show_drm_login_dialog: bool,
    #[serde(default)]
    pub skip: Option<BangumiSkip>,
    #[serde(default)]
    pub stat: Option<BangumiStat>,
    #[serde(default)]
    pub stat_for_unity: Option<BangumiStatForUnity>,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub status: u32,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub subtitle: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub title: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub toast_title: String,
    #[serde(default)]
    pub up_info: Option<BangumiUpInfo>,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub vid: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiReport {
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub aid: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub ep_title: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub position: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub season_id: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub season_type: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub section_id: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub section_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiStatForUnity {
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub coin: u64,
    #[serde(default)]
    pub danmaku: Option<BangumiDanmaku>,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub likes: u64,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub reply: u64,
    #[serde(default)]
    pub vt: Option<BangumiVt>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiDanmaku {
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub icon: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub pure_text: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub text: String,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub value: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiVt {
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub icon: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub pure_text: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub text: String,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub value: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiStat {
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub coins: u64,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub danmakus: u64,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub favorite: u64,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub favorites: u64,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub follow_text: String,
    #[serde(default)]
    pub hot: Option<u64>,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub likes: u64,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub reply: u64,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub share: u64,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub views: u64,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub vt: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiSeries {
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub display_type: u32,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub series_id: u64,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub series_title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiShow {
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub wide_screen: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiUpInfo {
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub avatar: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub avatar_subscript_url: String,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub follower: u64,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub is_follow: u32,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub mid: u64,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub nickname_color: String,
    #[serde(default)]
    pub pendant: Option<BangumiPendant>,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub theme_type: u32,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub uname: String,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub verify_type: u32,
    #[serde(default)]
    pub vip_label: Option<VipLabel>,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub vip_status: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub vip_type: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiUserStatus {
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub area_limit: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub ban_area_show: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub follow: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub follow_status: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub login: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub pay: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub pay_pack_paid: u32,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub sponsor: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiSectionResult {
    #[serde(default)]
    pub main_section: BangumiMainSection,
    #[serde(default)]
    pub section: Vec<BangumiMainSection>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BangumiMainSection {
    #[serde(default)]
    pub episodes: Vec<BangumiSectionEpisodeInfo>,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub id: u64,
    pub r#type: u32,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BangumiSectionEpisodeInfo {
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub aid: u64,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub badge: String,
    #[serde(default)]
    pub badge_info: BangumiBadgeInfo,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub badge_type: u32,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub cid: u64,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub cover: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub from: String,
    #[serde(default, deserialize_with = "tolerant::de_u64")]
    pub id: u64,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub is_premiere: u32,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub long_title: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub share_url: String,
    #[serde(default, deserialize_with = "tolerant::de_u32")]
    pub status: u32,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub title: String,
    #[serde(default, deserialize_with = "tolerant::de_string")]
    pub vid: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bangumi::params::{BangumiDetailParams, BangumiInfoParams, BangumiSectionsParams};
    use crate::ids::{EpisodeId, MediaId, SeasonId};
    use crate::probe::contract::HttpMethod;
    use crate::probe::endpoint_contract::EndpointContract;
    use crate::{ApiEnvelope, BpiClient, BpiError, BpiResult};

    const TEST_SEASON_ID: u64 = 1172; // ssid
    const TEST_EP_ID: u64 = 21265; // epid
    const TEST_MEDIA_ID: u64 = 28220978; //  mdid

    fn contract(endpoint: &str) -> BpiResult<EndpointContract> {
        let bytes = match endpoint {
            "review-user" => {
                include_bytes!("../../tests/contracts/bangumi/info/review-user/contract.json")
                    .as_slice()
            }
            "season-detail-season" => include_bytes!(
                "../../tests/contracts/bangumi/info/season-detail-season/contract.json"
            )
            .as_slice(),
            "season-detail-episode" => include_bytes!(
                "../../tests/contracts/bangumi/info/season-detail-episode/contract.json"
            )
            .as_slice(),
            "season-section" => {
                include_bytes!("../../tests/contracts/bangumi/info/season-section/contract.json")
                    .as_slice()
            }
            _ => unreachable!("unknown bangumi info contract"),
        };

        EndpointContract::from_slice(bytes)
    }

    #[ignore = "legacy live API test; requires explicit BPI_LIVE_TEST review"]
    #[tokio::test]
    async fn test_bangumi_info() -> Result<(), Box<BpiError>> {
        let bpi = BpiClient::new().expect("client should build");
        let data = bpi
            .bangumi()
            .info(BangumiInfoParams::new(MediaId::new(TEST_MEDIA_ID)?))
            .await?;
        tracing::info!("{:#?}", data);

        assert_eq!(data.media.media_id, TEST_MEDIA_ID);
        assert!(!data.media.title.is_empty());
        assert!(!data.media.areas.is_empty());

        Ok(())
    }

    #[ignore = "legacy live API test; requires explicit BPI_LIVE_TEST review"]
    #[tokio::test]
    async fn test_bangumi_detail_by_season_id() -> Result<(), Box<BpiError>> {
        let bpi = BpiClient::new().expect("client should build");
        let data = bpi
            .bangumi()
            .detail_by_season_id(SeasonId::new(TEST_SEASON_ID)?)
            .await?;
        tracing::info!("{:#?}", data);

        assert_eq!(data.season_id, TEST_SEASON_ID);
        assert!(!data.title.is_empty());
        assert!(!data.episodes.is_empty());

        Ok(())
    }

    #[ignore = "legacy live API test; requires explicit BPI_LIVE_TEST review"]
    #[tokio::test]
    async fn test_bangumi_detail_by_epid() -> Result<(), Box<BpiError>> {
        let bpi = BpiClient::new().expect("client should build");
        let data = bpi
            .bangumi()
            .detail_by_ep_id(EpisodeId::new(TEST_EP_ID)?)
            .await?;
        tracing::info!("{:#?}", data);

        assert!(!data.title.is_empty());
        assert!(!data.episodes.is_empty());

        Ok(())
    }

    #[ignore = "legacy live API test; requires explicit BPI_LIVE_TEST review"]
    #[tokio::test]
    async fn test_bangumi_section() -> Result<(), Box<BpiError>> {
        let bpi = BpiClient::new().expect("client should build");
        let data = bpi
            .bangumi()
            .sections(BangumiSectionsParams::new(SeasonId::new(TEST_SEASON_ID)?))
            .await?;
        tracing::info!("{:#?}", data);

        assert!(!data.main_section.episodes.is_empty());

        Ok(())
    }

    #[test]
    fn bangumi_review_user_contract_matches_endpoint_request() -> BpiResult<()> {
        let contract = contract("review-user")?;
        let params = BangumiInfoParams::new(MediaId::new(TEST_MEDIA_ID)?);

        assert_eq!(contract.name, "bangumi.info.review_user");
        assert_eq!(contract.request.method, HttpMethod::Get);
        assert_eq!(
            contract.request.url.as_str(),
            "https://api.bilibili.com/pgc/review/user"
        );
        assert_eq!(
            contract.request.query.get("media_id").map(String::as_str),
            Some("28220978")
        );
        assert_eq!(
            params.query_pairs(),
            vec![("media_id", "28220978".to_string())]
        );
        assert_eq!(contract.cases.len(), 3);
        assert_eq!(
            contract.cases[0].response.rust_model.as_deref(),
            Some("BangumiInfoResult")
        );
        Ok(())
    }

    #[test]
    fn bangumi_review_user_response_fixtures_parse_declared_model() -> BpiResult<()> {
        for bytes in [
            include_bytes!(
                "../../tests/contracts/bangumi/info/review-user/responses/anonymous.success.json"
            )
            .as_slice(),
            include_bytes!(
                "../../tests/contracts/bangumi/info/review-user/responses/normal.success.json"
            )
            .as_slice(),
            include_bytes!(
                "../../tests/contracts/bangumi/info/review-user/responses/vip.success.json"
            )
            .as_slice(),
        ] {
            let payload = ApiEnvelope::<BangumiInfoResult>::from_slice(bytes)?.into_payload()?;

            assert_eq!(payload.media.media_id, TEST_MEDIA_ID);
            assert_eq!(payload.media.season_id, TEST_SEASON_ID);
            assert!(!payload.media.title.is_empty());
        }
        Ok(())
    }

    #[test]
    fn bangumi_detail_by_season_contract_matches_endpoint_request() -> BpiResult<()> {
        let contract = contract("season-detail-season")?;
        let params = BangumiDetailParams::from_season_id(SeasonId::new(TEST_SEASON_ID)?);

        assert_eq!(contract.name, "bangumi.info.season_detail_by_season_id");
        assert_eq!(contract.request.method, HttpMethod::Get);
        assert_eq!(
            contract.request.url.as_str(),
            "https://api.bilibili.com/pgc/view/web/season"
        );
        assert_eq!(
            contract.request.query.get("season_id").map(String::as_str),
            Some("1172")
        );
        assert_eq!(
            params.query_pairs(),
            vec![("season_id", "1172".to_string())]
        );
        assert_eq!(contract.cases.len(), 3);
        assert_eq!(
            contract.cases[0].response.rust_model.as_deref(),
            Some("BangumiDetailResult")
        );
        Ok(())
    }

    #[test]
    fn bangumi_detail_by_episode_contract_matches_endpoint_request() -> BpiResult<()> {
        let contract = contract("season-detail-episode")?;
        let params = BangumiDetailParams::from_episode_id(EpisodeId::new(TEST_EP_ID)?);

        assert_eq!(contract.name, "bangumi.info.season_detail_by_ep_id");
        assert_eq!(contract.request.method, HttpMethod::Get);
        assert_eq!(
            contract.request.url.as_str(),
            "https://api.bilibili.com/pgc/view/web/season"
        );
        assert_eq!(
            contract.request.query.get("ep_id").map(String::as_str),
            Some("21265")
        );
        assert_eq!(params.query_pairs(), vec![("ep_id", "21265".to_string())]);
        assert_eq!(contract.cases.len(), 3);
        assert_eq!(
            contract.cases[0].response.rust_model.as_deref(),
            Some("BangumiDetailResult")
        );
        Ok(())
    }

    #[test]
    fn bangumi_detail_response_fixtures_parse_declared_model() -> BpiResult<()> {
        for bytes in [
            include_bytes!(
                "../../tests/contracts/bangumi/info/season-detail-season/responses/anonymous.success.json"
            )
            .as_slice(),
            include_bytes!(
                "../../tests/contracts/bangumi/info/season-detail-season/responses/normal.success.json"
            )
            .as_slice(),
            include_bytes!(
                "../../tests/contracts/bangumi/info/season-detail-season/responses/vip.success.json"
            )
            .as_slice(),
            include_bytes!(
                "../../tests/contracts/bangumi/info/season-detail-episode/responses/anonymous.success.json"
            )
            .as_slice(),
            include_bytes!(
                "../../tests/contracts/bangumi/info/season-detail-episode/responses/normal.success.json"
            )
            .as_slice(),
            include_bytes!(
                "../../tests/contracts/bangumi/info/season-detail-episode/responses/vip.success.json"
            )
            .as_slice(),
        ] {
            let payload = ApiEnvelope::<BangumiDetailResult>::from_slice(bytes)?.into_payload()?;

            assert_eq!(payload.season_id, TEST_SEASON_ID);
            assert!(!payload.title.is_empty());
            assert!(!payload.episodes.is_empty());
        }
        Ok(())
    }

    #[test]
    fn bangumi_section_contract_matches_endpoint_request() -> BpiResult<()> {
        let contract = contract("season-section")?;
        let params = BangumiSectionsParams::new(SeasonId::new(TEST_SEASON_ID)?);

        assert_eq!(contract.name, "bangumi.info.season_section");
        assert_eq!(contract.request.method, HttpMethod::Get);
        assert_eq!(
            contract.request.url.as_str(),
            "https://api.bilibili.com/pgc/web/season/section"
        );
        assert_eq!(
            contract.request.query.get("season_id").map(String::as_str),
            Some("1172")
        );
        assert_eq!(
            params.query_pairs(),
            vec![("season_id", "1172".to_string())]
        );
        assert_eq!(contract.cases.len(), 3);
        assert_eq!(
            contract.cases[0].response.rust_model.as_deref(),
            Some("BangumiSectionResult")
        );
        Ok(())
    }

    #[test]
    fn bangumi_section_response_fixtures_parse_declared_model() -> BpiResult<()> {
        for bytes in [
            include_bytes!(
                "../../tests/contracts/bangumi/info/season-section/responses/anonymous.success.json"
            )
            .as_slice(),
            include_bytes!(
                "../../tests/contracts/bangumi/info/season-section/responses/normal.success.json"
            )
            .as_slice(),
            include_bytes!(
                "../../tests/contracts/bangumi/info/season-section/responses/vip.success.json"
            )
            .as_slice(),
        ] {
            let payload = ApiEnvelope::<BangumiSectionResult>::from_slice(bytes)?.into_payload()?;

            assert!(!payload.main_section.episodes.is_empty());
        }
        Ok(())
    }

    fn local_probe_body(endpoint: &str, profile: &str) -> Option<serde_json::Value> {
        let path = format!("target/bpi-probe-runs/bangumi/info/{endpoint}/{profile}.response.json");
        let bytes = std::fs::read(path).ok()?;
        let value: serde_json::Value = serde_json::from_slice(&bytes).ok()?;
        value
            .get("response")
            .and_then(|response| response.get("body"))
            .cloned()
    }

    #[test]
    fn bangumi_info_models_match_local_probe_outputs_when_available() -> BpiResult<()> {
        for profile in ["anonymous", "normal", "vip"] {
            if let Some(body) = local_probe_body("review-user", profile) {
                let payload = serde_json::from_value::<ApiEnvelope<BangumiInfoResult>>(body)?
                    .into_payload()?;

                assert_eq!(payload.media.media_id, TEST_MEDIA_ID);
            }

            if let Some(body) = local_probe_body("season-detail-season", profile) {
                let payload = serde_json::from_value::<ApiEnvelope<BangumiDetailResult>>(body)?
                    .into_payload()?;

                assert_eq!(payload.season_id, TEST_SEASON_ID);
            }

            if let Some(body) = local_probe_body("season-detail-episode", profile) {
                let payload = serde_json::from_value::<ApiEnvelope<BangumiDetailResult>>(body)?
                    .into_payload()?;

                assert_eq!(payload.season_id, TEST_SEASON_ID);
            }

            if let Some(body) = local_probe_body("season-section", profile) {
                let payload = serde_json::from_value::<ApiEnvelope<BangumiSectionResult>>(body)?
                    .into_payload()?;

                assert!(!payload.main_section.episodes.is_empty());
            }
        }
        Ok(())
    }
}
