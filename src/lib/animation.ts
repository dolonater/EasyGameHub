import type { CSSProperties } from "react";

/**
 * Staggered entrance animation delay for cards/items.
 * Caps the delay so large lists don't wait too long.
 */
export function staggerStyle(index: number, enabled: boolean, stepMs = 40, maxIndex = 10): CSSProperties | undefined {
  if (!enabled) return undefined;
  return {
    animationDelay: `${Math.min(index, maxIndex) * stepMs}ms`,
  };
}
