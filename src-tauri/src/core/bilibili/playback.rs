use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use bpi_rs::bangumi::videostream_url::BangumiVideoStreamData;
use bpi_rs::models::stream::{
    DashDolby as StreamDashDolby, DashFlac as StreamDashFlac, DashTrack, Durl, SegmentBase,
};
use bpi_rs::video::videostream_url::{
    DashDolby, DashFlac, DashInfo, DashStream, DurlInfo, PlayUrlResponseData, SupportFormat,
};
use bpi_rs::BpiError;
use rand::RngCore;
use url::Url;

use super::models::{BiliPlaybackSource, BiliQualityOption};

const SESSION_TTL_SECS: u64 = 2 * 60 * 60;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlaybackSession {
    pub playback_id: String,
    pub bvid: String,
    pub aid: u64,
    pub cid: u64,
    pub duration_ms: u64,
    pub created_at: u64,
    pub expires_at: u64,
    pub tracks: HashMap<String, PlaybackTrack>,
    pub direct_track_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlaybackTrack {
    pub track_id: String,
    pub kind: PlaybackTrackKind,
    pub quality: u64,
    pub label: String,
    pub codecs: String,
    pub mime_type: String,
    pub base_url: String,
    pub backup_urls: Vec<String>,
    pub bandwidth: u64,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub size: Option<u64>,
    pub initialization_range: Option<String>,
    pub index_range: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlaybackTrackKind {
    Video,
    Audio,
}

/// 播放偏好（P7）：编码优先序与音质。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PlaybackPreferences {
    pub codec: CodecPreference,
    pub audio: AudioPreference,
}

impl Default for PlaybackPreferences {
    fn default() -> Self {
        Self {
            codec: CodecPreference::Avc,
            audio: AudioPreference::Standard,
        }
    }
}

/// 视频编码优先序（AVC 为保底，播放失败自动降级 AVC）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CodecPreference {
    Avc,
    Hevc,
    Av1,
}

impl CodecPreference {
    pub fn parse(value: Option<&str>) -> Self {
        match value
            .map(str::trim)
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str()
        {
            "hevc" => Self::Hevc,
            "av1" => Self::Av1,
            _ => Self::Avc,
        }
    }
}

/// 音质偏好（FLAC 需大会员，失败自动降级标准 AAC）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AudioPreference {
    Standard,
    Flac,
}

impl AudioPreference {
    pub fn parse(value: Option<&str>) -> Self {
        match value
            .map(str::trim)
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str()
        {
            "flac" => Self::Flac,
            _ => Self::Standard,
        }
    }
}

static PLAYBACK_SESSIONS: OnceLock<Mutex<HashMap<String, PlaybackSession>>> = OnceLock::new();

pub fn create_session_from_stream(
    data: &PlayUrlResponseData,
    bvid: impl Into<String>,
    aid: u64,
    cid: u64,
    proxy_port: u16,
) -> Result<(PlaybackSession, BiliPlaybackSource), BpiError> {
    create_session_from_stream_with_options(
        data,
        bvid,
        aid,
        cid,
        proxy_port,
        false,
        PlaybackPreferences::default(),
    )
}

pub fn create_session_from_stream_with_options(
    data: &PlayUrlResponseData,
    bvid: impl Into<String>,
    aid: u64,
    cid: u64,
    proxy_port: u16,
    prefer_direct: bool,
    preferences: PlaybackPreferences,
) -> Result<(PlaybackSession, BiliPlaybackSource), BpiError> {
    let now = now_unix();
    let playback_id = new_playback_id();
    let mut tracks = HashMap::new();
    let mut direct_track_id = None;

    if prefer_direct {
        maybe_insert_direct_track(data, &mut tracks, &mut direct_track_id);
    }

    if !has_video_track(&tracks) {
        insert_dash_tracks(data, &mut tracks, preferences);
    }

    // 编码降级：偏好编码无可用 track 时自动回退 AVC（会话内重建，不重新请求）
    if !has_video_track(&tracks) && preferences.codec != CodecPreference::Avc {
        insert_dash_tracks(
            data,
            &mut tracks,
            PlaybackPreferences {
                codec: CodecPreference::Avc,
                audio: preferences.audio,
            },
        );
    }

    if !has_video_track(&tracks) {
        maybe_insert_direct_track(data, &mut tracks, &mut direct_track_id);
    }

    if !has_video_track(&tracks) {
        return Err(BpiError::unsupported_response(
            "play url has no supported video tracks",
        ));
    }

    let duration_ms = playback_duration_ms(data)
        .ok_or_else(|| BpiError::unsupported_response("play url has no playable duration"))?;
    let session = PlaybackSession {
        playback_id: playback_id.clone(),
        bvid: bvid.into(),
        aid,
        cid,
        duration_ms,
        created_at: now,
        expires_at: now + SESSION_TTL_SECS,
        tracks,
        direct_track_id,
    };
    let source = source_for_session(&session, proxy_port);

    Ok((session, source))
}

