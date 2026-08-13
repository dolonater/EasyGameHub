import React, { useEffect, useState } from "sdk";
import { HomeFeed } from "../components/HomeFeed";
import { SearchEmptyPanel } from "../components/SearchEmptyPanel";
import { usePagedFeed } from "../hooks/usePagedFeed";
import { openSearch } from "../navigation";
import { getState, saveConfig, subscribe } from "../runtime";
import type { PluginSdk } from "../types";

/**
 * 全局搜索视图（P9 布局改造）：顶栏搜索框提交后进入本页。
 * 关键词由导航参数（openSearch）带入；搜索历史/热搜点击同样走 openSearch，
 * 与顶栏同一路径，保证跳转一致；页内不再放重复搜索框。
 */
export function SearchPage({ keyword }: { keyword: string }) {
  const [submitted, setSubmitted] = useState(keyword);
  const [config, setConfig] = useState(getState().config);

  useEffect(() => subscribe(() => setConfig(getState().config)), []);

  // 导航关键词变化时同步搜索（顶栏换词/历史热搜跳转），不重挂载保持本页生命周期
  useEffect(() => {
    setSubmitted(keyword);
  }, [keyword]);

  const searchHistory = config.searchHistory;

  const search = usePagedFeed(
    (page, refresh) => homeCall((sdk) => sdk.bilibili.home.searchVideos(submitted, page, refresh)),
    { key: submitted, enabled: submitted.length > 0 },
  );

  const searchGuide = submitted.length === 0;

  return (
    <section className="bili-search-page">
      <HomeFeed
        error={search.error}
        loading={search.loading}
        videos={search.items}
        searchGuide={searchGuide}
        searchEmpty={
          <SearchEmptyPanel
            history={searchHistory}
            onPick={(pick: string) => openSearch(pick)}
            onClearHistory={() => {
              saveConfig({ searchHistory: [] }).catch(() => {});
            }}
          />
        }
      />
    </section>
  );
}

function homeCall<T>(call: (sdk: PluginSdk) => Promise<T>): Promise<T> {
  const sdk = getState().sdk;
  if (!sdk) return Promise.reject(new Error("Bilibili 插件尚未初始化"));
  return call(sdk);
}
