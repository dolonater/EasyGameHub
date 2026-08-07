import { useRef, useState } from "react";
import type { GameInfo } from "../../lib/types";
import { formatTimestamp } from "../../lib/types";
import { useAnimation } from "../../hooks/useAnimation";
import { coverCardContainerClass, coverCardSurfaceClass } from "../../lib/coverCardStyle";
import GameIcon from "../GameIcon";
import Icon from "./Icon";
import Checkbox from "./Checkbox";

export interface GameCardProps {
  game: GameInfo;
  batchMode?: boolean;
  selected?: boolean;
  onToggle?: () => void;
  showAdd?: boolean;
  onAdd?: (g: GameInfo) => void;
  onDoubleClick?: (g: GameInfo) => void;
  onClick?: (g: GameInfo) => void;
  onContextMenu?: (e: React.MouseEvent, g: GameInfo) => void;
  isRunning?: boolean;
  statusDotState?: "running" | "installed" | "muted";
  playtime?: number;
  lastBackup?: string | null;
  snapshotCount?: number;
  isFavorite?: boolean;
  onToggleFavorite?: (g: GameInfo) => void;
  tags?: string[];
  cardStyle?: "default" | "card1";
  revealText?: string;
  className?: string;
  style?: React.CSSProperties;
  t: any;
}

function formatPlaytime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

export default function GameCard({
  game,
  batchMode,
  selected,
  onToggle,
  showAdd,
  onAdd,
  onDoubleClick,
  onClick,
  onContextMenu,
  isRunning,
  statusDotState,
  playtime,
  lastBackup,
  snapshotCount,
  isFavorite,
  onToggleFavorite,
  tags,
  cardStyle = "default",
  revealText,
  className,
  style,
  t,
}: GameCardProps) {
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anim = useAnimation();
  const [clicked, setClicked] = useState(false);

  const handleClick = () => {
    if (onDoubleClick) {
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
        setClicked(false);
        onDoubleClick(game);
      } else {
        setClicked(true);
        clickTimer.current = setTimeout(() => {
          clickTimer.current = null;
          setClicked(false);
          onClick?.(game);
        }, 200);
      }
    } else {
      onClick?.(game);
    }
  };

  const subtitleText = isRunning
    ? t("games.status.active")
    : playtime != null && playtime > 0
      ? formatPlaytime(playtime)
      : lastBackup
        ? formatTimestamp(lastBackup)
        : snapshotCount != null && snapshotCount > 0
          ? `${snapshotCount} ${t("games.snap")}`
          : t("games.noLastBackup");
  const cardRevealText = revealText || subtitleText;
  const dotState = statusDotState || (isRunning ? "running" : "muted");
  const dotClass = dotState === "running"
    ? "bg-green-500"
    : dotState === "installed"
      ? "bg-green-500"
      : "bg-muted-foreground/40";

  const overlay = (
    <>
      {batchMode && (
        <span onClick={(e) => e.stopPropagation()} className="absolute top-2 right-2 z-20">
          <Checkbox checked={selected ?? false} onChange={() => onToggle?.()} color="green" />
        </span>
      )}

      {showAdd && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd?.(game);
          }}
          className="app-surface app-glass-button absolute bottom-2 right-2 z-20 inline-flex h-9 w-9 items-center justify-center !rounded-full border border-primary/25 bg-primary/10 text-primary opacity-0 shadow-sm group-hover:opacity-100 transition-all duration-200 hover:bg-primary hover:text-primary-foreground"
          title={t("games.addGame")}
        >
          <Icon name="addGame" size={18} />
        </button>
      )}
    </>
  );

  if (cardStyle === "card1") {
    return (
      <div
        onContextMenu={(e) => onContextMenu?.(e, game)}
        onClick={handleClick}
        style={style}
        className={`game-cover-card game-card-style-card1 rounded-[var(--radius)] group cursor-pointer relative ${anim ? "is-animated animate-rise-in" : ""} ${clicked ? "ring-2 ring-primary scale-[0.97]" : ""} ${className || ""}`}
      >
        {overlay}
        <div className="game-card-surface">
          <div className="game-card-media aspect-[600/900] bg-secondary/30 relative overflow-hidden">
            {game.steam_app_id ? (
              <img
                src={`https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${game.steam_app_id}/library_600x900.jpg`}
                alt={game.name}
                className="game-card-media-image w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).parentElement!.querySelector(".fallback-icon")?.classList.remove("hidden");
                }}
              />
            ) : null}
            <GameIcon
              steamAppId={null}
              name={game.name}
              className={`w-full h-full text-3xl fallback-icon ${game.steam_app_id ? "hidden" : ""}`}
            />

            <span className={`absolute top-1 right-1 z-20 w-2.5 h-2.5 rounded-full border-2 border-background pointer-events-none ${dotClass}`}>
              {dotState === "running" && <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-30" />}
            </span>

            {game.pinned && (
              <Icon name="pin" size={16} className="absolute top-1 left-1 z-10 text-foreground dark:text-white/85" />
            )}
          </div>

          <div className="game-card-info p-2">
            <div className="text-xs font-medium truncate">{game.name}</div>
            {tags && tags.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="app-glass-badge border text-[9px] px-1 py-0.5 bg-secondary rounded">
                    {tag}
                  </span>
                ))}
                {tags.length > 2 && <span className="text-[9px] text-muted-foreground">+{tags.length - 2}</span>}
              </div>
            )}
          </div>
        </div>
        {cardRevealText && (
          <div className="game-card-reveal text-[0.56em] text-muted-foreground">
            {cardRevealText}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onContextMenu={(e) => onContextMenu?.(e, game)}
      onClick={handleClick}
      style={style}
      className={`group ${coverCardContainerClass(cardStyle, anim)} ${clicked ? "ring-2 ring-primary scale-[0.97]" : ""} ${className || ""}`}
    >
      {overlay}

      <div className={coverCardSurfaceClass(cardStyle)}>
        <div className="game-card-media aspect-[600/900] bg-secondary/30 relative overflow-hidden">
          {game.steam_app_id ? (
            <img
              src={`https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${game.steam_app_id}/library_600x900.jpg`}
              alt={game.name}
              className="game-card-media-image w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).parentElement!.querySelector(".fallback-icon")?.classList.remove("hidden");
              }}
            />
          ) : null}
          <GameIcon
            steamAppId={null}
            name={game.name}
            className={`w-full h-full text-3xl fallback-icon ${game.steam_app_id ? "hidden" : ""}`}
          />

          <span className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full z-10 ${dotClass}`}>
            {dotState === "running" && <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-30" />}
          </span>

          {game.pinned && (
            <Icon name="pin" size={16} className="absolute top-1 left-1 z-10 text-foreground dark:text-white/85" />
          )}
        </div>

        <div className="game-card-info p-2">
          <div className="text-xs font-medium truncate">{game.name}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{subtitleText}</div>
          {tags && tags.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {tags.slice(0, 2).map((tag) => (
                <span key={tag} className="app-glass-badge border text-[9px] px-1 py-0.5 bg-secondary rounded">
                  {tag}
                </span>
              ))}
              {tags.length > 2 && <span className="text-[9px] text-muted-foreground">+{tags.length - 2}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
