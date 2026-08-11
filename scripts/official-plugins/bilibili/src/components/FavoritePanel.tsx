import React, { Button, useState } from "sdk";
import type { BiliFavoriteFolder } from "../types";

interface FavoritePanelProps {
  busy: boolean;
  folders: BiliFavoriteFolder[];
  onClose(): void;
  onSubmit(addMediaIds: string[], delMediaIds: string[]): void;
}

export function FavoritePanel({ busy, folders, onClose, onSubmit }: FavoritePanelProps) {
  const ownedFolders = folders.filter((folder) => folder.owned);
  const [selected, setSelected] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(ownedFolders.map((folder) => [folder.id, folder.favState > 0])),
  );

  const hasOwnedFolders = ownedFolders.length > 0;

  function submit() {
    const addMediaIds: string[] = [];
    const delMediaIds: string[] = [];
    for (const folder of ownedFolders) {
      const next = Boolean(selected[folder.id]);
      const previous = folder.favState > 0;
      if (next && !previous) addMediaIds.push(String(folder.id));
      if (!next && previous) delMediaIds.push(String(folder.id));
    }
    onSubmit(addMediaIds, delMediaIds);
  }

  return (
    <div className="bili-popover-panel bili-favorite-popover">
      <div className="bili-popover-heading">
        <strong>收藏到</strong>
        <button type="button" onClick={onClose}>
          关闭
        </button>
      </div>
      <div className="bili-favorite-picker">
        {!hasOwnedFolders ? (
          <span>暂无可写入的收藏夹</span>
        ) : (
          ownedFolders.map((folder) => (
            <button
              className={selected[folder.id] ? "bili-folder-item bili-folder-item-active" : "bili-folder-item"}
              disabled={busy}
              key={folder.id}
              type="button"
              onClick={() => setSelected((value) => ({ ...value, [folder.id]: !value[folder.id] }))}
            >
              <span>{folder.title || "未命名收藏夹"}</span>
              <small>{selected[folder.id] ? "已选择" : `${folder.mediaCount} 个`}</small>
            </button>
          ))
        )}
      </div>
      <Button disabled={busy || !hasOwnedFolders} size="sm" type="button" onClick={submit}>
        {busy ? "提交中" : "保存收藏"}
      </Button>
    </div>
  );
}
