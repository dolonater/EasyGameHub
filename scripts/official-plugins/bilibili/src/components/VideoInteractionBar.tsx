import React, { Button, useState } from "sdk";
import type { BiliVideoInteractionState } from "../types";
import { CoinPanel } from "./CoinPanel";
import { FavoritePanel } from "./FavoritePanel";

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
  onMore(): void;
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
  onMore,
}: VideoInteractionBarProps) {
  const [coinOpen, setCoinOpen] = useState(false);
  const [favoriteOpen, setFavoriteOpen] = useState(false);
  const disabled = loading || !state;
  const writeDisabled = disabled || !loggedIn || Boolean(busy);

  return (
    <div className="bili-interaction-wrap">
      <div className="bili-interaction-bar" aria-label="视频互动">
        <ActionButton
          active={Boolean(state?.liked)}
          disabled={writeDisabled}
          label="点赞"
          value={formatCount(state?.stats.likeCount)}
          onClick={onLike}
        />
        <ActionButton
          active={Boolean(state?.coinCount)}
          disabled={writeDisabled}
          label="投币"
          value={state?.coinCount ? `已投 ${state.coinCount}` : formatCount(state?.stats.coinCount)}
          onClick={() => setCoinOpen((value) => !value)}
        />
        <ActionButton
          active={Boolean(state?.favorited)}
          disabled={writeDisabled}
          label="收藏"
          value={formatCount(state?.stats.favoriteCount)}
          onClick={() => setFavoriteOpen((value) => !value)}
        />
        <ActionButton disabled={disabled || Boolean(busy)} label="分享" value={formatCount(state?.stats.shareCount)} onClick={onShare} />
        <ActionButton
          active={Boolean(state?.toView)}
          disabled={writeDisabled}
          label="稍后再看"
          value={state?.toView ? "已加入" : ""}
          onClick={onToView}
        />
        <ActionButton disabled={disabled || Boolean(busy)} label="举报" value="" onClick={onReport} />
        <ActionButton disabled={disabled} label="更多" value="" onClick={onMore} />
      </div>
      {coinOpen ? (
        <CoinPanel
          busy={busy === "coin"}
          onClose={() => setCoinOpen(false)}
          onSubmit={(multiply, alsoLike) => {
            onCoin(multiply, alsoLike);
            setCoinOpen(false);
          }}
        />
      ) : null}
      {favoriteOpen && state ? (
        <FavoritePanel
          busy={busy === "favorite"}
          folders={state.favoriteFolders}
          onClose={() => setFavoriteOpen(false)}
          onSubmit={(addMediaIds, delMediaIds) => {
            onFavorite(addMediaIds, delMediaIds);
            setFavoriteOpen(false);
          }}
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
  onClick(): void;
}

function ActionButton({ active, disabled, label, value, onClick }: ActionButtonProps) {
  return (
    <Button
      className={active ? "bili-interaction-button bili-interaction-button-active" : "bili-interaction-button"}
      disabled={disabled}
      size="sm"
      type="button"
      variant="ghost"
      onClick={onClick}
    >
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
