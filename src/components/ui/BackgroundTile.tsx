import type { ButtonHTMLAttributes, ReactNode } from "react";
import { GlassTileButton } from "./GlassCard";

interface BackgroundTileProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  preview: ReactNode;
  action?: ReactNode;
  badgeLabel?: ReactNode;
}

function joinClasses(parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function BackgroundTile({
  selected,
  preview,
  action,
  badgeLabel = "使用",
  className = "",
  children,
  ...props
}: BackgroundTileProps) {
  return (
    <div className="flex w-[90px] flex-col items-center gap-1.5">
      <GlassTileButton
        selected={selected}
        className={joinClasses(["group relative overflow-hidden text-left", className])}
        {...props}
      >
        <div className="relative h-16 w-[90px]">{preview}</div>
        <div className="absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/10" />
        {selected && (
          <span className="absolute bottom-1.5 right-1.5 rounded-full bg-primary/90 px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
            {badgeLabel}
          </span>
        )}
        {action}
        {children}
      </GlassTileButton>
    </div>
  );
}
