import React, { Button, useEffect, useState } from "sdk";
import { errorMessage, getState, subscribe } from "../runtime";
import type { BiliFavoriteFolder, BiliFavoriteItem } from "../types";
import { FavoriteManagePanel } from "../components/FavoriteManagePanel";
import { VideoCard } from "../components/VideoCard";

/** 收藏夹页（P9 阶段 2 拆页）：从"我的"页内嵌 tab 提取为独立视图。 */
export function FavoritesPage() {
  const [state, setState] = useState(getState);
  const [folders, setFolders] = useState<BiliFavoriteFolder[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<BiliFavoriteItem[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [manageMode, setManageMode] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const loggedIn = Boolean(state.loginInfo?.loggedIn);

  useEffect(() => subscribe(() => setState(getState())), []);

  useEffect(() => {
    if (!loggedIn) {
      setFolders([]);
      setFavoriteItems([]);
      setSelectedFolderId(null);
      setManageMode(false);
      setPage(1);
      setHasMore(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.library
      .favoriteFolders()
      .then(async (nextFolders) => {
        if (cancelled) return;
        setFolders(nextFolders);
        const nextSelected = nextFolders[0]?.id ?? null;
        setSelectedFolderId(nextSelected);
        if (nextSelected) {
          const first = await sdk.bilibili.library.favoriteItems(nextSelected, 1);
          if (cancelled) return;
          setFavoriteItems(first.items);
          setPage(1);
          setHasMore(first.hasMore);
        } else {
          setFavoriteItems([]);
          setHasMore(false);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  // 切收藏夹：重载第一页（计数重置）
  useEffect(() => {
    if (!loggedIn || !selectedFolderId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.library
      .favoriteItems(selectedFolderId, 1)
      .then((data) => {
        if (!cancelled) {
          setFavoriteItems(data.items);
          setPage(1);
          setHasMore(data.hasMore);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loggedIn, selectedFolderId]);

  // 加载更多：追加下一页
  function loadMore() {
    if (!selectedFolderId || loading || !hasMore) return;
    const targetPage = page + 1;
    setLoading(true);
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.library
      .favoriteItems(selectedFolderId, targetPage)
      .then((data) => {
        setFavoriteItems((previous) => [...previous, ...data.items]);
        setPage(targetPage);
        setHasMore(data.hasMore);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }

  async function reloadFolders() {
    const sdk = getState().sdk;
    if (!sdk) return;
    try {
      const nextFolders = await sdk.bilibili.library.favoriteFolders();
      setFolders(nextFolders);
    } catch {
      // 管理面板内的变更后刷新失败不打断浏览
    }
  }

  return (
    <section className="bili-page-library">
      {!loggedIn ? (
        <div className="bili-state">登录后可查看收藏夹</div>
      ) : error ? (
        <div className="bili-state bili-state-error">{error}</div>
      ) : loading && folders.length === 0 ? (
        <div className="bili-state">正在加载收藏夹</div>
      ) : folders.length === 0 ? (
        <div className="bili-state">暂无收藏夹</div>
      ) : (
        <div className="bili-favorite-browser">
          <div className="bili-folder-list">
            {!manageMode ? (
              <Button
                className="bili-fav-manage-entry"
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setManageMode(true)}
              >
                管理
              </Button>
            ) : (
              <Button
                className="bili-fav-manage-entry"
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setManageMode(false)}
              >
                完成
              </Button>
            )}
            {folders.map((folder) => (
              <Button
                className={folder.id === selectedFolderId ? "bili-folder-item bili-folder-item-active" : "bili-folder-item"}
                variant="ghost"
                size="sm"
                key={`${folder.owned ? "own" : "collected"}-${folder.id}`}
                type="button"
                onClick={() => setSelectedFolderId(folder.id)}
              >
                <span>{folder.title || "未命名收藏夹"}</span>
                <small>
                  {folder.mediaCount} 个 · {folder.owned ? "创建" : "收藏"}
                </small>
              </Button>
            ))}
          </div>
          <div className="bili-folder-videos">
            {manageMode ? (
              <FavoriteManagePanel
                folders={folders}
                selectedFolderId={selectedFolderId}
                items={favoriteItems}
                onSelectFolder={setSelectedFolderId}
                onChanged={() => {
                  void reloadFolders();
                }}
              />
            ) : favoriteItems.length === 0 ? (
              <div className="bili-state">该收藏夹暂无视频</div>
            ) : (
              <>
                <div className="bili-video-grid">
                  {favoriteItems.map((item) => (
                    <VideoCard key={`${item.video.bvid}-${item.favoriteTime}`} video={item.video} />
                  ))}
                </div>
                {hasMore ? (
                  <button type="button" className="bili-dynamic-load-more" onClick={loadMore} disabled={loading}>
                    {loading ? "正在加载" : "加载更多"}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
