import React from "react";
import GlassCard from "./GlassCard";

interface AccountCardProps {
  avatarUrl?: string | null;
  personaName: string;
  accountName: string;
  isActive?: boolean;
  activeLabel?: string;
  /** Content revealed on hover (e.g. Switch button, social links) */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Account/profile card based on animotion staem账号卡片/style1.tsx.
 * 190×254px portrait card — avatar, name, subtitle.
 * Hover: shadow lifts, info slides up, hidden action area slides in, avatar scales up.
 * Light/dark adaptive.
 */
export default function AccountCard({
  avatarUrl,
  personaName,
  accountName,
  isActive = false,
  activeLabel,
  action,
  className = "",
}: AccountCardProps) {
  return (
    <GlassCard
      bordered={false}
      className={[
        "group relative w-[144px] h-[203px] rounded-lg px-4 py-6",
        "transition-[box-shadow,transform] duration-[0.3s,0.2s] ease-[ease,ease]",
        "hover:shadow-[0_8px_50px_#23232333] dark:hover:shadow-[0_8px_30px_rgba(255,255,255,0.35)]",
        className,
      ].join(" ")}
    >
      {/* Info section — slides up on hover */}
      <div
        className={[
          "flex flex-col justify-center items-center",
          "transition-[transform,opacity] duration-200 ease",
          "group-hover:-translate-y-[5%]",
        ].join(" ")}
      >
        {/* Avatar */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="w-[48px] h-[48px] rounded-full mb-3 transition-transform duration-200 ease group-hover:scale-110 object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement | null;
              if (fallback) fallback.classList.remove("hidden");
            }}
          />
        ) : null}
        <div
          className={[
            "w-[48px] h-[48px] rounded-full mb-3 transition-transform duration-200 ease group-hover:scale-110",
            "bg-gradient-to-t from-[#f1e1c1] to-[#fcbc97] dark:from-[#4a3728] dark:to-[#6b4c3b]",
            "flex items-center justify-center text-white font-bold text-base",
            avatarUrl ? "hidden" : "",
          ].join(" ")}
        >
          {(personaName || accountName || "?").charAt(0).toUpperCase()}
        </div>

        {/* Name */}
        <h2 className="text-[0.918em] font-semibold text-foreground leading-5 text-center truncate max-w-full">
          {personaName || accountName}
        </h2>

        {/* Subtitle */}
        <p className="text-[0.8em] text-muted-foreground text-center truncate max-w-full mt-1">
          {accountName}
        </p>

        {isActive && activeLabel && (
          <span className="app-glass-badge mt-1 inline-flex items-center justify-center rounded-full border border-primary/20 bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary text-center shadow-sm backdrop-blur-sm">
            {activeLabel}
          </span>
        )}

      </div>

      {/* Action area — hidden below, slides up on hover */}
      <div
        className={[
          "absolute bottom-4 left-0 right-0 flex justify-center",
          "translate-y-[200%] opacity-0",
          "transition-[transform,opacity] duration-200 ease",
          "group-hover:translate-y-0 group-hover:opacity-100",
        ].join(" ")}
      >
        {action}
      </div>
    </GlassCard>
  );
}
