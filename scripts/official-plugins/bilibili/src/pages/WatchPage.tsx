import React, { useEffect, useRef, useState } from "sdk";
import { CommentPanel } from "../components/CommentPanel";
import { defaultDanmakuSettings, type DanmakuSettings } from "../components/DanmakuOverlay";
import { PlayerShell } from "../components/PlayerShell";
import { WatchSidebarTabs } from "../components/WatchSidebarTabs";
import { useVideoInteraction } from "../hooks/useVideoInteraction";
import { openSpace } from "../navigation";
import { errorMessage, getState, loadConfig, refreshLoginStatus, subscribe } from "../runtime";
import type {
  BiliDanmakuItem,
  BiliLocalProgress,
  BiliPlaybackSource,
  BiliVideoDetail,
  BiliVideoPage,
} from "../types";

interface QueryState {
  bvid?: string;
  aid?: number;
  cid?: number;
}

interface WatchPageProps {
  target: QueryState;
}

type PlaybackMode = "quality" | "compat";

export function WatchPage({ target }: WatchPageProps) {
  const [query] = useState<QueryState>(() => ({ bvid: target.bvid, aid: target.aid, cid: target.cid }));
  const [detail, setDetail] = useState<BiliVideoDetail | null>(null);
  const [selectedPage, setSelectedPage] = useState<BiliVideoPage | null>(null);
  const [playback, setPlayback] = useState<BiliPlaybackSource | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingPlayback, setLoadingPlayback] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [playbackError, setPlaybackError] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("quality");
  const [localProgress, setLocalProgress] = useState<BiliLocalProgress | null>(null);
  const [syncProgress, setSyncProgress] = useState(true);
  const [danmakuItems, setDanmakuItems] = useState<BiliDanmakuItem[]>([]);
  const [danmakuLoading, setDanmakuLoading] = useState(false);
  const [danmakuError, setDanmakuError] = useState("");
  const [danmakuSettings, setDanmakuSettings] = useState<DanmakuSettings>(defaultDanmakuSettings);
  const [defaultPlaybackRate, setDefaultPlaybackRate] = useState(1);
  const [runtimeState, setRuntimeState] = useState(getState);
  const progressRef = useRef<Record<number, number>>({});
  const touchedProgressRef = useRef<Record<number, boolean>>({});
  const fallbackAttemptsRef = useRef<Record<number, number>>({});

  const interaction = useVideoInteraction({
    aid: detail?.aid,
    bvid: detail?.bvid,
    ownerMid: detail?.owner.mid,
    loggedIn: Boolean(runtimeState.loginInfo?.loggedIn),
  });

  useEffect(() => {
    const unsubscribe = subscribe(() => setRuntimeState(getState()));
    void refreshLoginStatus();
    return unsubscribe;
  }, []);

  useEffect(() => {
    let active = true;
    loadConfig()
      .then((config) => {
        if (active) {
          setSyncProgress(config.syncProgress);
          setDefaultPlaybackRate(config.defaultPlaybackRate);
          setDanmakuSettings({
            enabled: config.danmakuEnabled,
            fontSize: config.danmakuFontSize,
            opacity: config.danmakuOpacity,
            density: config.danmakuDensity,
            speed: config.danmakuSpeed,
          });
        }
      })
      .catch(() => {
        if (active) {
          setSyncProgress(true);
          setDanmakuSettings(defaultDanmakuSettings);
          setDefaultPlaybackRate(1);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const sdk = getState().sdk;
    if (!sdk) return;
    if (!query.bvid && !query.aid) {
      setDetailError("缺少 bvid 或 aid 参数");
      return;
    }

    let active = true;
    setLoadingDetail(true);
    setDetailError("");
    sdk.bilibili.video
      .detail({ bvid: query.bvid, aid: query.aid })
      .then(async (nextDetail) => {
        if (!active) return;
        let loadedProgress: BiliLocalProgress | null = null;
        try {
          loadedProgress = await sdk.bilibili.playback.loadLocalProgress({
            bvid: nextDetail.bvid,
            cid: query.cid,
          });
        } catch {
          loadedProgress = null;
        }
        if (!active) return;
        if (loadedProgress) {
          progressRef.current = {
            ...progressRef.current,
            [loadedProgress.cid]: loadedProgress.progressSeconds,
          };
        }
        setLocalProgress(loadedProgress);
        setDetail(nextDetail);
        setSelectedPage(selectInitialPage(nextDetail, query.cid, loadedProgress));
      })
      .catch((err) => {
        if (active) setDetailError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });

    return () => {
      active = false;
    };
  }, [query.aid, query.bvid, query.cid]);

  useEffect(() => {
    const sdk = getState().sdk;
    if (!sdk || !detail || !selectedPage) return;

    let active = true;
    setLoadingPlayback(true);
    setPlayback(null);
    setPlaybackError("");
    sdk.bilibili.playback
      .createPlayback({
        bvid: detail.bvid,
        aid: detail.aid,
        cid: selectedPage.cid,
        preferProgressive: playbackMode === "compat",
      })
      .then((source) => {
        if (active) setPlayback(source);
      })
      .catch((err) => {
        if (active) setPlaybackError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoadingPlayback(false);
      });

    return () => {
      active = false;
    };
  }, [detail?.aid, detail?.bvid, playbackMode, reloadNonce, selectedPage?.cid]);

  useEffect(() => {
    const sdk = getState().sdk;
    if (!sdk || !detail || !selectedPage) return;

    let active = true;
    setDanmakuLoading(true);
    setDanmakuError("");
    setDanmakuItems([]);
    sdk.bilibili.danmaku
      .list({
        aid: detail.aid,
        bvid: detail.bvid,
        cid: selectedPage.cid,
      })
      .then((items) => {
        if (active) setDanmakuItems(sortDanmaku(items));
      })
      .catch((err) => {
        if (active) setDanmakuError(errorMessage(err));
      })
      .finally(() => {
        if (active) setDanmakuLoading(false);
      });

    return () => {
      active = false;
    };
  }, [detail?.aid, detail?.bvid, selectedPage?.cid]);

  function rememberPlaybackTime(cid: number, seconds: number) {
    if (cid > 0 && Number.isFinite(seconds) && seconds >= 0) {
      progressRef.current = { ...progressRef.current, [cid]: seconds };
      touchedProgressRef.current = { ...touchedProgressRef.current, [cid]: true };
    }
  }

  function reloadPlayback() {
    if (selectedPage) {
      fallbackAttemptsRef.current = { ...fallbackAttemptsRef.current, [selectedPage.cid]: 0 };
    }
    setReloadNonce((value) => value + 1);
  }

  function fallbackPlayback(wasDirect: boolean) {
    if (!selectedPage) return;
    const attempts = fallbackAttemptsRef.current[selectedPage.cid] ?? 0;
    if (attempts >= 1) {
      setPlaybackError("播放源自动切换后仍失败，请重载或外部打开");
      return;
    }
    fallbackAttemptsRef.current = { ...fallbackAttemptsRef.current, [selectedPage.cid]: attempts + 1 };
    setPlaybackMode(wasDirect ? "quality" : "compat");
    setReloadNonce((value) => value + 1);
  }

  function selectPage(page: BiliVideoPage) {
    fallbackAttemptsRef.current = { ...fallbackAttemptsRef.current, [page.cid]: 0 };
    setPlaybackMode("quality");
    setSelectedPage(page);
  }

  function changePlaybackMode(mode: PlaybackMode) {
    if (mode === playbackMode) return;
    if (selectedPage) {
      fallbackAttemptsRef.current = { ...fallbackAttemptsRef.current, [selectedPage.cid]: 0 };
    }
    setPlaybackMode(mode);
  }

  return (
    <section className="bili-watch">
      {detailError ? <div className="bili-state bili-state-error">{detailError}</div> : null}
      {!detailError && loadingDetail ? <div className="bili-state">正在加载视频详情</div> : null}
      {!detailError && !loadingDetail && detail ? (
        <section className="bili-watch-grid">
          <PlayerShell
            detail={detail}
            sdk={getState().sdk}
            selectedPage={selectedPage}
            playback={playback}
            loadingPlayback={loadingPlayback}
            error={playbackError}
            startTime={startTimeForPage(
              detail,
              selectedPage,
              progressRef.current,
              touchedProgressRef.current,
              localProgress,
            )}
            defaultPlaybackRate={defaultPlaybackRate}
            syncProgress={syncProgress}
            danmakuItems={danmakuItems}
            danmakuLoading={danmakuLoading}
            danmakuError={danmakuError}
            danmakuSettings={danmakuSettings}
            loggedIn={Boolean(runtimeState.loginInfo?.loggedIn)}
            interactionState={interaction.state}
            interactionLoading={interaction.loading}
            interactionError={interaction.error}
            interactionBusy={interaction.busy}
            onLike={interaction.like}
            onCoin={interaction.coin}
            onFavorite={interaction.favorite}
            onShare={interaction.share}
            onToView={interaction.toggleToView}
            onReport={interaction.report}
            onPlaybackTime={rememberPlaybackTime}
            onReloadPlayback={reloadPlayback}
            onPlaybackFallback={fallbackPlayback}
            playbackMode={playbackMode}
            onPlaybackModeChange={changePlaybackMode}
            onDanmakuSettingsChange={setDanmakuSettings}
            onDanmakuSent={(item) => setDanmakuItems((items) => sortDanmaku([...items, item]))}
            commentsPanel={
              <CommentPanel detail={detail} loggedIn={Boolean(runtimeState.loginInfo?.loggedIn)} sdk={getState().sdk} />
            }
          />
          <WatchSidebarTabs
            aid={detail.aid}
            bvid={detail.bvid}
            followBusy={interaction.busy === "follow"}
            interactionState={interaction.state}
            loggedIn={Boolean(runtimeState.loginInfo?.loggedIn)}
            onFollowOwner={interaction.followOwner}
            onOpenSpace={() => {
              const ownerMid = interaction.state?.owner?.mid;
              if (ownerMid) openSpace(ownerMid);
            }}
            pages={detail.pages}
            selectedPageCid={selectedPage?.cid}
            onSelectPage={selectPage}
          />
        </section>
      ) : null}
    </section>
  );
}

function selectInitialPage(detail: BiliVideoDetail, requestedCid?: number, localProgress?: BiliLocalProgress | null) {
  const targetCid = requestedCid || detail.lastPlayCid || localProgress?.cid || detail.pages[0]?.cid;
  return detail.pages.find((page) => page.cid === targetCid) ?? detail.pages[0] ?? null;
}

function startTimeForPage(
  detail: BiliVideoDetail,
  selectedPage: BiliVideoPage | null,
  progressByCid: Record<number, number>,
  touchedByCid: Record<number, boolean>,
  localProgress: BiliLocalProgress | null,
) {
  if (!selectedPage) return 0;
  const pageProgress = progressByCid[selectedPage.cid];
  if (touchedByCid[selectedPage.cid]) return safeStartTime(pageProgress, selectedPage.duration);
  if (detail.lastPlayCid === selectedPage.cid && detail.lastPlayTime) {
    return safeStartTime(detail.lastPlayTime, selectedPage.duration);
  }
  const cachedProgress = safeStartTime(pageProgress, selectedPage.duration);
  if (cachedProgress > 0) return cachedProgress;
  if (localProgress?.cid === selectedPage.cid) return safeStartTime(localProgress.progressSeconds, selectedPage.duration);
  return 0;
}

function safeStartTime(value: number | undefined, duration: number) {
  if (!Number.isFinite(value) || !value || value <= 0) return 0;
  if (Number.isFinite(duration) && duration > 30 && value >= duration - 30) return 0;
  return value;
}

function sortDanmaku(items: BiliDanmakuItem[]) {
  return [...items].sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}