/// 番剧取流创建播放会话：先把 `BangumiVideoStreamData` 字段级转换为视频播放
/// 通用的 `PlayUrlResponseData`（dash/durl/timelength 结构一致但类型不同），
/// 再复用现有会话/MPD/代理流程。视频播放路径不受影响。
pub fn create_session_from_bangumi_stream(
    data: &BangumiVideoStreamData,
    bvid: impl Into<String>,
    aid: u64,
    cid: u64,
    proxy_port: u16,
    prefer_direct: bool,
    preferences: PlaybackPreferences,
) -> Result<(PlaybackSession, BiliPlaybackSource), BpiError> {
    let play_url = bangumi_stream_to_play_url(data)?;
    create_session_from_stream_with_options(
        &play_url,
        bvid,
        aid,
        cid,
        proxy_port,
        prefer_direct,
        preferences,
    )
}

fn bangumi_stream_to_play_url(
    data: &BangumiVideoStreamData,
) -> Result<PlayUrlResponseData, BpiError> {
    let base = &data.base;
    let dash = base.dash.as_ref().map(|d| DashInfo {
        video: d.video.iter().map(dash_track_to_stream).collect(),
        audio: d.audio.iter().map(dash_track_to_stream).collect(),
        dolby: d.dolby.as_ref().map(stream_dolby_to_dolby),
        flac: d.flac.as_ref().map(stream_flac_to_flac),
        duration: d.duration,
    });
    let durl = base
        .durl
        .as_ref()
        .map(|urls| urls.iter().map(durl_to_durl_info).collect());
    let timelength = dash
        .as_ref()
        .map(|d| d.duration)
        .or_else(|| {
            durl.as_ref()
                .and_then(|urls: &Vec<DurlInfo>| urls.first().map(|d| d.length))
        })
        .ok_or_else(|| {
            BpiError::unsupported_response("bangumi play url has no playable duration")
        })?;
    Ok(PlayUrlResponseData {
        from: "bangumi".to_string(),
        result: "succeed".to_string(),
        message: String::new(),
        quality: base.quality as u64,
        format: base.format.clone(),
        timelength,
        accept_format: base.accept_format.clone(),
        accept_description: Vec::new(),
        accept_quality: Vec::new(),
        video_codecid: base.video_codecid as u8,
        seek_param: String::new(),
        seek_type: String::new(),
        durl,
        dash,
        support_formats: Vec::<SupportFormat>::new(),
        high_format: None,
        last_play_time: -1,
        last_play_cid: -1,
    })
}

fn dash_track_to_stream(track: &DashTrack) -> DashStream {
    DashStream {
        id: track.id as u64,
        base_url: track.base_url.clone(),
        backup_url: track.backup_url.clone(),
        bandwidth: track.bandwidth as u64,
        mime_type: track.mime_type.clone(),
        codecs: track.codecs.clone(),
        width: Some(track.width),
        height: Some(track.height),
        frame_rate: Some(track.frame_rate.clone()),
        sar: Some(track.sar.clone()),
        start_with_sap: Some(track.start_with_sap as u8),
        segment_base: serde_json::to_value(&track.segment_base).ok(),
        md5: None,
        size: Some(track.size),
        db_type: Some(track.codecid as u8),
        r#type: None,
        stream_name: None,
        orientation: None,
    }
}

