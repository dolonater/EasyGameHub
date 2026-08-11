import React, { Button, Icon, useRef, useState } from "sdk";
import type { BiliVideoInteractionState } from "../types";
import { CoinPanel } from "./CoinPanel";
import { FavoritePanel } from "./FavoritePanel";
import { WatchMoreMenu } from "./WatchMoreMenu";

interface VideoInteractionBarProps {
  busy: string;
  loggedIn: boolean;
  loading: boolean;
  state: BiliVideoInteractionState | null;
  onLike(): void;
  onCoin(multiply: 1 | 2, alsoLike: boolean): void;
  onFavorite(addMediaIds: string[], delMediaIds: string[]): void;
  onShare(): void;
  onToView(): void;
  onReport(): void;
  onExternalOpen(): void;
  onCopyLink(): void;
  onOpenScreenshotFolder(): void;
}

interface AnchorPosition {
  left?: number;
  right?: number;
  top: number;
}

export function VideoInteractionBar({
  busy,
  loggedIn,
  loading,
  state,
  onLike,
  onCoin,
  onFavorite,
  onShare,
  onToView,
  onReport,
  onExternalOpen,
  onCopyLink,
  onOpenScreenshotFolder,
}: VideoInteractionBarProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const coinAnchorRef = useRef<HTMLSpanElement | null>(null);
  const favoriteAnchorRef = useRef<HTMLSpanElement | null>(null);
  const moreAnchorRef = useRef<HTMLSpanElement | null>(null);
  const [coinOpen, setCoinOpen] = useState(false);
  const [favoriteOpen, setFavoriteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [coinPos, setCoinPos] = useState<AnchorPosition>({ left: 0, top: 0 });
  const [favoritePos, setFavoritePos] = useState<AnchorPosition>({ left: 0, top: 0 });
  const [morePos, setMorePos] = useState<AnchorPosition>({ right: 0, top: 0 });

  const disabled = loading || !state;
  const writeDisabled = disabled || !loggedIn || Boolean(busy);

  function toggleCoin() {
    if (!coinOpen) setCoinPos(anchorPosition(coinAnchorRef.current, "left"));
    setCoinOpen((value) => !value);
  }

  function toggleFavorite() {
    if (!favoriteOpen) setFavoritePos(anchorPosition(favoriteAnchorRef.current, "left"));
    setFavoriteOpen((value) => !value);
  }

  function toggleMore() {
    if (!moreOpen) setMorePos(anchorPosition(moreAnchorRef.current, "right"));
    setMoreOpen((value) => !value);
  }

  function anchorPosition(el: HTMLElement | null, align: "left" | "right"): AnchorPosition {
    const wrap = wrapRef.current;
    if (!wrap || !el) return align === "right" ? { right: 0, top: 0 } : { left: 0, top: 0 };
    const wr = wrap.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const top = er.bottom - wr.top + 8;
    if (align === "right") return { right: wr.right - er.right, top };
    return { left: er.left - wr.left, top };
  }

  return (
    <div className="bili-interaction-wrap" ref={wrapRef}>
      <div className="bili-interaction-bar" aria-label="视频互动">
        <ActionButton
          active={Boolean(state?.liked)}
          disabled={writeDisabled}
          icon="heartFilled"
          label="点赞"
          value={formatCount(state?.stats.likeCount)}
          onClick={onLike}
        />
        <span className="bili-popover-anchor" ref={coinAnchorRef}>
          <ActionButton
            active={Boolean(state?.coinCount)}
            disabled={writeDisabled}
            label="投币"
            value={state?.coinCount ? `已投 ${state.coinCount}` : formatCount(state?.stats.coinCount)}
            onMouseDown={toggleCoin}
          />
        </span>
        <span className="bili-popover-anchor" ref={favoriteAnchorRef}>
          <ActionButton
            active={Boolean(state?.favorited)}
            disabled={writeDisabled}
            icon={state?.favorited ? "starFilled" : "starOutline"}
            label="收藏"
            value={formatCount(state?.stats.favoriteCount)}
            onMouseDown={toggleFavorite}
          />
        </span>
        <ActionButton
          disabled={disabled || Boolean(busy)}
          label="分享"
          value={formatCount(state?.stats.shareCount)}
          onClick={onShare}
        />
        <ActionButton
          active={Boolean(state?.toView)}
          disabled={writeDisabled}
          icon="bookmarkFilled"
          label="稍后再看"
          value={state?.toView ? "已加入" : ""}
          onClick={onToView}
        />
        <ActionButton disabled={disabled || Boolean(busy)} icon="warning" label="举报" value="" onClick={onReport} />
        <span className="bili-popover-anchor" ref={moreAnchorRef}>
          <ActionButton disabled={disabled} label="更多" value="" onMouseDown={toggleMore} />
        </span>
      </div>

      {coinOpen ? (
        <CoinPanel
          busy={busy === "coin"}
          onClose={() => setCoinOpen(false)}
          onSubmit={onCoin}
          style={{ left: coinPos.left ?? 0, top: coinPos.top }}
          triggerRef={coinAnchorRef}
        />
      ) : null}
      {favoriteOpen && state ? (
        <FavoritePanel
          busy={busy === "favorite"}
          folders={state.favoriteFolders}
          onClose={() => setFavoriteOpen(false)}
          onSubmit={onFavorite}
          style={{ left: favoritePos.left ?? 0, top: favoritePos.top }}
          triggerRef={favoriteAnchorRef}
        />
      ) : null}
      {moreOpen ? (
        <WatchMoreMenu
          onClose={() => setMoreOpen(false)}
          onExternalOpen={onExternalOpen}
          onCopyLink={onCopyLink}
          onOpenScreenshotFolder={onOpenScreenshotFolder}
          style={{ right: morePos.right ?? 0, top: morePos.top }}
          triggerRef={moreAnchorRef}
        />
      ) : null}
    </div>
  );
}

interface ActionButtonProps {
  active?: boolean;
  disabled?: boolean;
  label: string;
  value?: string;
  icon?: string;
  onClick?: () => void;
  onMouseDown?: () => void;
}

function ActionButton({ active, disabled, label, value, icon, onClick, onMouseDown }: ActionButtonProps) {
  return (
    <Button
      className={active ? "bili-interaction-button bili-interaction-button-active" : "bili-interaction-button"}
      disabled={disabled}
      size="sm"
      type="button"
      variant="ghost"
      onClick={onClick}
      onMouseDown={onMouseDown}
    >
      {icon ? <Icon name={icon as any} size={15} /> : null}
      <span>{label}</span>
      {value ? <small>{value}</small> : null}
    </Button>
  );
}

function formatCount(value: number | undefined) {
  if (!value) return "";
  if (value >= 100000000) return `${trim(value / 100000000)}亿`;
  if (value >= 10000) return `${trim(value / 10000)}万`;
  return String(Math.max(0, Math.floor(value)));
}

function trim(value: number) {
  return value.toFixed(value >= 10 ? 0 : 1).replace(/\.0$/, "");
}
