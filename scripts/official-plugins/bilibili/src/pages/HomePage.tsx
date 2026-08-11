import React, { Button, TextField, useEffect, useState } from "sdk";
import { BiliAppShell } from "../components/BiliAppShell";
import { HomeFeed } from "../components/HomeFeed";
import { errorMessage, getState } from "../runtime";
import type { BiliVideoCard } from "../types";

type Mode = "recommend" | "popular" | "search";

export function HomePage() {
  const [videos, setVideos] = useState<BiliVideoCard[]>([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("recommend");
  const [recommendPage, setRecommendPage] = useState(1);
  const [popularPage, setPopularPage] = useState(1);
  const [searchPage, setSearchPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadRecommend(false);
  }, []);

  const loadRecommend = async (refresh = false) => {
    const sdk = getState().sdk;
    if (!sdk) return;
    const nextPage = refresh ? recommendPage + 1 : 1;
    setLoading(true);
    setError("");
    try {
      const next = await sdk.bilibili.home.recommendVideos(nextPage, refresh);
      setVideos(next);
      setRecommendPage(nextPage);
      setMode("recommend");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const loadPopular = async (refresh = false) => {
    const sdk = getState().sdk;
    if (!sdk) return;
    const nextPage = refresh ? popularPage + 1 : 1;
    setLoading(true);
    setError("");
    try {
      const next = await sdk.bilibili.home.popularVideos(nextPage, refresh);
      setVideos(next);
      setPopularPage(nextPage);
      setMode("popular");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const search = async (event?: { preventDefault(): void }, refresh = false) => {
    event?.preventDefault();
    const keywords = query.trim();
    if (!keywords) {
      await loadRecommend(refresh);
      return;
    }

    const sdk = getState().sdk;
    if (!sdk) return;
    const nextPage = refresh ? searchPage + 1 : 1;
    setLoading(true);
    setError("");
    try {
      const next = await sdk.bilibili.home.searchVideos(keywords, nextPage, refresh);
      setVideos(next);
      setSearchPage(nextPage);
      setMode("search");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

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
        <form className="bili-search" onSubmit={(event) => void search(event)}>
          <TextField value={query} onChange={(event: any) => setQuery(event.currentTarget.value)} placeholder="搜索视频" />
          <Button type="submit" disabled={loading} size="sm">
            搜索
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => void refreshCurrent()}
            disabled={loading}
          >
            刷新
          </Button>
        </form>

        <HomeFeed
          error={error}
          loading={loading}
          mode={mode}
          videos={videos}
          onPopular={() => void loadPopular(false)}
          onRecommend={() => void loadRecommend(false)}
        />
      </section>
    </BiliAppShell>
  );

  function refreshCurrent() {
    if (mode === "search") return search(undefined, true);
    if (mode === "popular") return loadPopular(true);
    return loadRecommend(true);
  }
}