fn stream_dolby_to_dolby(dolby: &StreamDashDolby) -> DashDolby {
    DashDolby {
        r#type: dolby.r#type as u8,
        audio: Some(dolby.audio.iter().map(dash_track_to_stream).collect()),
    }
}

fn stream_flac_to_flac(flac: &StreamDashFlac) -> DashFlac {
    DashFlac {
        audio: vec![dash_track_to_stream(&flac.audio)],
    }
}

fn durl_to_durl_info(durl: &Durl) -> DurlInfo {
    DurlInfo {
        order: durl.order,
        length: durl.length,
        size: durl.size,
        ahead: durl.ahead.clone(),
        vhead: durl.vhead.clone(),
        url: durl.url.clone(),
        backup_url: durl.backup_url.clone(),
    }
}

pub fn source_for_session(session: &PlaybackSession, proxy_port: u16) -> BiliPlaybackSource {
    BiliPlaybackSource {
        playback_id: session.playback_id.clone(),
        manifest_url: format!(
            "http://127.0.0.1:{proxy_port}/bilibili/dash/{}/manifest.mpd",
            session.playback_id
        ),
        // data: URI 内嵌 MPD（参考 bili-rust：manifest 零往返，起播更快）；manifest_url 保留兜底
        manifest: build_mpd(session, proxy_port),
        direct_url: session.direct_track_id.as_ref().map(|track_id| {
            format!(
                "http://127.0.0.1:{proxy_port}/bilibili/media/{}/{track_id}",
                session.playback_id
            )
        }),
        qualities: quality_options(session),
        expires_at: session.expires_at,
    }
}

pub fn build_mpd(session: &PlaybackSession, proxy_port: u16) -> String {
    // dashjs 对 >1000 的时长做"毫秒猜测"（÷1000），反向利用：写毫秒值，猜测后即真实秒数。
    // 真实 1494 秒 → PT1494000S → dashjs 解析 1494000 → ÷1000 = 1494 ✓
    let duration = format!("PT{}S", session.duration_ms);
    let mut output = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" mediaPresentationDuration="{duration}" minBufferTime="PT1.5S" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011">
  <Period duration="{duration}">
"#
    );
    append_adaptation_set(&mut output, session, PlaybackTrackKind::Video, proxy_port);
    append_adaptation_set(&mut output, session, PlaybackTrackKind::Audio, proxy_port);
    output.push_str("  </Period>\n</MPD>\n");
    output
}

pub fn quality_options(session: &PlaybackSession) -> Vec<BiliQualityOption> {
    let mut options: Vec<_> = session
        .tracks
        .values()
        .filter(|track| track.kind == PlaybackTrackKind::Video)
        .map(|track| BiliQualityOption {
            id: track.track_id.clone(),
            quality: track.quality,
            label: track.label.clone(),
            codecs: track.codecs.clone(),
            width: track.width,
            height: track.height,
            bandwidth: track.bandwidth,
        })
        .collect();
    options.sort_by(|a, b| b.quality.cmp(&a.quality).then_with(|| a.id.cmp(&b.id)));
    options
}

pub fn insert_session(session: PlaybackSession) -> String {
    let playback_id = session.playback_id.clone();
    sessions()
        .lock()
        .unwrap()
        .insert(playback_id.clone(), session);
    playback_id
}

pub fn get_session(playback_id: &str) -> Option<PlaybackSession> {
    cleanup_expired_sessions(now_unix());
    sessions().lock().ok()?.get(playback_id).cloned()
}

pub fn get_track(playback_id: &str, track_id: &str) -> Option<PlaybackTrack> {
    get_session(playback_id).and_then(|session| session.tracks.get(track_id).cloned())
}

pub fn cleanup_expired_sessions(now: u64) {
    if let Ok(mut sessions) = sessions().lock() {
        sessions.retain(|_, session| session.expires_at > now);
    }
}

pub fn remove_session(playback_id: &str) {
    if let Ok(mut sessions) = sessions().lock() {
        sessions.remove(playback_id);
    }
}

