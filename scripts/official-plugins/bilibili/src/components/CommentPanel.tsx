import React, { useCallback, useEffect, useState } from "sdk";
import type {
  BiliComment,
  BiliCommentSort,
  BiliReportReason,
  BiliVideoDetail,
  PluginSdk,
} from "../types";
import { errorMessage } from "../runtime";
import { CommentItem, reportReasons, type ReportDraft } from "./CommentItem";

interface CommentPanelProps {
  detail: BiliVideoDetail;
  loggedIn: boolean;
  sdk: PluginSdk | null;
  /** 覆盖评论 oid（动态等非视频场景；默认 detail.aid）。dyn_id 超过 2^53 需传字符串 */
  oid?: string | number;
  /** 评论区类型（默认 1 视频；动态为 17） */
  type?: number;
}

interface ReplyState {
  items: BiliComment[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  error: string;
}

const sortOptions: Array<{ value: BiliCommentSort; label: string }> = [
  { value: "replies", label: "热门" },
  { value: "time", label: "最新" },
  { value: "like", label: "最多赞" },
];

export function CommentPanel({ detail, loggedIn, sdk, oid, type }: CommentPanelProps) {
  const commentOid = oid ?? detail.aid;
  const commentType = type ?? 1;
  const [sort, setSort] = useState<BiliCommentSort>("replies");
  const [comments, setComments] = useState<BiliComment[]>([]);
  const [topComments, setTopComments] = useState<BiliComment[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyRpid, setBusyRpid] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [mainMessage, setMainMessage] = useState("");
  const [replyOpen, setReplyOpen] = useState<Record<number, boolean>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [replyTargets, setReplyTargets] = useState<Record<number, number>>({});
  const [replyStates, setReplyStates] = useState<Record<number, ReplyState>>({});
  const [reportOpen, setReportOpen] = useState<Record<number, boolean>>({});
  const [reportDrafts, setReportDrafts] = useState<Record<number, ReportDraft>>({});

  const loadPage = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!sdk) return;
      setLoading(true);
      setError("");
      try {
        const result = await sdk.bilibili.comment.list({ oid: commentOid, page: nextPage, sort, type: commentType });
        setPage(result.page || nextPage);
        setTotal(result.total || 0);
        setHasMore(result.hasMore);
        setComments((items) => (append ? mergeComments(items, result.comments) : result.comments));
        setTopComments(result.topComments ?? []);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [commentOid, sdk, sort],
  );

  useEffect(() => {
    setComments([]);
    setTopComments([]);
    setPage(1);
    setReplyOpen({});
    setReplyStates({});
    void loadPage(1, false);
  }, [loadPage]);

