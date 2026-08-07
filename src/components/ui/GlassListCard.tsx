import type { HTMLAttributes, ReactNode } from "react";
import GlassCard from "./GlassCard";

interface GlassListCardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  bordered?: boolean;
}

export default function GlassListCard({
  className = "",
  children,
  bordered = true,
  ...props
}: GlassListCardProps) {
  return (
    <GlassCard
      bordered={bordered}
      className={`rounded-lg overflow-hidden cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all ${className}`.trim()}
      {...props}
    >
      {children}
    </GlassCard>
  );
}
