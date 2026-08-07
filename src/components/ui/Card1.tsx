import type { HTMLAttributes, ReactNode } from "react";
import GlassCard from "./GlassCard";

export interface Card1Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  overlay?: ReactNode;
  revealText?: ReactNode;
  animated?: boolean;
}

export default function Card1({
  children,
  overlay,
  revealText,
  animated = false,
  className = "",
  ...props
}: Card1Props) {
  return (
    <GlassCard
      bordered={false}
      {...props}
      className={[
        "game-cover-card game-card-style-card1 rounded-[var(--radius)] group cursor-pointer relative",
        animated ? "is-animated animate-rise-in" : "",
        className,
      ].join(" ").trim()}
    >
      {overlay}
      <div className="game-card-surface">
        {children}
      </div>
      {revealText != null && (
        <div className="game-card-reveal text-[0.56em] text-muted-foreground">
          {revealText}
        </div>
      )}
    </GlassCard>
  );
}
