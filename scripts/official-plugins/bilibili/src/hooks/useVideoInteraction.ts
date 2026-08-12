import { useEffect, useState } from "sdk";
import { errorMessage, getState } from "../runtime";
import type { BiliVideoInteractionState, PluginSdk } from "../types";

interface UseVideoInteractionOptions {
  aid?: number;
  bvid?: string;
  ownerMid?: number;
  loggedIn: boolean;
}

interface UseVideoInteractionResult {
  state: BiliVideoInteractionState | null;
  loading: boolean;
  error: string;
  busy: string;
  like(): void;
  coin(multiply: 1 | 2, alsoLike: boolean): void;
  favorite(addMediaIds: string[], delMediaIds: string[]): void;
  toggleToView(): void;
  followOwner(): void;
  share(): Promise<void>;
  report(): void;
}

interface InteractionReady {
  sdk: PluginSdk;
  state: BiliVideoInteractionState;
}

/**
 * 播放页视频互动状态与操作封装。
 * - aid/bvid/ownerMid（切换视频）与 loggedIn（登录态）变化时重新加载互动状态
 * - 点赞/稍后再看/关注乐观更新 + 失败回滚；投币非乐观，成功后以服务端状态刷新
 * - busy 串行锁防止操作互相覆盖；写操作未登录提示登录
 */
export function useVideoInteraction({
  aid,
  bvid,
  ownerMid,
  loggedIn,
}: UseVideoInteractionOptions): UseVideoInteractionResult {
  const [state, setState] = useState<BiliVideoInteractionState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let active = true;
    const sdk = getState().sdk;
    if (!sdk || (!aid && !bvid)) return;
    setLoading(true);
    setError("");
    sdk.bilibili.interaction
      .state({ aid, bvid, ownerMid })
      .then((next) => {
        if (active) setState(next);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [aid, bvid, ownerMid, loggedIn]);

  function requireReady(): InteractionReady | null {
    const sdk = getState().sdk;
    if (!sdk || !state) {
      getState().sdk?.ui.notify("互动状态还在加载");
      return null;
    }
    if (!loggedIn) {
      sdk.ui.notify("请先登录 Bilibili");
      return null;
    }
    return { sdk, state };
  }

  function like() {
    const ready = requireReady();
    if (!ready || busy) return;
    const { sdk, state: previous } = ready;
    const liked = !previous.liked;
    setBusy("like");
    setState({
      ...previous,
      liked,
      stats: {
        ...previous.stats,
        likeCount: adjustCount(previous.stats.likeCount, liked ? 1 : -1),
      },
    });
    void sdk.bilibili.interaction
      .like({ aid, bvid, liked })
      .then(setState)
      .catch((err) => rollback(previous, err))
      .finally(() => setBusy(""));
  }

  function coin(multiply: 1 | 2, alsoLike: boolean) {
    const ready = requireReady();
    if (!ready || busy) return;
    const { sdk } = ready;
    setBusy("coin");
    void sdk.bilibili.interaction
      .coin({ aid, bvid, multiply, alsoLike })
      .then((next) => {
        setState(next);
        sdk.ui.notify("投币成功");
      })
      .catch((err) => sdk.ui.notify(errorMessage(err)))
      .finally(() => setBusy(""));
  }

  function favorite(addMediaIds: string[], delMediaIds: string[]) {
    const ready = requireReady();
    if (!ready || busy) return;
    const { sdk } = ready;
    if (addMediaIds.length === 0 && delMediaIds.length === 0) {
      sdk.ui.notify("收藏夹没有变化");
      return;
    }
    if (!aid) {
      sdk.ui.notify("视频参数缺失");
      return;
    }
    setBusy("favorite");
    void sdk.bilibili.interaction
      .favorite({ rid: aid, addMediaIds, delMediaIds })
      .then(setState)
      .catch((err) => sdk.ui.notify(errorMessage(err)))
      .finally(() => setBusy(""));
  }

  function toggleToView() {
    const ready = requireReady();
    if (!ready || busy) return;
    const { sdk, state: previous } = ready;
    if (!aid) {
      sdk.ui.notify("视频参数缺失");
      return;
    }
    const toView = !previous.toView;
    setBusy("toview");
    setState({ ...previous, toView });
    void sdk.bilibili.interaction
      .toView({ aid, bvid, toView })
      .then(setState)
      .catch((err) => rollback(previous, err))
      .finally(() => setBusy(""));
  }

  function followOwner() {
    const ready = requireReady();
    if (!ready || busy) return;
    const { sdk, state: previous } = ready;
    const following = !previous.owner.following;
    setBusy("follow");
    setState({ ...previous, owner: { ...previous.owner, following } });
    void sdk.bilibili.interaction
      .followOwner({ mid: previous.owner.mid, following, aid, bvid })
      .then(setState)
      .catch((err) => rollback(previous, err))
      .finally(() => setBusy(""));
  }

  async function share() {
    const sdk = getState().sdk;
    if (!sdk || !bvid) return;
    setBusy("share");
    const link = `https://www.bilibili.com/video/${bvid}/`;
    try {
      await copyText(link);
      await sdk.bilibili.interaction.copyShareLink({ bvid });
      sdk.ui.notify("已复制视频链接");
    } catch (err) {
      sdk.ui.notify(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  function report() {
    const sdk = getState().sdk;
    if (!sdk || !bvid) return;
    void sdk.bilibili.interaction.openReport({ bvid }).catch((err) => {
      sdk.ui.notify(errorMessage(err));
    });
  }

  async function refresh() {
    const sdk = getState().sdk;
    if (!sdk || (!aid && !bvid)) return;
    setLoading(true);
    setError("");
    try {
      const next = await sdk.bilibili.interaction.state({ aid, bvid, ownerMid });
      setState(next);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function rollback(previous: BiliVideoInteractionState, err: unknown) {
    setState(previous);
    getState().sdk?.ui.notify(errorMessage(err));
  }

  return { state, loading, error, busy, like, coin, favorite, toggleToView, followOwner, share, report };
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
