//! UP 主页专栏列表（`/x/space/article`）。

use serde::{Deserialize, Serialize};

use crate::BpiResult;

use super::models::{ArticleAuthor, ArticleStats};

/// 正数校验（与 article/params.rs 同款）。
fn validate_positive_i64(field: &'static str, value: i64) -> BpiResult<i64> {
    if value > 0 {
        Ok(value)
    } else {
        Err(crate::BpiError::invalid_parameter(
            field,
            "must be a positive integer",
        ))
    }
}

/// `/x/space/article` 的参数。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpaceArticleParams {
    mid: i64,
    pn: i32,
    ps: i32,
}

impl SpaceArticleParams {
    pub fn new(mid: i64) -> BpiResult<Self> {
        Ok(Self {
            mid: validate_positive_i64("mid", mid)?,
            pn: 1,
            ps: 30,
        })
    }

    pub fn page(mut self, pn: i32) -> Self {
        self.pn = pn.max(1);
        self
    }

    pub fn page_size(mut self, ps: i32) -> Self {
        self.ps = ps.clamp(1, 50);
        self
    }

    pub(crate) fn query_pairs(&self) -> Vec<(&'static str, String)> {
        vec![
            ("mid", self.mid.to_string()),
            ("pn", self.pn.to_string()),
            ("ps", self.ps.to_string()),
            ("order", "pubdate".to_string()),
            ("jsonp", "jsonp".to_string()),
        ]
    }
}

/// UP 主页专栏列表项。
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SpaceArticleItem {
    pub id: i64,
    pub title: String,
    pub summary: String,
    pub banner_url: String,
    pub image_urls: Vec<String>,
    pub words: i64,
    pub ctime: i64,
    pub publish_time: i64,
    pub author: ArticleAuthor,
    pub stats: ArticleStats,
    #[serde(default)]
    pub origin_image_urls: Vec<String>,
}

/// UP 主页专栏列表数据。
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SpaceArticleData {
    #[serde(default)]
    pub count: i64,
    /// 真实响应字段名为 `articles`（/x/space/article）
    #[serde(default, alias = "articles")]
    pub article_list: Vec<SpaceArticleItem>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn space_article_params_query_pairs() {
        let params = SpaceArticleParams::new(12345)
            .expect("valid mid")
            .page(2)
            .page_size(20);
        let pairs = params.query_pairs();
        assert_eq!(
            pairs,
            vec![
                ("mid", "12345".to_string()),
                ("pn", "2".to_string()),
                ("ps", "20".to_string()),
                ("order", "pubdate".to_string()),
                ("jsonp", "jsonp".to_string()),
            ]
        );
    }

    #[test]
    fn space_article_data_parses_list() {
        let json = r#"{
          "count": 2,
          "article_list": [
            {
              "id": 101,
              "title": "第一篇专栏",
              "summary": "摘要",
              "banner_url": "https://example.invalid/cover.jpg",
              "image_urls": [],
              "words": 500,
              "ctime": 1620000000,
              "publish_time": 1620000000,
              "author": { "mid": 1, "name": "UP", "face": "https://example.invalid/f.jpg", "level": 4, "fans": 100, "official_verify": { "type": 0, "desc": "" }, "nameplate": { "nid": 0, "name": "", "image": "", "image_small": "", "level": "", "condition": "" }, "pendant": { "pid": 0, "name": "", "image": "", "expire": 0 }, "vip": { "avatar_subscript": 0, "due_date": 0, "label": { "label_theme": "", "path": "", "text": "" }, "nickname_color": "", "status": 0, "theme_type": 0, "type": 0, "vip_pay_type": 0 } },
              "stats": { "coin": 1, "dislike": 0, "dynamic": 0, "favorite": 2, "like": 10, "reply": 1, "share": 0, "view": 100 }
            }
          ]
        }"#;
        let data: SpaceArticleData = serde_json::from_str(json).expect("parse");
        assert_eq!(data.count, 2);
        assert_eq!(data.article_list.len(), 1);
        assert_eq!(data.article_list[0].title, "第一篇专栏");
        assert_eq!(data.article_list[0].stats.view, 100);
        assert_eq!(data.article_list[0].author.name, "UP");
    }

    #[test]
    fn space_article_data_parses_real_response() {
        // 真实 /x/space/article：字段名 articles、author 无 fans/level
        let json = r#"{"count": 27, "articles": [{
            "id": 11609866,
            "title": "我在B站写高考作文 - 2021",
            "summary": "2021高考季",
            "banner_url": "",
            "image_urls": ["https://example.invalid/a.png"],
            "words": 2187,
            "ctime": 1623033976,
            "publish_time": 1623034058,
            "author": {
                "mid": 144900660, "name": "专栏小天使",
                "face": "https://example.invalid/f.jpg",
                "official_verify": {"type": 0, "desc": ""},
                "nameplate": {"nid": 0, "name": "", "image": "", "image_small": "", "level": "", "condition": ""},
                "pendant": {"pid": 0, "name": "", "image": "", "expire": 0},
                "vip": {"type": 0, "status": 0, "due_date": 0, "vip_pay_type": 0, "theme_type": 0, "label": null, "avatar_subscript": 0, "nickname_color": ""}
            },
            "stats": {"view": 241307, "favorite": 294, "like": 1672, "dislike": 0, "reply": 675, "share": 124, "coin": 38, "dynamic": 0}
        }]}"#;
        let data: SpaceArticleData = serde_json::from_str(json).expect("parse");
        assert_eq!(data.article_list.len(), 1);
        assert_eq!(data.article_list[0].title, "我在B站写高考作文 - 2021");
        assert_eq!(data.article_list[0].author.mid, 144900660);
    }

    #[test]
    fn space_article_data_tolerates_missing_fields() {
        let data: SpaceArticleData = serde_json::from_str(r#"{}"#).expect("parse");
        assert!(data.article_list.is_empty());
    }
}