  return (
    <section className="bili-comments">
      <div className="bili-comments-header">
        <div className="bili-section-title">
          <strong>评论</strong>
          <small>{loading && comments.length === 0 ? "加载中" : `${formatCount(total || detail.stats.replyCount)} 条`}</small>
        </div>
        <div className="bili-comment-sort" role="tablist" aria-label="评论排序">
          {sortOptions.map((option) => (
            <button
              className={sort === option.value ? "bili-chip bili-chip-active" : "bili-chip"}
              key={option.value}
              type="button"
              onClick={() => setSort(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <form className="bili-comment-editor" onSubmit={submitMainComment}>
        <textarea
          disabled={!loggedIn || !sdk || busyRpid === 0}
          placeholder={loggedIn ? "发一条友善的评论" : "登录后可以发表评论"}
          value={mainMessage}
          onChange={(event: any) => setMainMessage(event.currentTarget.value)}
        />
        <div className="bili-comment-editor-actions">
          <span>{mainMessage.trim().length}/1000</span>
          <button className="bili-button" disabled={!loggedIn || !sdk || busyRpid === 0 || !mainMessage.trim()} type="submit">
            发布
          </button>
        </div>
      </form>

      {error ? <div className="bili-state bili-state-error bili-state-compact">{error}</div> : null}
      {topComments.length > 0 ? (
        <div className="bili-comment-top-list">
          {topComments.map((comment) => renderComment(comment, true))}
        </div>
      ) : null}
      {!loading && comments.length === 0 && !error ? <div className="bili-state">暂无评论</div> : null}
      <div className="bili-comment-list">{comments.map((comment) => renderComment(comment, false))}</div>
      <div className="bili-comment-footer">
        {hasMore ? (
          <button className="bili-button bili-button-ghost" disabled={loading} type="button" onClick={() => loadPage(page + 1, true)}>
            {loading ? "加载中" : "加载更多"}
          </button>
        ) : comments.length > 0 ? (
          <span>已加载全部评论</span>
        ) : null}
      </div>
    </section>
  );

  function renderComment(comment: BiliComment, pinned: boolean) {
    const replyState = replyStates[comment.rpid];
    const reportDraft = reportDrafts[comment.rpid] ?? { reason: "ad" as BiliReportReason, content: "" };
    const replyOpenThis = Boolean(replyOpen[comment.rpid]);
    const draft = replyDrafts[comment.rpid] ?? "";
    return (
      <CommentItem
        key={`${pinned ? "top" : "comment"}-${comment.rpid}`}
        comment={comment}
        pinned={pinned}
        fallbackAvatar={detail.cover}
        loggedIn={loggedIn}
        busy={busyRpid === comment.rpid}
        replyOpen={replyOpenThis}
        reportOpen={Boolean(reportOpen[comment.rpid])}
        reportDraft={reportDraft}
        repliesSlot={
          replyOpenThis ? (
            <div className="bili-comment-replies">
              {replyState?.error ? <div className="bili-state bili-state-error bili-state-compact">{replyState.error}</div> : null}
              {(replyState?.items ?? comment.replies).map((reply) => renderReply(reply, comment.rpid))}
              {replyState?.hasMore ? (
                <button
                  className="bili-button bili-button-ghost"
                  disabled={replyState.loading}
                  type="button"
                  onClick={() => loadReplies(comment.rpid, (replyState.page || 1) + 1, true)}
                >
                  {replyState.loading ? "加载中" : "更多回复"}
                </button>
              ) : null}
              <form className="bili-comment-reply-editor" onSubmit={(event: any) => submitReply(event, comment)}>
                <input
                  disabled={!loggedIn || busyRpid === comment.rpid}
                  placeholder={loggedIn ? `回复 ${comment.member.name || "评论"}` : "登录后可以回复"}
                  value={draft}
                  onChange={(event: any) => setReplyDrafts((value) => ({ ...value, [comment.rpid]: event.currentTarget.value }))}
                />
                <button className="bili-button" disabled={!loggedIn || !draft.trim() || busyRpid === comment.rpid} type="submit">
                  发送
                </button>
              </form>
            </div>
          ) : null
        }
        onLike={() => toggleLike(comment)}
        onDislike={() => toggleDislike(comment)}
        onToggleReply={() => setReplyOpen((value) => ({ ...value, [comment.rpid]: !value[comment.rpid] }))}
        onToggleReplies={() => toggleReplies(comment)}
        onToggleTop={() => toggleTop(comment)}
        onDelete={() => deleteComment(comment)}
        onToggleReport={() => setReportOpen((value) => ({ ...value, [comment.rpid]: !value[comment.rpid] }))}
        onReportReasonChange={(reason: BiliReportReason) =>
          setReportDrafts((value) => ({ ...value, [comment.rpid]: { ...reportDraft, reason } }))
        }
        onReportContentChange={(content: string) =>
          setReportDrafts((value) => ({ ...value, [comment.rpid]: { ...reportDraft, content } }))
        }
        onReportSubmit={() => reportComment(comment, reportDraft)}
      />
    );
  }

  function renderReply(reply: BiliComment, root: number) {
    const reportDraft = reportDrafts[reply.rpid] ?? { reason: "ad" as BiliReportReason, content: "" };
    return (
      <div className="bili-comment-reply-wrap" key={`reply-${reply.rpid}`}>
        <div className="bili-comment-reply">
          <strong>{reply.member.name || `用户 ${reply.member.mid}`}</strong>
          <span>{reply.content.message}</span>
          <button disabled={!loggedIn || busyRpid === reply.rpid} type="button" onClick={() => toggleLike(reply)}>
            {reply.liked ? "已赞" : "赞"} {reply.likeCount > 0 ? formatCount(reply.likeCount) : ""}
          </button>
          <button disabled={!loggedIn || busyRpid === reply.rpid} type="button" onClick={() => toggleDislike(reply)}>
            {reply.disliked ? "已点踩" : "点踩"}
          </button>
          <button
            disabled={!loggedIn}
            type="button"
            onClick={() => {
              setReplyOpen((value) => ({ ...value, [root]: true }));
              setReplyTargets((value) => ({ ...value, [root]: reply.rpid }));
              setReplyDrafts((value) => ({ ...value, [root]: `回复 @${reply.member.name}：` }));
            }}
          >
            回复
          </button>
          {reply.canDelete ? (
            <button disabled={busyRpid === reply.rpid} type="button" onClick={() => deleteComment(reply)}>
              删除
            </button>
          ) : null}
          <button type="button" onClick={() => setReportOpen((value) => ({ ...value, [reply.rpid]: !value[reply.rpid] }))}>
            举报
          </button>
        </div>
        {reportOpen[reply.rpid] ? (
          <div className="bili-comment-report">
            <select
              value={reportDraft.reason}
              onChange={(event: any) =>
                setReportDrafts((value) => ({
                  ...value,
                  [reply.rpid]: { ...reportDraft, reason: event.currentTarget.value as BiliReportReason },
                }))
              }
            >
              {reportReasons.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
            <input
              placeholder="补充说明"
              value={reportDraft.content}
              onChange={(event: any) =>
                setReportDrafts((value) => ({
                  ...value,
                  [reply.rpid]: { ...reportDraft, content: event.currentTarget.value },
                }))
              }
            />
            <button className="bili-button bili-button-ghost" disabled={!loggedIn || busyRpid === reply.rpid} type="button" onClick={() => reportComment(reply, reportDraft)}>
              确认举报
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  async function submitMainComment(event: { preventDefault(): void }) {
    event.preventDefault();
    if (!sdk || !loggedIn || !mainMessage.trim()) return;
    setBusyRpid(0);
    setError("");
    try {
      const created = await sdk.bilibili.comment.add({ oid: commentOid, message: mainMessage });
      setComments((items) => [created, ...items]);
      setMainMessage("");
      await loadPage(1, false);
      notify("评论已发布");
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      notify(message);
    } finally {
      setBusyRpid(null);
    }
  }

  async function submitReply(event: { preventDefault(): void }, comment: BiliComment) {
    event.preventDefault();
    const draft = replyDrafts[comment.rpid] ?? "";
    if (!sdk || !loggedIn || !draft.trim()) return;
    setBusyRpid(comment.rpid);
    try {
      const created = await sdk.bilibili.comment.add({
        oid: commentOid,
        message: draft,
        root: comment.root || comment.rpid,
        parent: replyTargets[comment.rpid] || comment.rpid,
      });
      setReplyDrafts((value) => ({ ...value, [comment.rpid]: "" }));
      setReplyTargets((value) => ({ ...value, [comment.rpid]: comment.rpid }));
      setReplyStates((states) => ({
        ...states,
        [comment.rpid]: {
          items: [created, ...(states[comment.rpid]?.items ?? comment.replies)],
          page: states[comment.rpid]?.page ?? 1,
          hasMore: states[comment.rpid]?.hasMore ?? false,
          loading: false,
          error: "",
        },
      }));
      notify("回复已发布");
    } catch (err) {
      const message = errorMessage(err);
      setReplyStates((states) => ({
        ...states,
        [comment.rpid]: { ...(states[comment.rpid] ?? emptyReplyState(comment.replies)), error: message },
      }));
      notify(message);
    } finally {
      setBusyRpid(null);
    }
  }

  async function toggleReplies(comment: BiliComment) {
    const open = !replyOpen[comment.rpid];
    setReplyOpen((value) => ({ ...value, [comment.rpid]: open }));
    if (open && !replyStates[comment.rpid]) {
      await loadReplies(comment.rpid, 1, false);
    }
  }

  async function loadReplies(root: number, nextPage: number, append: boolean) {
    if (!sdk) return;
    setReplyStates((states) => ({
      ...states,
      [root]: { ...(states[root] ?? emptyReplyState([])), loading: true, error: "" },
    }));
    try {
      const result = await sdk.bilibili.comment.replies({ oid: commentOid, root, page: nextPage });
      setReplyStates((states) => ({
        ...states,
        [root]: {
          items: append ? mergeComments(states[root]?.items ?? [], result.comments) : result.comments,
          page: result.page || nextPage,
          hasMore: result.hasMore,
          loading: false,
          error: "",
        },
      }));
    } catch (err) {
      setReplyStates((states) => ({
        ...states,
        [root]: { ...(states[root] ?? emptyReplyState([])), loading: false, error: errorMessage(err) },
      }));
    }
  }

  async function toggleLike(comment: BiliComment) {
    if (!sdk || !loggedIn) return;
    const previous = snapshot();
    const nextLike = !comment.liked;
    patchAllComments(comment.rpid, (item) => ({
      ...item,
      liked: nextLike,
      disliked: nextLike ? false : item.disliked,
      likeCount: Math.max(0, item.likeCount + (nextLike ? 1 : -1)),
    }));
    setBusyRpid(comment.rpid);
    try {
      await sdk.bilibili.comment.like({ oid: commentOid, rpid: comment.rpid, like: nextLike });
    } catch (err) {
      restore(previous);
      notify(errorMessage(err));
    } finally {
      setBusyRpid(null);
    }
  }

  async function toggleDislike(comment: BiliComment) {
    if (!sdk || !loggedIn) return;
    const previous = snapshot();
    const nextDislike = !comment.disliked;
    patchAllComments(comment.rpid, (item) => ({
      ...item,
      disliked: nextDislike,
      liked: nextDislike ? false : item.liked,
      likeCount: nextDislike && item.liked ? Math.max(0, item.likeCount - 1) : item.likeCount,
    }));
    setBusyRpid(comment.rpid);
    try {
      await sdk.bilibili.comment.dislike({ oid: commentOid, rpid: comment.rpid, dislike: nextDislike });
    } catch (err) {
      restore(previous);
      notify(errorMessage(err));
    } finally {
      setBusyRpid(null);
    }
  }

  async function deleteComment(comment: BiliComment) {
    if (!sdk || !window.confirm("确认删除这条评论？")) return;
    setBusyRpid(comment.rpid);
    try {
      await sdk.bilibili.comment.delete({ oid: commentOid, rpid: comment.rpid });
      setComments((items) => removeComment(items, comment.rpid));
      setTopComments((items) => removeComment(items, comment.rpid));
      setReplyStates((states) => mapReplyStates(states, (items) => removeComment(items, comment.rpid)));
      notify("评论已删除");
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setBusyRpid(null);
    }
  }

  async function toggleTop(comment: BiliComment) {
    if (!sdk) return;
    const nextTop = !comment.isTop;
    setBusyRpid(comment.rpid);
    try {
      await sdk.bilibili.comment.top({ oid: commentOid, rpid: comment.rpid, top: nextTop });
      await loadPage(1, false);
      notify(nextTop ? "评论已置顶" : "已取消置顶");
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setBusyRpid(null);
    }
  }

  async function reportComment(comment: BiliComment, draft: ReportDraft) {
    if (!sdk || !window.confirm("确认举报这条评论？")) return;
    setBusyRpid(comment.rpid);
    try {
      await sdk.bilibili.comment.report({
        oid: commentOid,
        rpid: comment.rpid,
        reason: draft.reason,
        content: draft.content.trim() || undefined,
      });
      setReportOpen((value) => ({ ...value, [comment.rpid]: false }));
      notify("举报已提交");
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setBusyRpid(null);
    }
  }

  function snapshot() {
    return { comments, topComments, replyStates };
  }

  function restore(previous: ReturnType<typeof snapshot>) {
    setComments(previous.comments);
    setTopComments(previous.topComments);
    setReplyStates(previous.replyStates);
  }

  function patchAllComments(rpid: number, patch: (comment: BiliComment) => BiliComment) {
    setComments((items) => patchComments(items, rpid, patch));
    setTopComments((items) => patchComments(items, rpid, patch));
    setReplyStates((states) => mapReplyStates(states, (items) => patchComments(items, rpid, patch)));
  }

  function notify(message: string) {
    if (sdk && message) sdk.ui.notify(message);
  }
}

function emptyReplyState(items: BiliComment[]): ReplyState {
  return { items, page: 1, hasMore: false, loading: false, error: "" };
}

function mergeComments(previous: BiliComment[], next: BiliComment[]) {
  const seen = new Set(previous.map((comment) => comment.rpid));
  return [...previous, ...next.filter((comment) => !seen.has(comment.rpid))];
}

function patchComments(
  items: BiliComment[],
  rpid: number,
  patch: (comment: BiliComment) => BiliComment,
): BiliComment[] {
  return items.map((item) => {
    const next = item.rpid === rpid ? patch(item) : item;
    if (next.replies.length === 0) return next;
    return { ...next, replies: patchComments(next.replies, rpid, patch) };
  });
}

function removeComment(items: BiliComment[], rpid: number): BiliComment[] {
  return items
    .filter((item) => item.rpid !== rpid)
    .map((item) => ({ ...item, replies: removeComment(item.replies, rpid) }));
}

function mapReplyStates(
  states: Record<number, ReplyState>,
  map: (items: BiliComment[]) => BiliComment[],
): Record<number, ReplyState> {
  const next: Record<number, ReplyState> = {};
  Object.entries(states).forEach(([root, state]) => {
    next[Number(root)] = { ...state, items: map(state.items) };
  });
  return next;
}

function formatCount(value: number) {
  if (value >= 100000000) return `${trim(value / 100000000)}亿`;
  if (value >= 10000) return `${trim(value / 10000)}万`;
  return String(Math.max(0, Math.floor(value || 0)));
}

function trim(value: number) {
  return value.toFixed(value >= 10 ? 0 : 1).replace(/\.0$/, "");
}
