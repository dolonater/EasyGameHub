import React, { Button, useEffect, useState } from "sdk";
import { HomeFeed } from "../components/HomeFeed";
import { SearchBox } from "../components/SearchBox";
import { SearchEmptyPanel } from "../components/SearchEmptyPanel";
import { usePagedFeed } from "../hooks/usePagedFeed";
import { getState, saveConfig, subscribe, withSearchHistory } from "../runtime";
import type { PluginSdk } from "../types";

/**
 * 全局搜索视图（P9 布局改造）：顶栏搜索框提交后进入本页。
 * 关键词由导航参数带入；换词后重新拉第一页，滚动位置由 MainPage 按视图恢复。
 */
export function SearchPage({ keyword }: { keyword: string }) {
  const [query, setQuery] = useState(keyword);
  const [submitted, setSubmitted] = useState(keyword);
  const [config, setConfig] = useState(getState().config);

  useEffect(() => subscribe(() => setConfig(getState().config)), []);

  // 顶栏换词提交：导航参数变化时同步搜索（不重挂载，保持本页生命周期）
  useEffect(() => {
    if (keyword !== submitted) {
      setQuery(keyword);
      setSubmitted(keyword);
    }
  }, [keyword, submitted]);

  const searchHistory = config.searchHistory;

  const search = usePagedFeed(
    (page, refresh) => homeCall((sdk) => sdk.bilibili.home.searchVideos(submitted, page, refresh)),
    { key: submitted, enabled: submitted.length > 0 },
  );

  function submitSearch(rawKeywords: string) {
    const keywords = rawKeywords.trim();
    if (!keywords) return;
    // 同一关键词重提交：key 未变不会触发 effect，显式重载第一页
    if (keywords === submitted) {
      search.reset();
    }
    setSubmitted(keywords);
    saveConfig({ searchHistory: withSearchHistory(searchHistory, keywords) }).catch(() => {});
  }

  function handleSearch(event?: { preventDefault(): void }) {
    event?.preventDefault();
    submitSearch(query);
  }

  const searchGuide = submitted.length === 0;

  return (
    <section className="bili-search-page">
      <form className="bili-search" onSubmit={(event: { preventDefault(): void }) => handleSearch(event)}>
        <SearchBox value={query} onChange={setQuery} onSubmit={() => submitSearch(query)} placeholder="搜索视频" />
        <Button type="submit" disabled={search.loading} size="sm">
          搜索
        </Button>
      </form>

      <HomeFeed
        error={search.error}
        loading={search.loading}
        mode="recommend"
        videos={search.items}
        searchGuide={searchGuide}
        searchEmpty={
          <SearchEmptyPanel
            history={searchHistory}
            onPick={(pick: string) => {
              setQuery(pick);
              submitSearch(pick);
            }}
            onClearHistory={() => {
              saveConfig({ searchHistory: [] }).catch(() => {});
            }}
          />
        }
        onRecommend={() => undefined}
        onPopular={() => undefined}
        onBangumi={() => undefined}
        onCinema={() => undefined}
        onLive={() => undefined}
      />
    </section>
  );
}

function homeCall<T>(call: (sdk: PluginSdk) => Promise<T>): Promise<T> {
  const sdk = getState().sdk;
  if (!sdk) return Promise.reject(new Error("Bilibili 插件尚未初始化"));
  return call(sdk);
}
