import React, { Button, useEffect, useState } from "sdk";
import { HomeFeed } from "../components/HomeFeed";
import type { HomeMode } from "../components/HomeFeedTabs";
import { HotSubTabs, type HotSubMode } from "../components/HotSubTabs";
import { PgcSectionFeed } from "../components/PgcSectionFeed";
import { PreciousPanel } from "../components/PreciousPanel";
import { RankingPanel } from "../components/RankingPanel";
import { SearchBox } from "../components/SearchBox";
import { SearchEmptyPanel } from "../components/SearchEmptyPanel";
import { WeeklyPanel } from "../components/WeeklyPanel";
import { usePagedFeed } from "../hooks/usePagedFeed";
import { getState, saveConfig, subscribe, withSearchHistory } from "../runtime";
import type { PluginSdk } from "../types";

/**
 * 推荐"换一批"随机会话种子。
 * B站 rcmd 对同一 fresh_idx 返回固定批次；加随机起点后，每次插件加载从不同批次开始，
 * 重启后首页内容不再固定不变。模块级常量在插件加载时生成一次。
 */
const RECOMMEND_SEED = Math.floor(Math.random() * 30) + 1;

export function HomePage() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<HomeMode>("recommend");
  const [popularSub, setPopularSub] = useState<HotSubMode>("all");
  const [popularActive, setPopularActive] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [config, setConfig] = useState(getState().config);

  // 订阅 runtime config（搜索历史变化时刷新）
  useEffect(() => subscribe(() => setConfig(getState().config)), []);

  const searchHistory = config.searchHistory;

  // 推荐：mount 即加载第一页；fresh_idx = 种子 + 页（种子随机 → 重启后起点不同）
  const recommend = usePagedFeed(
    (page, refresh) => homeCall((sdk) => sdk.bilibili.home.recommendVideos(RECOMMEND_SEED + page, refresh)),
    { key: "recommend" },
  );
  // 热门：懒加载，首次切到热门 Tab 才请求（对齐现有行为）
  const popular = usePagedFeed(
    (page, refresh) => homeCall((sdk) => sdk.bilibili.home.popularVideos(page, refresh)),
    { key: "popular", enabled: popularActive },
  );
  // 搜索：key 用已提交关键词（非实时输入框），避免敲键即搜索
  const search = usePagedFeed(
    (page, refresh) => homeCall((sdk) => sdk.bilibili.home.searchVideos(searchKeyword, page, refresh)),
    { key: searchKeyword, enabled: searchKeyword.length > 0 },
  );

  const active = mode === "popular" ? popular : mode === "search" ? search : recommend;

  function submitSearch(rawKeywords: string) {
    const keywords = rawKeywords.trim();
    if (!keywords) {
      setMode("recommend");
      return;
    }
    // 同一关键词重提交：key 未变不会触发 effect，显式重载第一页
    if (keywords === searchKeyword) {
      search.reset();
    }
    setSearchKeyword(keywords);
    setMode("search");
    saveConfig({ searchHistory: withSearchHistory(searchHistory, keywords) }).catch(() => {});
  }

  function handleSearch(event?: { preventDefault(): void }) {
    event?.preventDefault();
    submitSearch(query);
  }

  function clearSearchHistory() {
    saveConfig({ searchHistory: [] }).catch(() => {});
  }

  function switchToRecommend() {
    setMode("recommend");
  }

  function switchToPopular() {
    setPopularActive(true);
    setMode("popular");
  }

  function switchToSearch() {
    setMode("search");
  }

  // 追番/影视/直播占位：P2/P6 填充真实内容
  function switchToBangumi() {
    setMode("bangumi");
  }

  function switchToCinema() {
    setMode("cinema");
  }

  function switchToLive() {
    setMode("live");
  }

  function refreshCurrent() {
    if (mode === "search") search.reload();
    else if (mode === "popular" && popularSub === "all") popular.reload();
    else if (mode === "recommend") recommend.reload();
  }

  const searchGuide = mode === "search" && searchKeyword.length === 0;
  const comingSoon = mode === "live";

  const mainFeed =
    mode === "popular" ? (
      <>
        <HotSubTabs sub={popularSub} onSub={setPopularSub} />
        {popularSub === "all" ? (
          <HomeFeed
            error={active.error}
            loading={active.loading}
            mode={mode}
            videos={active.items}
            searchGuide={searchGuide}
            onPopular={switchToPopular}
            onRecommend={switchToRecommend}
            onSearch={switchToSearch}
            onBangumi={switchToBangumi}
            onCinema={switchToCinema}
            onLive={switchToLive}
          />
        ) : popularSub === "ranking" ? (
          <RankingPanel />
        ) : popularSub === "weekly" ? (
          <WeeklyPanel />
        ) : (
          <PreciousPanel />
        )}
      </>
    ) : mode === "bangumi" || mode === "cinema" ? (
      <PgcSectionFeed kind={mode === "bangumi" ? "bangumi" : "cinema"} />
    ) : (
      <HomeFeed
        error={active.error}
        loading={active.loading}
        mode={mode}
        videos={active.items}
        searchGuide={searchGuide}
        searchEmpty={
          <SearchEmptyPanel
            history={searchHistory}
            onPick={(keyword) => {
              setQuery(keyword);
              submitSearch(keyword);
            }}
            onClearHistory={clearSearchHistory}
          />
        }
        comingSoon={comingSoon}
        onPopular={switchToPopular}
        onRecommend={switchToRecommend}
        onSearch={switchToSearch}
        onBangumi={switchToBangumi}
        onCinema={switchToCinema}
        onLive={switchToLive}
      />
    );

  return (
    <section className="bili-home">
      <form className="bili-search" onSubmit={(event) => handleSearch(event)}>
        <SearchBox
          value={query}
          onChange={setQuery}
          onSubmit={() => submitSearch(query)}
          placeholder="搜索视频"
        />
        <Button type="submit" disabled={active.loading} size="sm">
          搜索
        </Button>
        <Button variant="outline" size="sm" type="button" onClick={refreshCurrent} disabled={active.loading}>
          刷新
        </Button>
      </form>

      {mainFeed}
    </section>
  );
}

function homeCall<T>(call: (sdk: PluginSdk) => Promise<T>): Promise<T> {
  const sdk = getState().sdk;
  if (!sdk) return Promise.reject(new Error("Bilibili 插件尚未初始化"));
  return call(sdk);
}
