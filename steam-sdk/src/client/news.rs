//! Steam News API (ISteamNews/GetNewsForApp).
//!
//! Public endpoint — no API key required. Returns the official announcements
//! and patch notes published on the Steam store/community for a game.

use crate::client::SteamHttpClient;
use crate::error::{Result, SteamError};
use serde::Deserialize;

const STEAM_API_BASE: &str = "https://api.steampowered.com";

/// A single news item for a game.
#[derive(Debug, Clone, Deserialize)]
pub struct NewsItem {
    pub title: String,
    pub url: String,
    pub author: Option<String>,
    /// Raw HTML contents (maxlength-trimmed on the server side).
    pub contents: String,
    /// Feed label, e.g. "Announcement", "Patch Notes", "News".
    #[serde(rename = "feedlabel")]
    pub feed_label: Option<String>,
    #[serde(rename = "feed_type")]
    pub feed_type: Option<u32>,
    /// Unix timestamp (seconds).
    pub date: u64,
}

#[derive(Debug, Clone, Deserialize)]
struct AppNewsResponse {
    #[serde(rename = "appnews")]
    appnews: AppNews,
}

#[derive(Debug, Clone, Deserialize)]
struct AppNews {
    #[serde(rename = "newsitems")]
    newsitems: Vec<NewsItem>,
}

/// Fetch the latest news items for a game (short `contents` previews).
///
/// From `ISteamNews/GetNewsForApp/v2`. The `maxlength` parameter trims the
/// HTML `contents` server-side; `count` limits how many items are returned.
pub fn get_news_for_app(
    client: &SteamHttpClient,
    app_id: u32,
    count: u32,
) -> Result<Vec<NewsItem>> {
    get_news_for_app_with_maxlength(client, app_id, count, 300)
}

/// `get_news_for_app` with an explicit `contents` length cap.
fn get_news_for_app_with_maxlength(
    client: &SteamHttpClient,
    app_id: u32,
    count: u32,
    maxlength: u32,
) -> Result<Vec<NewsItem>> {
    let url = format!(
        "{}/ISteamNews/GetNewsForApp/v2/?appid={}&count={}&maxlength={}&format=json",
        STEAM_API_BASE, app_id, count, maxlength,
    );
    let response = client.get(&url)?;
    if response.status() != 200 {
        return Err(SteamError::ApiError {
            code: response.status() as i32,
            message: format!("HTTP {}", response.status()),
        });
    }
    let body: AppNewsResponse = response.into_json()?;
    Ok(body.appnews.newsitems)
}

/// Fetch a single news item's full content by its URL (used by the in-app
/// article reader). Steam's API caps `contents` at a few thousand chars
/// regardless of the requested `maxlength`, so very long posts may still be
/// truncated — the frontend can offer an "open original" fallback.
pub fn get_news_article(
    client: &SteamHttpClient,
    app_id: u32,
    url: &str,
) -> Result<Option<NewsItem>> {
    let items = get_news_for_app_with_maxlength(client, app_id, 100, 100_000)?;
    Ok(items.into_iter().find(|item| item.url == url))
}

/// Strip HTML tags and decode the common HTML entities from `contents`.
///
/// Line/block-level tags (`<br>`, `</p>`, `</div>`, `</li>`) become spaces so
/// adjacent text does not join together.
pub fn strip_html(input: &str) -> String {
    let spaced = input
        .replace("<br>", " ")
        .replace("<br/>", " ")
        .replace("<br />", " ")
        .replace("</p>", " ")
        .replace("</div>", " ")
        .replace("</li>", " ");

    let mut out = String::with_capacity(spaced.len());
    let mut in_tag = false;
    for ch in spaced.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(ch),
            _ => {}
        }
    }
    out.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&#39;", "'")
        .replace("&quot;", "\"")
        .replace("&nbsp;", " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Strip HTML tags while keeping block/line breaks so paragraph structure
/// survives (used for the in-app article reader). Blank lines separate
/// paragraphs; each line is trimmed.
pub fn strip_html_paragraphs(input: &str) -> String {
    let with_breaks = input
        .replace("<br>", "\n")
        .replace("<br/>", "\n")
        .replace("<br />", "\n")
        .replace("</p>", "\n\n")
        .replace("</div>", "\n")
        .replace("</li>", "\n");

    let mut text = String::with_capacity(with_breaks.len());
    let mut in_tag = false;
    for ch in with_breaks.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => text.push(ch),
            _ => {}
        }
    }
    let decoded = text
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&#39;", "'")
        .replace("&quot;", "\"")
        .replace("&nbsp;", " ");

    let mut out = String::new();
    let mut prev_blank = false;
    for line in decoded.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            if !prev_blank {
                out.push('\n');
            }
            prev_blank = true;
        } else {
            if !out.is_empty() && !out.ends_with('\n') {
                out.push('\n');
            }
            out.push_str(trimmed);
            prev_blank = false;
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_news_deserialize() {
        let json = r#"{
            "appnews": {
                "appid": 730,
                "newsitems": [{
                    "gid": "123",
                    "title": "CS2 Update",
                    "url": "https://store.steampowered.com/news/app/730/123",
                    "is_external_url": true,
                    "author": "valve",
                    "contents": "<b>Patch notes</b> &amp; more",
                    "feedlabel": "Patch Notes",
                    "date": 1700000000,
                    "feedname": "steam_community_announcements",
                    "feed_type": 1,
                    "appid": 730
                }]
            }
        }"#;
        let body: AppNewsResponse = serde_json::from_str(json).unwrap();
        let items = body.appnews.newsitems;
        assert_eq!(items.len(), 1);
        let item = &items[0];
        assert_eq!(item.title, "CS2 Update");
        assert_eq!(item.feed_label.as_deref(), Some("Patch Notes"));
        assert_eq!(item.feed_type, Some(1));
        assert_eq!(item.date, 1700000000);
    }

    #[test]
    fn test_strip_html() {
        assert_eq!(
            strip_html("<b>Patch notes</b> &amp; more<br>line2"),
            "Patch notes & more line2"
        );
        assert_eq!(strip_html("plain text"), "plain text");
        assert_eq!(strip_html(""), "");
    }
}
