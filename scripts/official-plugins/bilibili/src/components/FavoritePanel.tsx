import React, { Button, Icon, useState } from "sdk";
import type { BiliFavoriteFolder } from "../types";
import { MenuPopover } from "./MenuPopover";

interface FavoritePanelProps {
  busy: boolean;
  folders: BiliFavoriteFolder[];
  onClose(): void;
  onSubmit(addMediaIds: string[], delMediaIds: string[]): void;
  style?: Record<string, string | number>;
  triggerRef?: { current: HTMLElement | null };
}

export function FavoritePanel({ busy, folders, onClose, onSubmit, style, triggerRef }: FavoritePanelProps) {
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
    <MenuPopover onClose={onClose} style={style} triggerRef={triggerRef}>
      <div className="bili-menu-heading">
        <strong>收藏到</strong>
        <button className="bili-menu-close" type="button" onClick={onClose}>
          关闭
        </button>
      </div>
      {!hasOwnedFolders ? (
        <span className="bili-menu-empty">暂无可写入的收藏夹</span>
      ) : (
        <div className="bili-folder-scroll">
          {ownedFolders.map((folder) => (
            <button
              className={`bili-menu-item ${selected[folder.id] ? "bili-menu-item-active" : ""}`}
              disabled={busy}
              key={folder.id}
              type="button"
              onClick={() => setSelected((value) => ({ ...value, [folder.id]: !value[folder.id] }))}
            >
              {selected[folder.id] ? <Icon name="check" size={14} /> : null}
              <span>{folder.title || "未命名收藏夹"}</span>
              <small>{selected[folder.id] ? "已选择" : `${folder.mediaCount} 个`}</small>
            </button>
          ))}
        </div>
      )}
      <div className="bili-menu-footer">
        <Button disabled={busy || !hasOwnedFolders} size="sm" type="button" onClick={submit}>
          {busy ? "提交中" : "保存收藏"}
        </Button>
      </div>
    </MenuPopover>
  );
}
