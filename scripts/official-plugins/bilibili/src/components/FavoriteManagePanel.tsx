import React, { TextField, useEffect, useState } from "sdk";
import type { BiliFavoriteFolder, BiliFavoriteItem } from "../types";
import { errorMessage, getState } from "../runtime";
import { VideoCard } from "./VideoCard";

interface FavoriteManagePanelProps {
  folders: BiliFavoriteFolder[];
  selectedFolderId: number | null;
  items: BiliFavoriteItem[];
  onSelectFolder(id: number): void;
  /** 文件夹/资源写操作成功后由父组件刷新数据 */
  onChanged(): void;
}

type FolderDialog = { kind: "create" } | { kind: "rename"; folder: BiliFavoriteFolder } | null;
type ConfirmKind =
  | { kind: "deleteFolder"; folder: BiliFavoriteFolder }
  | { kind: "deleteItems"; ids: number[] }
  | null;
type MoveDialog = { ids: number[] } | null;

/** 收藏夹管理模式：文件夹新建/重命名/删除 + 资源多选批量删除/移动，危险操作二次确认 */
export function FavoriteManagePanel({ folders, selectedFolderId, items, onSelectFolder, onChanged }: FavoriteManagePanelProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [folderDialog, setFolderDialog] = useState<FolderDialog>(null);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [moveDialog, setMoveDialog] = useState<MoveDialog>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSelected(new Set());
  }, [selectedFolderId]);

  const selectedIds = items.filter((item) => selected.has(item.video.aid)).map((item) => item.video.aid);
  const currentFolder = folders.find((item) => item.id === selectedFolderId) ?? null;
  const moveTargets = folders.filter((folder) => folder.id !== selectedFolderId);

  function toggleSelect(aid: number) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(aid)) next.delete(aid);
      else next.add(aid);
      return next;
    });
  }

  async function submitFolderDialog(title: string) {
    if (!folderDialog) return;
    const trimmed = title.trim();
    if (!trimmed) return;
    const sdk = getState().sdk;
    if (!sdk) return;
    setBusy(true);
    setMessage("");
    try {
      if (folderDialog.kind === "create") {
        await sdk.bilibili.fav.createFolder({ title: trimmed });
      } else if (trimmed !== folderDialog.folder.title) {
        await sdk.bilibili.fav.editFolder({ mediaId: folderDialog.folder.id, title: trimmed });
      }
      setFolderDialog(null);
      onChanged();
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function runConfirm(confirmKind: ConfirmKind) {
    if (!confirmKind) return;
    const sdk = getState().sdk;
    if (!sdk) return;
    setBusy(true);
    setMessage("");
    try {
      if (confirmKind.kind === "deleteFolder") {
        await sdk.bilibili.fav.deleteFolders({ mediaIds: [confirmKind.folder.id] });
      } else if (confirmKind.kind === "deleteItems" && currentFolder) {
        await sdk.bilibili.fav.deleteResources({ mediaId: currentFolder.id, resources: confirmKind.ids });
      }
      setConfirm(null);
      setSelected(new Set());
      onChanged();
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function runMove(target: BiliFavoriteFolder) {
    if (!moveDialog || !currentFolder) return;
    const sdk = getState().sdk;
    if (!sdk) return;
    setBusy(true);
    setMessage("");
    try {
      await sdk.bilibili.fav.moveResources({
        srcMediaId: currentFolder.id,
        tarMediaId: target.id,
        resources: moveDialog.ids,
      });
      setMoveDialog(null);
      setSelected(new Set());
      onChanged();
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bili-fav-manage">
      <div className="bili-fav-manage-toolbar">
        <button type="button" className="bili-fav-manage-action" onClick={() => setFolderDialog({ kind: "create" })} disabled={busy}>
          新建收藏夹
        </button>
        {selectedIds.length > 0 ? <span className="bili-fav-manage-selected">{selectedIds.length} 个已选</span> : null}
      </div>

      <div className="bili-folder-list">
        {folders.map((folder) => (
          <div
            key={`${folder.owned ? "own" : "collected"}-${folder.id}`}
            className={
              folder.id === selectedFolderId ? "bili-folder-manage-row bili-folder-item-active" : "bili-folder-manage-row"
            }
          >
            <button type="button" className="bili-folder-item bili-folder-item-grow" onClick={() => onSelectFolder(folder.id)}>
              <span>{folder.title || "未命名收藏夹"}</span>
              <small>
                {folder.mediaCount} 个 · {folder.owned ? "创建" : "收藏"}
              </small>
            </button>
            {folder.owned ? (
              <button
                type="button"
                className="bili-fav-manage-link"
                onClick={() => setFolderDialog({ kind: "rename", folder })}
                disabled={busy}
              >
                重命名
              </button>
            ) : null}
            {folder.owned ? (
              <button
                type="button"
                className="bili-fav-manage-link bili-fav-manage-danger"
                onClick={() => setConfirm({ kind: "deleteFolder", folder })}
                disabled={busy}
              >
                删除
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="bili-folder-videos">
        {items.length === 0 ? (
          <div className="bili-library-empty">
            <strong>收藏夹内容</strong>
            <span>该收藏夹暂无视频</span>
          </div>
        ) : (
          <>
            <div className="bili-video-grid">
              {items.map((item) => {
                const checked = selected.has(item.video.aid);
                return (
                  <div
                    key={`${item.video.bvid}-${item.favoriteTime}`}
                    className={checked ? "bili-fav-manage-card bili-fav-manage-card-checked" : "bili-fav-manage-card"}
                    onClick={() => toggleSelect(item.video.aid)}
                  >
                    <label className="bili-fav-manage-check">
                      <input type="checkbox" checked={checked} onChange={() => toggleSelect(item.video.aid)} />
                    </label>
                    <VideoCard video={item.video} />
                  </div>
                );
              })}
            </div>
            {selectedIds.length > 0 ? (
              <div className="bili-fav-manage-bulk">
                <button
                  type="button"
                  className="bili-fav-manage-danger"
                  onClick={() => setConfirm({ kind: "deleteItems", ids: selectedIds })}
                  disabled={busy}
                >
                  删除所选
                </button>
                {moveTargets.length > 0 ? (
                  <button
                    type="button"
                    className="bili-fav-manage-link"
                    onClick={() => setMoveDialog({ ids: selectedIds })}
                    disabled={busy}
                  >
                    移动到…
                  </button>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      {message ? <div className="bili-state bili-state-error">{message}</div> : null}

      {folderDialog ? (
        <InputDialog
          title={folderDialog.kind === "create" ? "新建收藏夹" : "重命名收藏夹"}
          initial={folderDialog.kind === "rename" ? folderDialog.folder.title : ""}
          busy={busy}
          onCancel={() => setFolderDialog(null)}
          onConfirm={submitFolderDialog}
        />
      ) : null}

      {confirm ? (
        <ConfirmDialog
          title={confirm.kind === "deleteFolder" ? "删除收藏夹" : "删除所选视频"}
          copy={
            confirm.kind === "deleteFolder"
              ? `确定删除收藏夹「${confirm.folder.title || "未命名收藏夹"}」？其中视频不会被删除，此操作不可撤销。`
              : `确定从收藏夹删除选中的 ${confirm.ids.length} 个视频？此操作不可撤销。`
          }
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => runConfirm(confirm)}
        />
      ) : null}

      {moveDialog ? (
        <div className="bili-confirm-mask">
          <div className="bili-confirm-dialog">
            <div className="bili-confirm-title">移动到收藏夹</div>
            <div className="bili-confirm-copy">选择目标收藏夹（共 {moveDialog.ids.length} 个视频）</div>
            <div className="bili-move-targets">
              {moveTargets.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className="bili-move-target"
                  onClick={() => runMove(folder)}
                  disabled={busy}
                >
                  <span>{folder.title || "未命名收藏夹"}</span>
                  <small>
                    {folder.mediaCount} 个 · {folder.owned ? "创建" : "收藏"}
                  </small>
                </button>
              ))}
            </div>
            <div className="bili-confirm-actions">
              <button type="button" className="bili-confirm-btn" onClick={() => setMoveDialog(null)} disabled={busy}>
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InputDialog({
  title,
  initial,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  initial: string;
  busy: boolean;
  onCancel(): void;
  onConfirm(value: string): void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="bili-confirm-mask">
      <div className="bili-confirm-dialog">
        <div className="bili-confirm-title">{title}</div>
        <TextField value={value} onChange={(event: any) => setValue(event.currentTarget.value)} />
        <div className="bili-confirm-actions">
          <button type="button" className="bili-confirm-btn" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button
            type="button"
            className="bili-confirm-btn bili-confirm-btn-primary"
            onClick={() => onConfirm(value)}
            disabled={busy || value.trim().length === 0}
          >
            {busy ? "处理中…" : "确认"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  copy,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  copy: string;
  busy: boolean;
  onCancel(): void;
  onConfirm(): void;
}) {
  return (
    <div className="bili-confirm-mask">
      <div className="bili-confirm-dialog">
        <div className="bili-confirm-title">{title}</div>
        <div className="bili-confirm-copy">{copy}</div>
        <div className="bili-confirm-actions">
          <button type="button" className="bili-confirm-btn" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button type="button" className="bili-confirm-btn bili-confirm-btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? "处理中…" : "确认"}
          </button>
        </div>
      </div>
    </div>
  );
}
