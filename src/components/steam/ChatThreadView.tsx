import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import Icon from "../ui/Icon";
import TextField from "../ui/TextField";
import Button from "../ui/Button";
import { stickerImageUrl } from "../../lib/steamSocial";
import type { ChatThreadApi, ChatThreadMessage } from "../../hooks/useChatThread";

/** Render a message body: `/sticker <name>` → sticker, `[img]url[/img]` → image, else text. */
export function ChatMessageContent({ text }: { text: string }) {
  const trimmed = text.trim();
  const stickerMatch = /^\/sticker\s+(.+?)\s*$/.exec(trimmed);
  if (stickerMatch) {
    return (
      <img
        src={stickerImageUrl(stickerMatch[1])}
        alt={stickerMatch[1]}
        className="max-h-28 max-w-[160px] object-contain"
        loading="lazy"
      />
    );
  }
  const imgSrc = extractImgSrc(trimmed);
  if (imgSrc) {
    return (
      <img
        src={imgSrc}
        alt=""
        className="max-h-64 max-w-full rounded-lg object-contain"
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }
  return <>{text}</>;
}

/** Extract the display URL from a Steam image BBCode chat message. */
function extractImgSrc(text: string): string | null {
  // Rich form Steam's own clients emit for shared images:
  //   [img src=<url> thumbnail_src=<url> srcset="..." width=.. height=..]
  //     [url=<url>]url[/url][/img]
  const rich = /^\[img\b([^\]]*)\][\s\S]*\[\/img\]$/i.exec(text);
  if (rich) {
    const attrs = rich[1];
    // Prefer the scaled CDN thumbnail (`?imw=512...`) over the full-resolution
    // original for the in-bubble preview.
    const thumb = /thumbnail_src=([^\s\]]+)/i.exec(attrs);
    if (thumb) return thumb[1];
    const src = /\bsrc=([^\s\]]+)/i.exec(attrs);
    if (src) return src[1];
  }
  // Plain BBCode: [img]url[/img] or [img=WxH]url[/img]
  const plain = /^\[img[^\]]*\](https?:\/\/[^\[]+)\[\/img\]$/i.exec(text);
  return plain ? plain[1] : null;
}

/** Local "HH:mm" for a unix-seconds timestamp. */
export function formatChatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** A date separator label: same day → "HH:mm", otherwise "M月d日 HH:mm". */
export function formatChatDate(ts: number): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return formatChatTime(ts);
  const date = d.toLocaleDateString([], { month: "numeric", day: "numeric" });
  return `${date} ${formatChatTime(ts)}`;
}

interface ChatThreadViewProps<T extends ChatThreadMessage> {
  api: ChatThreadApi<T>;
  /** Show the sender label on others' bubbles (group chat). */
  showSender?: boolean;
  /** Label for the sender line (e.g. steamid tail). */
  senderLabel?: (m: T) => string;
  /** Avatar for others' bubbles (friend chat = the partner's avatar). `null`
   * disables avatars (group chat falls back to `senderLabel`). */
  avatarOf?: (m: T) => string | null;
  /** Are two messages from the same sender? (friend: `steamId`, group:
   * `senderSteamId`). Drives message grouping — consecutive same-sender
   * messages render tight with the avatar only on the first. */
  sameSender?: (a: T, b: T) => boolean;
  /** i18n key for the empty-thread hint. */
  emptyKey: string;
  onPickImage: () => void;
  onToggleSticker: () => void;
  uploading: boolean;
  imageTitle: string;
  stickerTitle: string;
  placeholder: string;
  sendLabel: string;
}

/**
 * Presentational chat pane shared by the friends and group panes: message
 * bubbles (sticker/image/text), date/time separators, delivery states with
 * retry, the scroll-to-top "load older" affordance, and the input bar (image /
 * sticker / text / send). State lives in `useChatThread`.
 */