fn sessions() -> &'static Mutex<HashMap<String, PlaybackSession>> {
    PLAYBACK_SESSIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn dash_stream_to_track(
    stream: &DashStream,
    kind: PlaybackTrackKind,
    index: usize,
) -> PlaybackTrack {
    let prefix = match kind {
        PlaybackTrackKind::Video => "video",
        PlaybackTrackKind::Audio => "audio",
    };
    PlaybackTrack {
        track_id: format!("{prefix}-{}-{index}", stream.id),
        kind,
        quality: stream.id,
        label: stream
            .stream_name
            .clone()
            .unwrap_or_else(|| stream.id.to_string()),
        codecs: stream.codecs.clone(),
        mime_type: stream.mime_type.clone(),
        base_url: stream.base_url.clone(),
        backup_urls: stream.backup_url.clone(),
        bandwidth: stream.bandwidth,
        width: stream.width,
        height: stream.height,
        size: stream.size,
        initialization_range: segment_base_field(stream, "initialization"),
        index_range: segment_base_field(stream, "index_range"),
    }
}

fn has_video_track(tracks: &HashMap<String, PlaybackTrack>) -> bool {
    tracks
        .values()
        .any(|track| track.kind == PlaybackTrackKind::Video)
}

fn insert_dash_tracks(
    data: &PlayUrlResponseData,
    tracks: &mut HashMap<String, PlaybackTrack>,
    preferences: PlaybackPreferences,
) {
    if let Some(dash) = &data.dash {
        for (index, stream) in dash.video.iter().enumerate() {
            if !is_supported_dash_stream(stream, PlaybackTrackKind::Video, preferences) {
                continue;
            }
            let track = dash_stream_to_track(stream, PlaybackTrackKind::Video, index);
            tracks.insert(track.track_id.clone(), track);
        }
        for (index, stream) in dash.audio.iter().enumerate() {
            if !is_supported_dash_stream(stream, PlaybackTrackKind::Audio, preferences) {
                continue;
            }
            let track = dash_stream_to_track(stream, PlaybackTrackKind::Audio, index);
            tracks.insert(track.track_id.clone(), track);
        }
        if preferences.audio == AudioPreference::Flac {
            if let Some(flac) = &dash.flac {
                for (index, stream) in flac.audio.iter().enumerate() {
                    if !is_supported_dash_stream(stream, PlaybackTrackKind::Audio, preferences) {
                        continue;
                    }
                    let track = dash_stream_to_track(stream, PlaybackTrackKind::Audio, index + 100);
                    tracks.insert(track.track_id.clone(), track);
                }
            }
        }
        // 杜比不提供（设计 §3.5）：恒跳过 dolby 音轨
    }
}

fn maybe_insert_direct_track(
    data: &PlayUrlResponseData,
    tracks: &mut HashMap<String, PlaybackTrack>,
    direct_track_id: &mut Option<String>,
) {
    if let Some(durl) = data.durl.as_ref().and_then(|items| items.first()) {
        if is_valid_media_url(&durl.url) {
            tracks.retain(|_, track| track.kind != PlaybackTrackKind::Video);
            let track_id = "progressive-0".to_string();
            *direct_track_id = Some(track_id.clone());
            tracks.insert(
                track_id.clone(),
                PlaybackTrack {
                    track_id,
                    kind: PlaybackTrackKind::Video,
                    quality: data.quality,
                    label: quality_label(data.quality, &data.support_formats),
                    codecs: String::new(),
                    mime_type: "video/mp4".to_string(),
                    base_url: durl.url.clone(),
                    backup_urls: durl.backup_url.clone(),
                    bandwidth: durl.size,
                    width: None,
                    height: None,
                    size: Some(durl.size),
                    initialization_range: None,
                    index_range: None,
                },
            );
        }
    }
}

fn playback_duration_ms(data: &PlayUrlResponseData) -> Option<u64> {
    if data.timelength > 0 {
        return Some(data.timelength);
    }
    if let Some(duration_secs) = data
        .dash
        .as_ref()
        .map(|dash| dash.duration)
        .filter(|duration| *duration > 0)
    {
        return duration_secs.checked_mul(1000);
    }
    data.durl
        .as_ref()
        .and_then(|items| items.first())
        .map(|item| item.length)
        .filter(|duration| *duration > 0)
}

