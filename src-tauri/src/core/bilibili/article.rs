//! Bilibili 专栏：详情 / 点赞 / 投币 / UP 专栏列表 / 专栏搜索（P8）。

use bpi_rs::article::{ArticleLikeParams, ArticleViewParams, SpaceArticleParams};
use bpi_rs::search::SearchArticleParams;
use bpi_rs::{BpiClient, BpiError};

use super::models::{
    BiliArticleAuthor, BiliArticleCard, BiliArticleListPage, BiliArticleSearchItem,
    BiliArticleSearchPage, BiliArticleStats, BiliArticleView,
};

/// 专栏详情（content 带类型标记：type=3 JSON 段落 / type=0 HTML）。
pub async fn article_view(
    client: &BpiClient,
    article_id: i64,
) -> Result<BiliArticleView, BpiError> {
    let data = client
        .article()
        .view(ArticleViewParams::new(article_id)?)
        .await?;
    let content = data.content.trim().to_string();
    let content_type = if content.starts_with('{') || content.starts_with('[') {
        "json"
    } else {
        "html"
    };
    // opus 化专栏：顶层 content 为空时正文在 opus.content（新版 JSON 段落）或 opus.h5_content（HTML）
    let (content, content_type) = if content.is_empty() {
        if let Some(opus) = &data.opus {
            if let Some(opus_content) = &opus.content {
                (
                    serde_json::to_string(opus_content).unwrap_or_default(),
                    "json".to_string(),
                )
            } else if let Some(h5) = opus
                .h5_content
                .as_deref()
                .filter(|value| !value.trim().is_empty())
            {
                (h5.to_string(), "html".to_string())
            } else {
                (content, content_type.to_string())
            }
        } else {
            (content, content_type.to_string())
        }
    } else {
        (content, content_type.to_string())
    };
    Ok(BiliArticleView {
        id: data.id,
        title: data.title,
        summary: data.summary,
        content_type: content_type.to_string(),
        content,
        pub_time: data.publish_time,
        words: data.words,
        author: BiliArticleAuthor {
            mid: data.author.mid,
            name: data.author.name,
            face: data.author.face,
        },
        stats: BiliArticleStats {
            view: data.stats.view,
            like: data.stats.like,
            coin: data.stats.coin,
            favorite: data.stats.favorite,
            reply: data.stats.reply,
        },
        is_liked: data.is_like,
        tags: data.tags.into_iter().map(|tag| tag.name).collect(),
    })
}

/// 专栏点赞（乐观更新由前端回滚）。
pub async fn article_like(client: &BpiClient, article_id: i64, like: bool) -> Result<(), BpiError> {
    client
        .article()
        .like(ArticleLikeParams::new(article_id, like)?)
        .await?;
    Ok(())
}

/// 专栏投币（1 币，需登录）。
pub async fn article_coin(client: &BpiClient, article_id: i64, upid: i64) -> Result<(), BpiError> {
    client
        .article()
        .coin(bpi_rs::article::ArticleCoinParams::new(
            article_id as u64,
            upid as u64,
            1,
        )?)
        .await?;
    Ok(())
}

/// UP 主页专栏列表（分页）。
pub async fn article_list(
    client: &BpiClient,
    mid: i64,
    page: u32,
) -> Result<BiliArticleListPage, BpiError> {
    let params = SpaceArticleParams::new(mid)?.page(page as i32);
    let data = client.article().space_article_list(params).await?;
    Ok(BiliArticleListPage {
        articles: data
            .article_list
            .into_iter()
            .map(|item| BiliArticleCard {
                id: item.id,
                title: item.title,
                summary: item.summary,
                banner_url: if item.banner_url.is_empty() {
                    item.image_urls.first().cloned().unwrap_or_default()
                } else {
                    item.banner_url
                },
                image_urls: item.image_urls,
                pub_time: item.publish_time,
                words: item.words,
                view_count: item.stats.view,
                like_count: item.stats.like,
            })
            .collect(),
        total: data.count,
    })
}

/// 专栏搜索（分页）。
pub async fn search_articles(
    client: &BpiClient,
    keyword: &str,
    page: u32,
) -> Result<BiliArticleSearchPage, BpiError> {
    let data = client
        .search()
        .article(SearchArticleParams::new(keyword)?.with_page(page)?)
        .await?;
    let items = data
        .result
        .unwrap_or_default()
        .into_iter()
        .map(|item| BiliArticleSearchItem {
            id: item.id,
            title: item.title,
            desc: item.desc,
            image_urls: item.image_urls,
            pub_time: item.pub_time,
            like: item.like,
            reply: item.reply,
            mid: item.mid,
            category_name: item.category_name,
        })
        .collect();
    Ok(BiliArticleSearchPage {
        items,
        has_more: data.page < data.num_pages,
    })
}
