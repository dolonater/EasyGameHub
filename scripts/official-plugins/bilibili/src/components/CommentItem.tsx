import React from "sdk";
import type { BiliComment, BiliReportReason } from "../types";
import { BiliImage } from "./BiliImage";

export interface ReportDraft {
  reason: BiliReportReason;
  content: string;
}

export const reportReasons: Array<{ value: BiliReportReason; label: string }> = [
  { value: "ad", label: "广告" },
  { value: "spam", label: "刷屏" },
  { value: "flame", label: "引战" },
  { value: "abuse", label: "辱骂" },
  { value: "porn", label: "色情低俗" },
  { value: "spoiler", label: "剧透" },
  { value: "politics", label: "涉政" },
  { value: "illegal", label: "违法" },
  { value: "privacy", label: "侵犯隐私" },
  { value: "other", label: "其他" },
];

interface CommentItemProps {
  key?: string;
  comment: BiliComment;
  pinned: boolean;
  fallbackAvatar: string;
  loggedIn: boolean;
  busy: boolean;
  replyOpen: boolean;
  reportOpen: boolean;
  reportDraft: ReportDraft;
  /** 回复列表 + 回复编辑器（父组件在展开时传入） */
  repliesSlot?: any;
  onLike(): void;
  onDislike(): void;
  onToggleReply(): void;
  onToggleReplies(): void;
  onToggleTop(): void;
  onDelete(): void;
  onToggleReport(): void;
  onReportReasonChange(reason: BiliReportReason): void;
  onReportContentChange(content: string): void;
  onReportSubmit(): void;
}

/**
 * 单条评论卡片（共享组件）。样式参考 animotion/视频评论：
 * 左侧点赞 rail（爱心+计数+分隔线），右侧用户行 + 内容 + 操作 + 回复 + 举报。
 */
export function CommentItem({
  comment,
  pinned,
  fallbackAvatar,
  loggedIn,
  busy,
  replyOpen,
  reportOpen,
  reportDraft,
  repliesSlot,
  onLike,
  onDislike,
  onToggleReply,
  onToggleReplies,
  onToggleTop,
  onDelete,
  onToggleReport,
  onReportReasonChange,
  onReportContentChange,
  onReportSubmit,
}: CommentItemProps) {
  const displayName = comment.member.name || `用户 ${comment.member.mid}`;

  return (
    <article className={`bili-comment-card ${pinned || comment.isTop ? "bili-comment-card-top" : ""}`}>
      <div className="bili-comment-main">
        <div className="bili-comment-user">
          <BiliImage className="bili-comment-avatar" fallbackSrc={fallbackAvatar} src={comment.member.avatar} />
          <div className="bili-comment-user-info">
            <span>{displayName}</span>
            <p>
              {comment.ctime ? formatTime(comment.ctime) : "刚刚"}
              {pinned || comment.isTop ? " · 置顶" : ""}
            </p>
          </div>
        </div>

        <p className="bili-comment-content">{comment.content.message}</p>

        {comment.content.pictures.length > 0 ? (
          <div className="bili-comment-pictures">
            {comment.content.pictures.map((url) => (
              <BiliImage key={url} src={url} loading="lazy" />
            ))}
          </div>
        ) : null}

        <div className="bili-comment-actions">
          <button
            className={`bili-thumb ${comment.liked ? "bili-thumb-active" : ""}`}
            disabled={!loggedIn || busy}
            title="点赞"
            type="button"
            onClick={onLike}
          >
            <ThumbIcon />
            <span>{comment.likeCount > 0 ? formatCount(comment.likeCount) : ""}</span>
          </button>
          <button
            className={`bili-thumb ${comment.disliked ? "bili-thumb-active" : ""}`}
            disabled={!loggedIn || busy}
            title="点踩"
            type="button"
            onClick={onDislike}
          >
            <ThumbIcon down />
          </button>
          <button disabled={!loggedIn} type="button" onClick={onToggleReply}>
            {replyOpen ? "收起回复框" : "回复"}
          </button>
          {comment.repliesCount > 0 ? (
            <button type="button" onClick={onToggleReplies}>
              {replyOpen ? "收起回复" : `展开 ${formatCount(comment.repliesCount)} 条回复`}
            </button>
          ) : null}
          {comment.canTop ? (
            <button disabled={busy} type="button" onClick={onToggleTop}>
              {comment.isTop || pinned ? "取消置顶" : "置顶"}
            </button>
          ) : null}
          {comment.canDelete ? (
            <button disabled={busy} type="button" onClick={onDelete}>
              删除
            </button>
          ) : null}
          <button type="button" onClick={onToggleReport}>
            举报
          </button>
        </div>

        {repliesSlot}

        {reportOpen ? (
          <div className="bili-comment-report">
            <select
              value={reportDraft.reason}
              onChange={(event: any) => onReportReasonChange(event.currentTarget.value as BiliReportReason)}
            >
              {reportReasons.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
            <input placeholder="补充说明" value={reportDraft.content} onChange={(event: any) => onReportContentChange(event.currentTarget.value)} />
            <button className="bili-button bili-button-ghost" disabled={!loggedIn || busy} type="button" onClick={onReportSubmit}>
              确认举报
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function formatCount(value: number) {
  if (value >= 100000000) return `${trim(value / 100000000)}亿`;
  if (value >= 10000) return `${trim(value / 10000)}万`;
  return String(Math.max(0, Math.floor(value || 0)));
}

function trim(value: number) {
  return value.toFixed(value >= 10 ? 0 : 1).replace(/\.0$/, "");
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp * 1000);
  const now = Date.now();
  const diff = now - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 拇指图标（参考 animotion/点赞点踩）。 */
function ThumbIcon({ down = false }: { down?: boolean }) {
  return (
    <svg className="bili-thumb-icon" viewBox="0 0 27 27" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {down ? (
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M26.7229 0.5L21.5229 0.5L21.5229 16.0992L26.7229 16.0992L26.7229 0.5ZM0.815853 11.7382L3.07376 3.24339C3.44687 1.63037 4.88372 0.500027 6.53861 0.500027L18.9229 0.500028L18.9229 16.0722L16.6885 24.1271C16.4789 25.492 15.304 26.5 13.9218 26.5C12.3759 26.5 11.1228 25.2473 11.1228 23.7016L11.1228 16.1002L4.28068 16.1002C1.99391 16.0991 0.300502 13.9664 0.815853 11.7382Z"
        />
      ) : (
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M0.7229 26.5H5.92292V10.9008H0.7229V26.5ZM26.6299 15.2618L24.372 23.7566C23.9989 25.3696 22.5621 26.5 20.9072 26.5H8.52293V10.9278L10.7573 2.87293C10.9669 1.50799 12.1418 0.5 13.524 0.5C15.0699 0.5 16.323 1.7527 16.323 3.29837V10.8998H23.1651C25.4519 10.9009 27.1453 13.0335 26.6299 15.2618Z"
        />
      )}
    </svg>
  );
}