export default function ChatThreadView<T extends ChatThreadMessage>({
  api,
  showSender = false,
  senderLabel,
  avatarOf,
  sameSender,
  emptyKey,
  onPickImage,
  onToggleSticker,
  uploading,
  imageTitle,
  stickerTitle,
  placeholder,
  sendLabel,
}: ChatThreadViewProps<T>) {
  const { t } = useTranslation();
  const { messages, historyError } = api;

  return (
    <>
      <div
        ref={api.listRef}
        onScroll={api.handleScroll}
        className="min-h-0 flex-1 overflow-y-auto pr-1"
      >
        {api.loadingOlder && (
          <div className="py-1 text-center text-[10px] text-muted-foreground">
            {t("steam.socialLoadingOlder")}
          </div>
        )}
        {messages.length === 0 && historyError ? (
          <div className="break-words px-2 py-8 text-center text-xs text-red-500">
            {t("steam.socialLoadFailed", { error: historyError })}
          </div>
        ) : messages.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">{t(emptyKey)}</div>
        ) : null}
        {messages.map((m, i) => {
          const self = api.isSelf(m);
          const prev = messages[i - 1];
          // A continuation = the previous message is from the same sender and
          // within 5 minutes: render tight, with the avatar/label only once.
          const continuation = !!prev && !!sameSender && sameSender(prev, m) && m.timestamp - prev.timestamp <= 300;
          // Insert a date/time separator when there's a quiet gap (> 5 minutes).
          const showSep = !!prev && m.timestamp - prev.timestamp > 300;
          // Spacing per row: first message no top margin, continuations tight,
          // otherwise a normal gap (the old `space-y-2` had no grouping).
          const rowMt = i === 0 ? "" : continuation ? "mt-0.5" : "mt-2";
          // Avatar on the first message of an others' group.
          const avatar = !self && !continuation && avatarOf ? avatarOf(m) : null;
          return (
            <Fragment key={api.dedup(m) + i}>
              {showSep && (
                <div className="mt-2 flex justify-center py-1">
                  <span className="rounded-full bg-secondary/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                    {formatChatDate(m.timestamp)}
                  </span>
                </div>
              )}
              <div className={`${rowMt} flex items-end ${self ? "justify-end" : "justify-start"}`}>
                {avatar && (
                  <img
                    src={avatar}
                    alt=""
                    className="mr-2 h-8 w-8 flex-none rounded-full"
                  />
                )}
                <div
                  title={formatChatTime(m.timestamp)}
                  className={`max-w-[75%] rounded-xl px-3 py-1.5 text-sm ${
                    self
                      ? "rounded-br-sm bg-primary/20 text-foreground"
                      : "rounded-bl-sm bg-secondary/60 text-foreground"
                  }`}
                >
                  {showSender && !self && senderLabel && !continuation && (
                    <div className="mb-0.5 text-[10px] text-muted-foreground">{senderLabel(m)}</div>
                  )}
                  <ChatMessageContent text={m.message} />
                  {self && m.deliveryState === "pending" && (
                    <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                      <span>{t("steam.socialSending")}</span>
                    </div>
                  )}
                  {self && m.deliveryState === "sent" && m.localId && (
                    <div className="mt-0.5 flex items-center justify-end text-[10px] text-muted-foreground">
                      <span>✓</span>
                    </div>
                  )}
                  {self && m.deliveryState === "failedRetryable" && (
                    <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[10px]">
                      <span className="text-red-500">{t("steam.socialFailed")}</span>
                      <button
                        type="button"
                        onClick={() => api.retry(m)}
                        className="text-primary underline"
                      >
                        {t("steam.socialRetry")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPickImage}
          disabled={uploading}
          title={imageTitle}
          className="flex-none px-2"
        >
          <Icon name="image" size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSticker}
          title={stickerTitle}
          className="flex-none px-2"
        >
          <Icon name="starFilled" size={16} />
        </Button>
        <TextField
          value={api.input}
          onChange={(e) => api.setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              api.send();
            }
          }}
          placeholder={placeholder}
          className="flex-1"
          density="compact"
        />
        <Button
          variant="primary"
          size="sm"
          onClick={() => api.send()}
          disabled={api.sending || !api.input.trim()}
        >
          {sendLabel}
        </Button>
      </div>
    </>
  );
}
