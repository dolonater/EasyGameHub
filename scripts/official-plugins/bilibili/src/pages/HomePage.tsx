import React, { Button, TextField, useState } from "sdk";
import { BiliAppShell } from "../components/BiliAppShell";
import { HomeFeed } from "../components/HomeFeed";
import { usePagedFeed } from "../hooks/usePagedFeed";
import { getState } from "../runtime";
import type { PluginSdk } from "../types";

type Mode = "recommend" | "popular" | "search";

/**
 * 推荐"换一批"随机会话种子。
 * B站 rcmd 对同一 fresh_idx 返回固定批次；加随机起点后，每次插件加载从不同批次开始，
 * 重启后首页内容不再固定不变。模块级常量在插件加载时生成一次。
 */
const RECOMMEND_SEED = Math.floor(Math.random() * 30) + 1;

export function HomePage() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("recommend");
  const [popularActive, setPopularActive] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");

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

  function handleSearch(event?: { preventDefault(): void }) {
    event?.preventDefault();
    const keywords = query.trim();
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

  function refreshCurrent() {
    if (mode === "search") search.reload();
    else if (mode === "popular") popular.reload();
    else recommend.reload();
  }

  const searchGuide = mode === "search" && searchKeyword.length === 0;

  return (
    <BiliAppShell
      current="home"
      actions={
        <a className="bili-link-button" href="https://www.bilibili.com" target="_blank" rel="noreferrer">
          打开 B 站
        </a>
      }
    >
      <section className="bili-home">
        <form className="bili-search" onSubmit={(event) => handleSearch(event)}>
          <TextField value={query} onChange={(event: any) => setQuery(event.currentTarget.value)} placeholder="搜索视频" />
          <Button type="submit" disabled={active.loading} size="sm">
            搜索
          </Button>
          <Button variant="outline" size="sm" type="button" onClick={refreshCurrent} disabled={active.loading}>
            刷新
          </Button>
        </form>

        <HomeFeed
          error={active.error}
          loading={active.loading}
          mode={mode}
          videos={active.items}
          searchGuide={searchGuide}
          onPopular={switchToPopular}
          onRecommend={switchToRecommend}
          onSearch={switchToSearch}
        />
      </section>
    </BiliAppShell>
  );
}

function homeCall<T>(call: (sdk: PluginSdk) => Promise<T>): Promise<T> {
  const sdk = getState().sdk;
  if (!sdk) return Promise.reject(new Error("Bilibili 插件尚未初始化"));
  return call(sdk);
}
