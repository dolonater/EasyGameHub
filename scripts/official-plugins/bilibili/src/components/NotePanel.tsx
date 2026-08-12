import React, { useEffect, useState } from "sdk";
import { BiliImage } from "./BiliImage";
import { JsonBody } from "./JsonBody";
import { errorMessage, getState } from "../runtime";
import type { BiliNoteDetail, BiliNoteItem } from "../types";

interface NotePanelProps {
  aid: number;
  onClose(): void;
}

/**
 * 视频笔记弹层（P8）：列表（公开 + 本用户私有）+ 阅读（图文渲染）。
 * 私有笔记仅登录且为本用户时出现在列表中。
 */
export function NotePanel({ aid, onClose }: NotePanelProps) {
  const [notes, setNotes] = useState<BiliNoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<BiliNoteDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.note
      .list({ aid })
      .then((data) => {
        if (active) setNotes(data.notes);
      })
      .catch((err: Error) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [aid]);

  function openNote(note: BiliNoteItem) {
    setDetailLoading(true);
    setDetailError("");
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.note
      .detail({
        cvid: note.cvid || undefined,
        noteId: note.noteId || undefined,
        aid,
      })
      .then((data) => setDetail(data))
      .catch((err: Error) => setDetailError(errorMessage(err)))
      .finally(() => setDetailLoading(false));
  }

  return (
    <div className="bili-note-backdrop" onClick={onClose}>
      <div className="bili-note-panel" onClick={(event: { stopPropagation(): void }) => event.stopPropagation()}>
        <div className="bili-note-head">
          {detail ? (
            <button type="button" className="bili-note-back" onClick={() => setDetail(null)}>
              ← 返回列表
            </button>
          ) : (
            <strong>视频笔记</strong>
          )}
          <button type="button" className="bili-note-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        {!detail ? (
          <div className="bili-note-list">
            {error ? <div className="bili-state bili-state-error">{error}</div> : null}
            {loading ? <div className="bili-state">正在加载笔记…</div> : null}
            {notes.map((note) => (
              <button key={note.cvid || `private-${note.noteId}`} type="button" className="bili-note-item" onClick={() => openNote(note)}>
                <span className="bili-note-item-title">
                  {note.title || "未命名笔记"}
                  {note.isPrivate ? <span className="bili-note-private-badge">私有</span> : null}
                </span>
                {note.summary ? <span className="bili-note-item-summary">{note.summary}</span> : null}
                <span className="bili-note-item-meta">
                  {note.authorFace ? <BiliImage className="bili-article-avatar" src={note.authorFace} alt={note.authorName} /> : null}
                  <span>{note.authorName}</span>
                  {note.likes > 0 ? <span>{note.likes} 赞</span> : null}
                </span>
              </button>
            ))}
            {!loading && notes.length === 0 && !error ? <div className="bili-state">暂无笔记</div> : null}
          </div>
        ) : (
          <div className="bili-note-body">
            {detailError ? <div className="bili-state bili-state-error">{detailError}</div> : null}
            {detailLoading ? <div className="bili-state">正在加载笔记内容…</div> : null}
            {detail ? (
              <>
                <h2>{detail.title || "未命名笔记"}</h2>
                <JsonBody content={detail.content} />
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
