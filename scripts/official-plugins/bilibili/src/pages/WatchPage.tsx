import React, { useEffect, useRef, useState } from "sdk";
import { CommentPanel } from "../components/CommentPanel";
import { defaultDanmakuSettings, type DanmakuSettings } from "../components/DanmakuOverlay";
import { NotePanel } from "../components/NotePanel";
import { PlayerShell } from "../components/PlayerShell";
import { WatchSidebarTabs } from "../components/WatchSidebarTabs";
import { DanmakuSegmentLoader } from "../danmaku/segmentLoader";
import { useVideoInteraction } from "../hooks/useVideoInteraction";
import { openSpace } from "../navigation";
import { errorMessage, getState, loadConfig, refreshLoginStatus, subscribe } from "../runtime";
import type {
  BiliDanmakuItem,
  BiliLocalProgress,
  BiliPlaybackSource,
  BiliSeasonDetail,
  BiliSeasonEpisode,
  BiliVideoDetail,
  BiliVideoPage,
} from "../types";

interface QueryState {
  bvid?: string;
  aid?: number;
  cid?: number;
  type?: "video" | "season";
  seasonId?: number;
  epId?: number;
}

interface WatchPageProps {
  target: QueryState;
}

type PlaybackMode = "quality" | "compat";

export function WatchPage({ target }: WatchPageProps) {
  const [query] = useState<QueryState>(() => ({
    bvid: target.bvid,
    aid: target.aid,
    cid: target.cid,
    type: target.type,
    seasonId: target.seasonId,
    epId: target.epId,
  }));
  const isSeason = query.type === "season" || query.seasonId != null;
  const [detail, setDetail] = useState<BiliVideoDetail | null>(null);
  const [seasonDetail, setSeasonDetail] = useState<BiliSeasonDetail | null>(null);
  const [selectedPage, setSelectedPage] = useState<BiliVideoPage | null>(null);
  const [selectedEp, setSelectedEp] = useState<BiliSeasonEpisode | null>(null);
  const [seasonFollowBusy, setSeasonFollowBusy] = useState(false);
  const [playback, setPlayback] = useState<BiliPlaybackSource | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingPlayback, setLoadingPlayback] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [playbackError, setPlaybackError] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("quality");
  const [codecPreference, setCodecPreference] = useState<"avc" | "hevc" | "av1">("avc");
  const [audioPreference, setAudioPreference] = useState<"standard" | "flac">("standard");
  const [autoPlay, setAutoPlay] = useState(true);
  const [bufferMode, setBufferMode] = useState<"auto" | "small" | "medium" | "large">("auto");
  const [localProgress, setLocalProgress] = useState<BiliLocalProgress | null>(null);
  const [syncProgress, setSyncProgress] = useState(true);
  const [danmakuItems, setDanmakuItems] = useState<BiliDanmakuItem[]>([]);
  const [danmakuLoading, setDanmakuLoading] = useState(false);
  const [danmakuError, setDanmakuError] = useState("");
  const [danmakuSettings, setDanmakuSettings] = useState<DanmakuSettings>(defaultDanmakuSettings);
  const danmakuLoaderRef = useRef<DanmakuSegmentLoader | null>(null);
  // 自己发送的弹幕：id → 发送时间戳秒（5 分钟窗口内描边 + 可操作）
  const selfDanmakuRef = useRef<Map<string, number>>(new Map());
  const [defaultPlaybackRate, setDefaultPlaybackRate] = useState(1);
  const [qualityMode, setQualityMode] = useState<"auto" | "manual">("auto");
  const [qualityQn, setQualityQn] = useState(0);
  const [runtimeState, setRuntimeState] = useState(getState);
  const progressRef = useRef<Record<number, number>>({});
  const touchedProgressRef = useRef<Record<number, boolean>>({});
  const fallbackAttemptsRef = useRef<Record<number, number>>({});

  // 番剧：把 season 详情适配为播放页通用的视频详情结构（owner/stats 为空，pages 为选集）
  const videoDetail: BiliVideoDetail | null = seasonDetail
    ? seasonToVideoDetail(seasonDetail, selectedEp)
    : detail;
  const activePage = isSeason ? (selectedEp ? episodeToPage(selectedEp) : null) : selectedPage;

  const interaction = useVideoInteraction({
    aid: videoDetail?.aid,
    bvid: videoDetail?.bvid,
    ownerMid: videoDetail?.owner.mid,
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
          setQualityMode(config.defaultQualityMode);
          setQualityQn(config.defaultQualityQn);
          setPlaybackMode(config.defaultFormat === "mp4" ? "compat" : "quality");
          setCodecPreference(config.codecPreference);
          setAudioPreference(config.audioPreference);
          setAutoPlay(config.autoPlay);
          setBufferMode(config.bufferMode);
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
          setPlaybackMode("quality");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const sdk = getState().sdk;
    if (!sdk) return;
    if (isSeason) {
      if (query.seasonId == null) {
        setDetailError("缺少 seasonId 参数");
        return;
      }
      let active = true;
      setLoadingDetail(true);
      setDetailError("");
      sdk.bilibili.season
        .detail({ seasonId: query.seasonId })
        .then(async (nextSeason) => {
          if (!active) return;
          const firstEp = nextSeason.episodes[0] ?? null;
          let loadedProgress: BiliLocalProgress | null = null;
          try {
            loadedProgress = await sdk.bilibili.playback.loadLocalProgress({
              bvid: firstEp?.bvid ?? "",
              cid: query.cid ?? firstEp?.cid,
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
          setSeasonDetail(nextSeason);
          setSelectedEp(
            nextSeason.episodes.find((episode) => episode.epId === query.epId) ??
              (query.cid ? nextSeason.episodes.find((episode) => episode.cid === query.cid) : null) ??
              firstEp,
          );
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
    }

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
  }, [isSeason, query.aid, query.bvid, query.cid, query.epId, query.seasonId]);

  useEffect(() => {
    const sdk = getState().sdk;
    if (!sdk || !videoDetail || !activePage) return;

    let active = true;
    setLoadingPlayback(true);
    setPlayback(null);
    setPlaybackError("");
    sdk.bilibili.playback
      .createPlayback({
        bvid: videoDetail.bvid,
        aid: videoDetail.aid,
        cid: activePage.cid,
        preferProgressive: playbackMode === "compat",
        quality: qualityMode === "manual" && qualityQn > 0 ? qualityQn : undefined,
        codecPreference,
        audioPreference,
        epId: selectedEp?.epId,
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
  }, [videoDetail?.aid, videoDetail?.bvid, playbackMode, codecPreference, audioPreference, reloadNonce, activePage?.cid, selectedEp?.epId]);

  useEffect(() => {
    const sdk = getState().sdk;
    if (!sdk || !videoDetail || !activePage) return;

    const loader = new DanmakuSegmentLoader({
      sdk,
      cid: activePage.cid,
      aid: videoDetail.aid,
      onSegment: (items) => {
        setDanmakuItems((current) => mergeDanmaku(current, items));
      },
      onFallback: (items) => {
        setDanmakuItems(mergeDanmaku([], items));
        if (items.length === 0) setDanmakuError("弹幕加载失败（已降级，暂无数据）");
      },
      onError: (message) => setDanmakuError(errorMessage(message)),
    });
    danmakuLoaderRef.current = loader;

    return () => {
      danmakuLoaderRef.current = null;
      loader.dispose();
    };
  }, [videoDetail?.aid, activePage?.cid]);

  function handleDanmakuSent(item: BiliDanmakuItem) {
    selfDanmakuRef.current.set(item.id, item.timestamp);
    setDanmakuItems((items) => mergeDanmaku(items, [item]));
  }

  function handleDanmakuRecalled(id: string) {
    selfDanmakuRef.current.delete(id);
    setDanmakuItems((items) => items.filter((item) => item.id !== id));
  }

  function rememberPlaybackTime(cid: number, seconds: number) {
    if (cid > 0 && Number.isFinite(seconds) && seconds >= 0) {
      progressRef.current = { ...progressRef.current, [cid]: seconds };
      touchedProgressRef.current = { ...touchedProgressRef.current, [cid]: true };
    }
  }

  function reloadPlayback() {
    if (activePage) {
      fallbackAttemptsRef.current = { ...fallbackAttemptsRef.current, [activePage.cid]: 0 };
    }
    setReloadNonce((value) => value + 1);
  }

  function fallbackPlayback(wasDirect: boolean) {
    if (!activePage) return;
    const attempts = fallbackAttemptsRef.current[activePage.cid] ?? 0;
    if (attempts >= 1) {
      setPlaybackError("播放源自动切换后仍失败，请重载或外部打开");
      return;
    }
    fallbackAttemptsRef.current = { ...fallbackAttemptsRef.current, [activePage.cid]: attempts + 1 };
    setPlaybackMode(wasDirect ? "quality" : "compat");
    setReloadNonce((value) => value + 1);
  }

  function selectPage(page: BiliVideoPage) {
    fallbackAttemptsRef.current = { ...fallbackAttemptsRef.current, [page.cid]: 0 };
    setPlaybackMode("quality");
    setSelectedPage(page);
  }

  function selectEpisode(episode: BiliSeasonEpisode) {
    fallbackAttemptsRef.current = { ...fallbackAttemptsRef.current, [episode.cid]: 0 };
    setPlaybackMode("quality");
    setSelectedEp(episode);
  }

  function toggleSeasonFollow() {
    if (!seasonDetail) return;
    setSeasonFollowBusy(true);
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.season
      .follow({ seasonId: seasonDetail.seasonId, follow: !seasonDetail.isFollowed })
      .then(() => {
        setSeasonDetail({ ...seasonDetail, isFollowed: !seasonDetail.isFollowed });
      })
      .catch((reason: Error) => {
        setDetailError(errorMessage(reason));
      })
      .finally(() => {
        setSeasonFollowBusy(false);
      });
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
      {!detailError && loadingDetail ? <div className="bili-state">正在加载详情</div> : null}
      {!detailError && !loadingDetail && videoDetail ? (
        <>
          {isSeason && seasonDetail ? (
            <div className="bili-season-followbar">
              <span className="bili-season-followbar-score">
                {seasonDetail.score != null ? `评分 ${seasonDetail.score.score.toFixed(1)}` : ""}
              </span>
              <span className="bili-season-followbar-new">{seasonDetail.newEp ? `最新：${seasonDetail.newEp}` : ""}</span>
              <button
                type="button"
                className="bili-season-follow-btn"
                onClick={toggleSeasonFollow}
                disabled={!runtimeState.loginInfo?.loggedIn || seasonFollowBusy}
              >
                {seasonDetail.isFollowed ? "已追番" : "追番"}
              </button>
            </div>
          ) : null}
          <section className="bili-watch-grid">
          <PlayerShell
            detail={videoDetail}
            sdk={getState().sdk}
            selectedPage={activePage}
            playback={playback}
            loadingPlayback={loadingPlayback}
            error={playbackError}
            startTime={startTimeForPage(
              videoDetail,
              activePage,
              progressRef.current,
              touchedProgressRef.current,
              localProgress,
            )}
            defaultPlaybackRate={defaultPlaybackRate}
            syncProgress={syncProgress}
            autoPlay={autoPlay}
            bufferMode={bufferMode}
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
            onTimeUpdate={(seconds: number) => danmakuLoaderRef.current?.updateTime(seconds)}
            onReloadPlayback={reloadPlayback}
            onPlaybackFallback={fallbackPlayback}
            playbackMode={playbackMode}
            onPlaybackModeChange={changePlaybackMode}
            qualityMode={qualityMode}
            qualityQn={qualityQn}
            onDanmakuSettingsChange={setDanmakuSettings}
            onDanmakuSent={handleDanmakuSent}
            selfDanmaku={selfDanmakuRef.current}
            onDanmakuRecalled={handleDanmakuRecalled}
            onOpenNotes={videoDetail.aid > 0 ? () => setNoteOpen(true) : undefined}
            commentsPanel={
              <CommentPanel detail={videoDetail} loggedIn={Boolean(runtimeState.loginInfo?.loggedIn)} sdk={getState().sdk} />
            }
          />
          {noteOpen && videoDetail.aid > 0 ? (
            <NotePanel aid={videoDetail.aid} onClose={() => setNoteOpen(false)} />
          ) : null}
          <WatchSidebarTabs
            aid={videoDetail.aid}
            bvid={videoDetail.bvid}
            followBusy={interaction.busy === "follow"}
            interactionState={interaction.state}
            loggedIn={Boolean(runtimeState.loginInfo?.loggedIn)}
            onFollowOwner={interaction.followOwner}
            onOpenSpace={() => {
              const ownerMid = interaction.state?.owner?.mid;
              if (ownerMid) openSpace(ownerMid);
            }}
            pages={seasonDetail ? seasonDetail.episodes.map(episodeToPage) : videoDetail.pages}
            pagesLabel={isSeason ? "选集" : undefined}
            selectedPageCid={activePage?.cid}
            onSelectPage={isSeason ? (page: BiliVideoPage) => {
              const episode = seasonDetail?.episodes.find((item) => item.cid === page.cid);
              if (episode) selectEpisode(episode);
            } : selectPage}
            hideOwner={isSeason}
          />
          </section>
        </>
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

/** 合并弹幕列表：按 id 去重后按时间排序（分段加载与全量降级可安全叠加）。 */
function mergeDanmaku(current: BiliDanmakuItem[], incoming: BiliDanmakuItem[]) {
  if (incoming.length === 0) return current;
  const byId = new Map<string, BiliDanmakuItem>();
  for (const item of current) byId.set(item.id, item);
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].sort(
    (left, right) => left.time - right.time || left.id.localeCompare(right.id),
  );
}

/** 番剧单集 → 播放页分 P 结构（选集列表复用分 P 列表 UI；duration 毫秒→秒） */
function episodeToPage(episode: BiliSeasonEpisode): BiliVideoPage {
  return {
    cid: episode.cid,
    page: 0,
    title: episode.longTitle || episode.title || `ep${episode.epId}`,
    duration: Math.round(episode.duration / 1000),
  };
}

/** 番剧详情 → 播放页通用视频详情结构（owner/stats 为空，互动条按 ep 的 aid 工作；duration 毫秒→秒） */
function seasonToVideoDetail(season: BiliSeasonDetail, episode: BiliSeasonEpisode | null): BiliVideoDetail {
  return {
    bvid: episode?.bvid ?? "",
    aid: episode?.aid ?? 0,
    cid: episode?.cid ?? 0,
    title: season.title,
    cover: season.cover,
    description: season.evaluate,
    owner: { mid: 0, name: "", face: "" },
    stats: { viewCount: 0, danmakuCount: 0, replyCount: 0, favoriteCount: 0, coinCount: 0, shareCount: 0, likeCount: 0 },
    pages: season.episodes.map(episodeToPage),
    duration: Math.round((episode?.duration ?? 0) / 1000),
    publishedAt: 0,
    lastPlayCid: 0,
    lastPlayTime: 0,
  };
}
