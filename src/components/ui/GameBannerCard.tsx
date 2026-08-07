import React from "react";
import { useAnimation } from "../../hooks/useAnimation";
import GlassCard from "./GlassCard";

export interface GameBannerCardProps {
  appId: number | null;
  name: string;
  subtitle?: string;
  playtimeMinutes?: number;
  badges?: { label: string; color: "green" | "blue" | "gray" }[];
  actionLabel?: string;
  onAction?: () => void;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  rightContent?: React.ReactNode;
}

function formatPlaytime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m > 0 ? `${m}m` : ""}`;
}

const badgeColors: Record<string, string> = {
  green: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300",
  blue: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
  gray: "bg-muted-foreground/10 text-muted-foreground",
};

export default function GameBannerCard({
  appId, name, subtitle, playtimeMinutes, badges, actionLabel, onAction,
  onClick, onContextMenu, rightContent,
}: GameBannerCardProps) {
  const anim = useAnimation();
  return (
    <GlassCard
      onContextMenu={(e) => onContextMenu?.(e)}
      onClick={onClick}
      className={`rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all ${anim ? "hover:-translate-y-1 hover:shadow-lg" : ""}`}
    >
      <div className="w-full aspect-[460/215] bg-secondary/20 relative overflow-hidden">
        {appId ? (
          <img
            src={`https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/capsule_616x353.jpg`;
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-muted-foreground/30 font-bold">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate flex items-center gap-2">
            {name}
            {badges?.map((b, i) => (
              <span key={i} className={`app-glass-badge border text-[10px] px-1.5 py-0.5 rounded font-medium ${badgeColors[b.color]}`}>
                {b.label}
              </span>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {subtitle}
            {playtimeMinutes != null && playtimeMinutes > 0 && (
              <span className="ml-2">{formatPlaytime(playtimeMinutes)}</span>
            )}
          </div>
        </div>

        {rightContent}

        {actionLabel && (
          <button
            onClick={(e) => { e.stopPropagation(); onAction?.(); }}
            className="app-surface app-glass-button px-3 py-1 text-xs border !rounded-lg hover:bg-secondary flex-shrink-0"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </GlassCard>
  );
}