fn is_supported_dash_stream(
    stream: &DashStream,
    kind: PlaybackTrackKind,
    preferences: PlaybackPreferences,
) -> bool {
    if !is_valid_media_url(&stream.base_url) || stream.mime_type.trim().is_empty() {
        return false;
    }
    let codecs = stream.codecs.trim().to_ascii_lowercase();
    if codecs.is_empty() {
        return false;
    }
    match kind {
        PlaybackTrackKind::Video => match preferences.codec {
            CodecPreference::Avc => codecs.starts_with("avc1") || codecs.starts_with("avc3"),
            CodecPreference::Hevc => codecs.starts_with("hev1") || codecs.starts_with("hevc1"),
            CodecPreference::Av1 => codecs.starts_with("av01"),
        },
        PlaybackTrackKind::Audio => codecs.starts_with("mp4a") || codecs.starts_with("flac"),
    }
}

fn is_valid_media_url(raw_url: &str) -> bool {
    Url::parse(raw_url)
        .map(|url| matches!(url.scheme(), "http" | "https") && url.host_str().is_some())
        .unwrap_or(false)
}

fn append_adaptation_set(
    output: &mut String,
    session: &PlaybackSession,
    kind: PlaybackTrackKind,
    proxy_port: u16,
) {
    let content_type = match kind {
        PlaybackTrackKind::Video => "video",
        PlaybackTrackKind::Audio => "audio",
    };
    let mut tracks: Vec<_> = session
        .tracks
        .values()
        .filter(|track| track.kind == kind)
        .collect();
    if tracks.is_empty() {
        return;
    }
    tracks.sort_by(|a, b| a.track_id.cmp(&b.track_id));

    output.push_str(&format!(
        r#"    <AdaptationSet contentType="{content_type}" mimeType="{}" segmentAlignment="true">
"#,
        xml_escape(&tracks[0].mime_type)
    ));
    for track in tracks {
        output.push_str(&format!(
            r#"      <Representation id="{}" bandwidth="{}" codecs="{}""#,
            xml_escape(&track.track_id),
            track.bandwidth,
            xml_escape(&track.codecs)
        ));
        if let Some(width) = track.width {
            output.push_str(&format!(r#" width="{width}""#));
        }
        if let Some(height) = track.height {
            output.push_str(&format!(r#" height="{height}""#));
        }
        output.push_str(">\n");
        output.push_str(&format!(
            "        <BaseURL>http://127.0.0.1:{proxy_port}/bilibili/media/{}/{}</BaseURL>\n",
            xml_escape(&session.playback_id),
            xml_escape(&track.track_id)
        ));
        if let Some(index_range) = &track.index_range {
            output.push_str(&format!(
                "        <SegmentBase indexRange=\"{}\">\n",
                xml_escape(index_range)
            ));
            if let Some(initialization) = &track.initialization_range {
                output.push_str(&format!(
                    "          <Initialization range=\"{}\" />\n",
                    xml_escape(initialization)
                ));
            }
            output.push_str("        </SegmentBase>\n");
        }
        output.push_str("      </Representation>\n");
    }
    output.push_str("    </AdaptationSet>\n");
}

fn segment_base_field(stream: &DashStream, name: &str) -> Option<String> {
    stream
        .segment_base
        .as_ref()
        .and_then(|value| value.get(name))
        .and_then(serde_json::Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToString::to_string)
}

fn quality_label(
    quality: u64,
    formats: &[bpi_rs::video::videostream_url::SupportFormat],
) -> String {
    formats
        .iter()
        .find(|format| format.quality == quality)
        .map(|format| {
            if format.new_description.is_empty() {
                format.display_desc.clone()
            } else {
                format.new_description.clone()
            }
        })
        .filter(|label| !label.is_empty())
        .unwrap_or_else(|| quality.to_string())
}

fn new_playback_id() -> String {
    let mut rng = rand::thread_rng();
    format!("p{:016x}{:016x}", rng.next_u64(), rng.next_u64())
}

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_secs()
}

fn format_presentation_duration(duration_ms: u64) -> String {
    let seconds = duration_ms / 1000;
    let millis = duration_ms % 1000;
    if millis == 0 {
        format!("PT{seconds}S")
    } else {
        format!("PT{seconds}.{millis:03}S")
    }
}

fn xml_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

#[cfg(test)]
mod tests {
    use super::*;
    use bpi_rs::video::videostream_url::{DashInfo, DurlInfo, PlayUrlResponseData, SupportFormat};

    #[test]
    fn mpd_uses_local_track_urls_without_remote_urls() {
        let session = sample_session(100, 3600);

        let mpd = build_mpd(&session, 23456);

        assert!(mpd.contains("MPD"));
        assert!(mpd.contains("http://127.0.0.1:23456/bilibili/media/"));
        assert!(mpd.contains(r#"mediaPresentationDuration="PT3600000S""#));
        assert!(mpd.contains(r#"<Period duration="PT3600000S">"#));
        assert!(mpd.contains("AdaptationSet"));
        assert!(mpd.contains("contentType=\"video\""));
        assert!(mpd.contains("contentType=\"audio\""));
        assert!(mpd.contains("SegmentBase"));
        assert!(mpd.contains("Initialization"));
        assert!(mpd.contains("/bilibili/media/playback-1/video-64-0"));
        // data: URI 内嵌场景下 BaseURL 必须是绝对地址（相对路径无法相对 data: URI 解析）
        assert!(mpd.contains("http://127.0.0.1:23456/bilibili/media/playback-1/video-64-0"));
        assert!(!mpd.contains("https://"));
    }

    #[test]
    fn quality_options_match_video_tracks() {
        let session = sample_session(100, 3600);

        let options = quality_options(&session);

        assert_eq!(options.len(), 1);
        assert_eq!(options[0].id, "video-64-0");
        assert_eq!(options[0].quality, 64);
    }

    #[test]
    fn store_insert_get_cleanup_and_unknown_track() {
        let now = now_unix();
        let session = sample_session(now, now + 10);
        let playback_id = session.playback_id.clone();

        insert_session(session);

        assert!(get_session(&playback_id).is_some());
        assert!(get_track(&playback_id, "video-64-0").is_some());
        assert!(get_track(&playback_id, "missing").is_none());

        cleanup_expired_sessions(now + 11);
        assert!(get_session(&playback_id).is_none());
    }

    #[test]
    fn create_session_uses_dash_duration_when_timelength_is_missing() -> Result<(), BpiError> {
        let mut data = sample_play_url_data();
        data.timelength = 0;
        data.dash.as_mut().unwrap().duration = 93;

        let (session, _) = create_session_from_stream(&data, "BV1xx411c7mD", 42, 62131, 14201)?;

        assert_eq!(session.duration_ms, 93_000);
        assert!(build_mpd(&session, 14201).contains(r#"mediaPresentationDuration="PT93000S""#));
        Ok(())
    }

    #[test]
    fn create_session_rejects_playback_without_duration() {
        let mut data = sample_play_url_data();
        data.timelength = 0;
        data.dash.as_mut().unwrap().duration = 0;
        data.durl = None;

        let result = create_session_from_stream(&data, "BV1xx411c7mD", 42, 62131, 14201);

        assert!(result.is_err());
    }

    #[test]
    fn create_session_filters_unsupported_dash_codecs() -> Result<(), BpiError> {
        let mut data = sample_play_url_data();
        data.dash.as_mut().unwrap().video.insert(
            0,
            sample_dash_stream(
                127,
                PlaybackTrackKind::Video,
                "hev1.2.4.L153.B0",
                "https://example.invalid/hevc.m4s",
            ),
        );
        data.dash.as_mut().unwrap().audio.insert(
            0,
            sample_dash_stream(
                30250,
                PlaybackTrackKind::Audio,
                "ec-3",
                "https://example.invalid/dolby.m4s",
            ),
        );

        let (session, source) =
            create_session_from_stream(&data, "BV1xx411c7mD", 42, 62131, 14201)?;

        assert!(session.tracks.values().all(|track| {
            !track.codecs.starts_with("hev1") && !track.codecs.starts_with("ec-3")
        }));
        assert_eq!(source.qualities.len(), 1);
        assert_eq!(source.qualities[0].codecs, "avc1.640028");
        Ok(())
    }

    #[test]
    fn create_session_can_prefer_direct_progressive_track() -> Result<(), BpiError> {
        let data = sample_play_url_data();

        let (session, source) = create_session_from_stream_with_options(
            &data,
            "BV1xx411c7mD",
            42,
            62131,
            14201,
            true,
            PlaybackPreferences::default(),
        )?;

        assert_eq!(session.direct_track_id.as_deref(), Some("progressive-0"));
        assert!(source.direct_url.is_some());
        assert_eq!(source.qualities.len(), 1);
        assert!(session
            .tracks
            .values()
            .all(|track| track.track_id == "progressive-0"));
        Ok(())
    }

    #[test]
    fn create_session_prefer_direct_falls_back_to_dash_when_durl_is_missing() -> Result<(), BpiError>
    {
        let mut data = sample_play_url_data();
        data.durl = None;

        let (session, source) = create_session_from_stream_with_options(
            &data,
            "BV1xx411c7mD",
            42,
            62131,
            14201,
            true,
            PlaybackPreferences::default(),
        )?;

        assert_eq!(session.direct_track_id, None);
        assert_eq!(source.direct_url, None);
        assert!(session.tracks.contains_key("video-64-0"));
        assert!(session.tracks.contains_key("audio-30280-0"));
        Ok(())
    }

    #[test]
    fn create_session_prefers_hevc_track_when_requested() -> Result<(), BpiError> {
        let mut data = sample_play_url_data();
        data.dash.as_mut().unwrap().video.push(sample_dash_stream(
            80,
            PlaybackTrackKind::Video,
            "hev1.2.4.L153.B0",
            "https://example.invalid/hevc.m4s",
        ));
        let preferences = PlaybackPreferences {
            codec: CodecPreference::Hevc,
            audio: AudioPreference::Standard,
        };
        let (session, _) = create_session_from_stream_with_options(
            &data,
            "BV1xx411c7mD",
            42,
            62131,
            14201,
            false,
            preferences,
        )?;
        assert!(session.tracks.values().any(
            |track| track.kind == PlaybackTrackKind::Video && track.codecs.starts_with("hev1")
        ));
        assert!(!session.tracks.values().any(|track| {
            track.kind == PlaybackTrackKind::Video && track.codecs.starts_with("avc1")
        }));
        Ok(())
    }

    #[test]
    fn create_session_falls_back_to_avc_when_preferred_codec_missing() -> Result<(), BpiError> {
        let data = sample_play_url_data();
        let preferences = PlaybackPreferences {
            codec: CodecPreference::Av1,
            audio: AudioPreference::Standard,
        };
        let (session, _) = create_session_from_stream_with_options(
            &data,
            "BV1xx411c7mD",
            42,
            62131,
            14201,
            false,
            preferences,
        )?;
        assert!(session.tracks.values().any(
            |track| track.kind == PlaybackTrackKind::Video && track.codecs.starts_with("avc1")
        ));
        Ok(())
    }

    #[test]
    fn create_session_keeps_flac_track_only_when_preferred() -> Result<(), BpiError> {
        let mut data = sample_play_url_data();
        data.dash.as_mut().unwrap().flac = Some(DashFlac {
            audio: vec![sample_dash_stream(
                30251,
                PlaybackTrackKind::Audio,
                "fLaC",
                "https://example.invalid/flac.m4s",
            )],
        });
        let (standard, _) = create_session_from_stream_with_options(
            &data,
            "BV1xx411c7mD",
            42,
            62131,
            14201,
            false,
            PlaybackPreferences::default(),
        )?;
        assert!(!standard
            .tracks
            .values()
            .any(|track| track.codecs.starts_with("flac")));
        let preferences = PlaybackPreferences {
            codec: CodecPreference::Avc,
            audio: AudioPreference::Flac,
        };
        let (flac, _) = create_session_from_stream_with_options(
            &data,
            "BV1xx411c7mD",
            42,
            62131,
            14201,
            false,
            preferences,
        )?;
        assert!(flac
            .tracks
            .values()
            .any(|track| track.codecs.to_ascii_lowercase().starts_with("flac")));
        Ok(())
    }

    fn sample_session(created_at: u64, expires_at: u64) -> PlaybackSession {
        let mut tracks = HashMap::new();
        tracks.insert(
            "video-64-0".to_string(),
            PlaybackTrack {
                track_id: "video-64-0".to_string(),
                kind: PlaybackTrackKind::Video,
                quality: 64,
                label: "720P".to_string(),
                codecs: "avc1.640028".to_string(),
                mime_type: "video/mp4".to_string(),
                base_url: "https://example.invalid/video.m4s".to_string(),
                backup_urls: Vec::new(),
                bandwidth: 1_000_000,
                width: Some(1280),
                height: Some(720),
                size: None,
                initialization_range: Some("0-932".to_string()),
                index_range: Some("933-5908".to_string()),
            },
        );
        tracks.insert(
            "audio-30280-0".to_string(),
            PlaybackTrack {
                track_id: "audio-30280-0".to_string(),
                kind: PlaybackTrackKind::Audio,
                quality: 30280,
                label: "audio".to_string(),
                codecs: "mp4a.40.2".to_string(),
                mime_type: "audio/mp4".to_string(),
                base_url: "https://example.invalid/audio.m4s".to_string(),
                backup_urls: Vec::new(),
                bandwidth: 128_000,
                width: None,
                height: None,
                size: None,
                initialization_range: Some("0-907".to_string()),
                index_range: Some("908-5883".to_string()),
            },
        );

        PlaybackSession {
            playback_id: "playback-1".to_string(),
            bvid: "BV1xx411c7mD".to_string(),
            aid: 42,
            cid: 62131,
            duration_ms: 3_600_000,
            created_at,
            expires_at,
            tracks,
            direct_track_id: None,
        }
    }

    fn sample_play_url_data() -> PlayUrlResponseData {
        PlayUrlResponseData {
            from: "local".to_string(),
            result: "success".to_string(),
            message: String::new(),
            quality: 64,
            format: "dash".to_string(),
            timelength: 3_600_000,
            accept_format: "hdflv2,flv,flv720".to_string(),
            accept_description: vec!["高清 720P".to_string()],
            accept_quality: vec![64],
            video_codecid: 7,
            seek_param: "start".to_string(),
            seek_type: "offset".to_string(),
            durl: Some(vec![DurlInfo {
                order: 1,
                length: 3_600_000,
                size: 1024,
                ahead: String::new(),
                vhead: String::new(),
                url: "https://example.invalid/progressive.mp4".to_string(),
                backup_url: Vec::new(),
            }]),
            dash: Some(DashInfo {
                video: vec![sample_dash_stream(
                    64,
                    PlaybackTrackKind::Video,
                    "avc1.640028",
                    "https://example.invalid/video.m4s",
                )],
                audio: vec![sample_dash_stream(
                    30280,
                    PlaybackTrackKind::Audio,
                    "mp4a.40.2",
                    "https://example.invalid/audio.m4s",
                )],
                dolby: None,
                flac: None,
                duration: 3600,
            }),
            support_formats: vec![SupportFormat {
                quality: 64,
                format: "flv720".to_string(),
                new_description: "720P".to_string(),
                display_desc: "720P".to_string(),
                superscript: String::new(),
                codecs: Some(vec!["avc1.640028".to_string()]),
            }],
            high_format: None,
            last_play_time: 0,
            last_play_cid: 0,
        }
    }

    fn sample_dash_stream(
        id: u64,
        kind: PlaybackTrackKind,
        codecs: &str,
        base_url: &str,
    ) -> DashStream {
        DashStream {
            id,
            base_url: base_url.to_string(),
            backup_url: Vec::new(),
            bandwidth: 1_000_000,
            mime_type: match kind {
                PlaybackTrackKind::Video => "video/mp4",
                PlaybackTrackKind::Audio => "audio/mp4",
            }
            .to_string(),
            codecs: codecs.to_string(),
            width: (kind == PlaybackTrackKind::Video).then_some(1280),
            height: (kind == PlaybackTrackKind::Video).then_some(720),
            frame_rate: None,
            sar: None,
            start_with_sap: None,
            segment_base: Some(serde_json::json!({
                "initialization": "0-932",
                "index_range": "933-5908"
            })),
            md5: None,
            size: None,
            db_type: None,
            r#type: None,
            stream_name: None,
            orientation: None,
        }
    }
}
