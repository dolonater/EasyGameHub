import React, { Button, useEffect, useRef, useState } from "sdk";
import { BiliAppShell } from "../components/BiliAppShell";
import { CommentPanel } from "../components/CommentPanel";
import { defaultDanmakuSettings, type DanmakuSettings } from "../components/DanmakuOverlay";
import { PlayerShell } from "../components/PlayerShell";
import { errorMessage, getState, loadConfig, refreshLoginStatus, subscribe } from "../runtime";
import type {
  BiliDanmakuItem,
  BiliLocalProgress,
  BiliPlaybackSource,
  BiliVideoDetail,
  BiliVideoInteractionState,
  BiliVideoPage,
} from "../types";

interface QueryState {
  bvid?: string;
  aid?: number;
  cid?: number;
}

type PlaybackMode = "quality" | "compat";

export function WatchPage() {
  const [query] = useState<QueryState>(() => readQuery());
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
  const [interactionState, setInteractionState] = useState<BiliVideoInteractionState | null>(null);
  const [interactionLoading, setInteractionLoading] = useState(false);
  const [interactionError, setInteractionError] = useState("");
  const [interactionBusy, setInteractionBusy] = useState("");
  const progressRef = useRef<Record<number, number>>({});
  const touchedProgressRef = useRef<Record<number, boolean>>({});
  const fallbackAttemptsRef = useRef<Record<number, number>>({});

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

  useEffect(() => {
    const sdk = getState().sdk;
    if (!sdk || !detail) return;

    let active = true;
    setInteractionLoading(true);
    setInteractionError("");
    sdk.bilibili.interaction
      .state({ aid: detail.aid, bvid: detail.bvid, ownerMid: detail.owner.mid })
      .then((state) => {
        if (active) setInteractionState(state);
      })
      .catch((err) => {
        if (active) setInteractionError(errorMessage(err));
      })
      .finally(() => {
        if (active) setInteractionLoading(false);
      });

    return () => {
      active = false;
    };
  }, [detail?.aid, detail?.bvid, detail?.owner.mid, runtimeState.loginInfo?.loggedIn]);

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

  function requireInteractiveState() {
    const sdk = getState().sdk;
    if (!sdk || !detail || !interactionState) {
      getState().sdk?.ui.notify("互动状态还在加载");
      return null;
    }
    if (!runtimeState.loginInfo?.loggedIn) {
      sdk.ui.notify("请先登录 Bilibili");
      return null;
    }
    return { sdk, detail, state: interactionState };
  }

  function toggleLike() {
    const ready = requireInteractiveState();
    if (!ready || interactionBusy) return;
    const previous = ready.state;
    const liked = !previous.liked;
    setInteractionBusy("like");
    setInteractionState({
      ...previous,
      liked,
      stats: {
        ...previous.stats,
        likeCount: adjustCount(previous.stats.likeCount, liked ? 1 : -1),
      },
    });
    void ready.sdk.bilibili.interaction
      .like({ aid: ready.detail.aid, bvid: ready.detail.bvid, liked })
      .then(setInteractionState)
      .catch((err) => rollbackInteraction(previous, err))
      .finally(() => setInteractionBusy(""));
  }

  function coinVideo(multiply: 1 | 2, alsoLike: boolean) {
    const ready = requireInteractiveState();
    if (!ready || interactionBusy) return;
    setInteractionBusy("coin");
    void ready.sdk.bilibili.interaction
      .coin({ aid: ready.detail.aid, bvid: ready.detail.bvid, multiply, alsoLike })
      .then((state) => {
        setInteractionState(state);
        ready.sdk.ui.notify("投币成功");
      })
      .catch((err) => ready.sdk.ui.notify(errorMessage(err)))
      .finally(() => setInteractionBusy(""));
  }

  function favoriteVideo(addMediaIds: string[], delMediaIds: string[]) {
    const ready = requireInteractiveState();
    if (!ready || interactionBusy) return;
    if (addMediaIds.length === 0 && delMediaIds.length === 0) {
      ready.sdk.ui.notify("收藏夹没有变化");
      return;
    }
    setInteractionBusy("favorite");
    void ready.sdk.bilibili.interaction
      .favorite({ rid: ready.detail.aid, addMediaIds, delMediaIds })
      .then(setInteractionState)
      .catch((err) => ready.sdk.ui.notify(errorMessage(err)))
      .finally(() => setInteractionBusy(""));
  }

  function toggleToView() {
    const ready = requireInteractiveState();
    if (!ready || interactionBusy) return;
    const previous = ready.state;
    const toView = !previous.toView;
    setInteractionBusy("toview");
    setInteractionState({ ...previous, toView });
    void ready.sdk.bilibili.interaction
      .toView({ aid: ready.detail.aid, bvid: ready.detail.bvid, toView })
      .then(setInteractionState)
      .catch((err) => rollbackInteraction(previous, err))
      .finally(() => setInteractionBusy(""));
  }

  function toggleFollowOwner() {
    const ready = requireInteractiveState();
    if (!ready || interactionBusy) return;
    const previous = ready.state;
    const following = !previous.owner.following;
    setInteractionBusy("follow");
    setInteractionState({ ...previous, owner: { ...previous.owner, following } });
    void ready.sdk.bilibili.interaction
      .followOwner({ mid: previous.owner.mid, following, aid: ready.detail.aid, bvid: ready.detail.bvid })
      .then(setInteractionState)
      .catch((err) => rollbackInteraction(previous, err))
      .finally(() => setInteractionBusy(""));
  }

  function shareVideo() {
    const sdk = getState().sdk;
    if (!sdk || !detail) return;
    const link = `https://www.bilibili.com/video/${detail.bvid}/`;
    setInteractionBusy("share");
    void copyText(link)
      .then(() => sdk.bilibili.interaction.copyShareLink({ bvid: detail.bvid }))
      .then(() => sdk.ui.notify("已复制视频链接"))
      .catch((err) => sdk.ui.notify(errorMessage(err)))
      .finally(() => setInteractionBusy(""));
  }

  function openReport() {
    const sdk = getState().sdk;
    if (!sdk || !detail) return;
    void sdk.bilibili.interaction.openReport({ bvid: detail.bvid }).catch((err) => {
      sdk.ui.notify(errorMessage(err));
    });
  }

  function rollbackInteraction(previous: BiliVideoInteractionState, err: unknown) {
    setInteractionState(previous);
    getState().sdk?.ui.notify(errorMessage(err));
  }

  return (
    <BiliAppShell
      current="watch"
      subtitle={query.bvid || (query.aid ? `av${query.aid}` : "播放")}
      title="播放"
      actions={
        <Button variant="outline" size="sm" type="button" onClick={() => history.back()}>
          返回
        </Button>
      }
    >
      <section className="bili-watch">
        {detailError ? <div className="bili-state bili-state-error">{detailError}</div> : null}
        {!detailError && loadingDetail ? <div className="bili-state">正在加载视频详情</div> : null}
        {!detailError && !loadingDetail && detail ? (
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
            interactionState={interactionState}
            interactionLoading={interactionLoading}
            interactionError={interactionError}
            interactionBusy={interactionBusy}
            onLike={toggleLike}
            onCoin={coinVideo}
            onFavorite={favoriteVideo}
            onShare={shareVideo}
            onToView={toggleToView}
            onFollowOwner={toggleFollowOwner}
            onReport={openReport}
            onSelectPage={selectPage}
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
        ) : null}
      </section>
    </BiliAppShell>
  );
}

function readQuery(): QueryState {
  const params = new URLSearchParams(window.location.search);
  const bvid = params.get("bvid")?.trim() || undefined;
  const aid = parsePositiveNumber(params.get("aid"));
  const cid = parsePositiveNumber(params.get("cid"));
  return { bvid, aid, cid };
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

function adjustCount(value: number, delta: number) {
  return Math.max(0, Math.floor(value + delta));
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function parsePositiveNumber(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
