import React, { Button, useEffect, useState } from "sdk";
import { errorMessage, getState, subscribe } from "../runtime";
import type { BiliFavoriteFolder, BiliFavoriteItem, BiliHistoryItem, BiliToViewItem } from "../types";
import { FavoriteManagePanel } from "./FavoriteManagePanel";
import { VideoCard } from "./VideoCard";

const tabs = [
  { id: "history", label: "历史记录" },
  { id: "watchLater", label: "稍后再看" },
  { id: "favorites", label: "收藏夹" },
];

type LibraryTab = "history" | "watchLater" | "favorites";

export function AccountLibraryTabs() {
  const [state, setState] = useState(getState);
  const [active, setActive] = useState<LibraryTab>("history");
  const [historyItems, setHistoryItems] = useState<BiliHistoryItem[]>([]);
  const [toViewItems, setToViewItems] = useState<BiliToViewItem[]>([]);
  const [folders, setFolders] = useState<BiliFavoriteFolder[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<BiliFavoriteItem[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [manageMode, setManageMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => subscribe(() => setState(getState())), []);

  const loggedIn = Boolean(state.loginInfo?.loggedIn);
  const activeLabel = tabs.find((tab) => tab.id === active)?.label ?? "账号内容";

  useEffect(() => {
    if (!loggedIn) {
      setHistoryItems([]);
      setToViewItems([]);
      setFolders([]);
      setFavoriteItems([]);
      setSelectedFolderId(null);
      setManageMode(false);
      return;
    }
    void loadActive();
  }, [active, loggedIn]);

  useEffect(() => {
    if (!loggedIn || active !== "favorites" || !selectedFolderId) return;
    void loadFavoriteItems(selectedFolderId);
  }, [active, loggedIn, selectedFolderId]);

  return (
    <section className="bili-library">
      <div className="bili-tabs" role="tablist">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            className={tab.id === active ? "bili-tab bili-tab-active" : "bili-tab"}
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>
      {!loggedIn ? (
        <LibraryEmpty title={activeLabel} copy="登录后可查看账号内容" />
      ) : error ? (
        <LibraryEmpty error title={activeLabel} copy={error} />
      ) : loading ? (
        <LibraryEmpty title={activeLabel} copy="正在加载账号内容" />
      ) : (
        renderContent()
      )}
    </section>
  );

  function renderContent() {
    if (active === "history") {
      if (historyItems.length === 0) return <LibraryEmpty title="历史记录" copy="暂无历史记录" />;
      return (
        <div className="bili-library-list">
          {historyItems.map((item) => (
            <VideoCard key={`${item.video.bvid}-${item.viewedAt}`} video={item.video} />
          ))}
        </div>
      );
    }

    if (active === "watchLater") {
      if (toViewItems.length === 0) return <LibraryEmpty title="稍后再看" copy="稍后再看列表为空" />;
      return (
        <div className="bili-library-list">
          {toViewItems.map((item) => (
            <VideoCard key={`${item.video.bvid}-${item.addedAt}`} video={item.video} />
          ))}
        </div>
      );
    }

    if (folders.length === 0) return <LibraryEmpty title="收藏夹" copy="暂无收藏夹" />;
    return (
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
                void loadActive();
              }}
            />
          ) : favoriteItems.length === 0 ? (
            <LibraryEmpty title="收藏夹内容" copy="该收藏夹暂无视频" />
          ) : (
            favoriteItems.map((item) => (
              <VideoCard key={`${item.video.bvid}-${item.favoriteTime}`} video={item.video} />
            ))
          )}
        </div>
      </div>
    );
  }

  async function loadActive() {
    const sdk = getState().sdk;
    if (!sdk) return;
    setLoading(true);
    setError("");
    try {
      if (active === "history") {
        setHistoryItems(await sdk.bilibili.library.historyList(1));
      } else if (active === "watchLater") {
        setToViewItems(await sdk.bilibili.library.toViewList());
      } else {
        const nextFolders = await sdk.bilibili.library.favoriteFolders();
        setFolders(nextFolders);
        const nextSelected = selectedFolderId ?? nextFolders[0]?.id ?? null;
        setSelectedFolderId(nextSelected);
        if (nextSelected) await loadFavoriteItems(nextSelected);
        else setFavoriteItems([]);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadFavoriteItems(folderId: number) {
    const sdk = getState().sdk;
    if (!sdk) return;
    setLoading(true);
    setError("");
    try {
      setFavoriteItems(await sdk.bilibili.library.favoriteItems(folderId, 1));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }
}

function LibraryEmpty({ title, copy, error = false }: { title: string; copy: string; error?: boolean }) {
  return (
    <div className={error ? "bili-library-empty bili-state-error" : "bili-library-empty"}>
      <strong>{title}</strong>
      <span>{copy}</span>
    </div>
  );
}
