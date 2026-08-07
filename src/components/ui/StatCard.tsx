import React from "react";
import { useCountUp } from "../../hooks/useCountUp";
import GlassCard from "./GlassCard";

interface StatCardProps {
  label: string;
  value: number;
  format?: (v: number) => string;
  accentColor?: string;
  animated?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

const COLOR_MAP: Record<string, string> = {
  primary: "from-primary to-primary/20",
  accent: "from-blue-500 to-blue-500/20",
  emerald: "from-emerald-500 to-emerald-500/20",
  amber: "from-amber-500 to-amber-500/20",
};

/**
 * Stat card with gradient top accent bar, shadow, and hover lift.
 * Uses useCountUp for animated number display.
 */
export default function StatCard({
  label,
  value,
  format = String,
  accentColor = "primary",
  animated = false,
  style,
  className = "",
}: StatCardProps) {
  const animatedValue = useCountUp(animated ? value : value, animated ? 800 : 0);
  const display = animated ? format(animatedValue) : format(value);
  const gradient = COLOR_MAP[accentColor] || COLOR_MAP.primary;

  return (
    <GlassCard
      bordered={false}
      className={`rounded-lg shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-200 overflow-hidden ${className}`.trim()}
      style={style}
    >
      <div className={`h-1 bg-gradient-to-r ${gradient}`} />
      <div className="p-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-1 tabular-nums">{display}</div>
      </div>
    </GlassCard>
  );
}
