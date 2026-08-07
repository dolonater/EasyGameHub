use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Artist {
    pub id: String,
    pub name: String,
    pub cover: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Album {
    pub provider: String,
    pub id: String,
    pub name: String,
    pub artist: String,
    pub cover: String,
    pub song_count: u32,
    pub publish_time: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Song {
    pub provider: String,
    pub id: String,
    pub name: String,
    pub artist: String,
    pub artists: Vec<Artist>,
    pub album: String,
    pub cover: String,
    pub duration: u64,
    pub fee: Option<u32>,
    pub playable: bool,
    pub language: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Playlist {
    pub provider: String,
    pub id: String,
    pub name: String,
    pub cover: String,
    pub track_count: u32,
    pub creator: String,
    pub subscribed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SongUrlResult {
    pub url: Option<String>,
    pub playable: bool,
    pub trial: bool,
    pub level: Option<String>,
    pub quality: Option<String>,
    pub br: Option<u32>,
    pub reason: Option<String>,
    pub message: Option<String>,
    pub fee: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LoginInfo {
    pub provider: String,
    pub logged_in: bool,
    pub user_id: String,
    pub nickname: String,
    pub avatar: String,
    pub vip_type: Option<u32>,
    pub vip_level: Option<u32>,
    pub is_vip: bool,
    pub is_svip: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LoginQrKeyResult {
    pub unikey: String,
    pub qr_url: String,
    pub qr_image: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LoginQrCheckResult {
    pub code: u32,
    pub message: String,
    pub logged_in: bool,
    pub login_info: Option<LoginInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CaptchaSentResult {
    pub code: u32,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Lyrics {
    pub lyric: String,
    pub translation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum PlaybackQuality {
    Hires,
    Lossless,
    Exhigh,
    #[default]
    Standard,
}

impl PlaybackQuality {
    pub fn as_level(&self) -> &'static str {
        match self {
            Self::Hires => "hires",
            Self::Lossless => "lossless",
            Self::Exhigh => "exhigh",
            Self::Standard => "standard",
        }
    }

    pub fn fallback_chain(&self) -> Vec<PlaybackQuality> {
        let all = [
            PlaybackQuality::Hires,
            PlaybackQuality::Lossless,
            PlaybackQuality::Exhigh,
            PlaybackQuality::Standard,
        ];
        let start = all
            .iter()
            .position(|q| q.as_level() == self.as_level())
            .unwrap_or(all.len() - 1);
        all[start..].to_vec()
    }
}
