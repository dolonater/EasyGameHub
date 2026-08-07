import { glassCardBaseClass } from "../components/ui/glassClasses";
import { useAppData } from "../hooks/useAppData";
import type { Config } from "./types";

// ── Hook ──────────────────────────────────────────────────────────

/** Reads the current `cover_card_style` value from shared app config state. */
export function useCoverCardStyle() {
  const { config } = useAppData();
  return config?.cover_card_style === "card1" ? "card1" : "default";
}

// ── Class-name helpers ────────────────────────────────────────────

/**
 * Returns the outer container className for a cover-card element.
 *
 * Used by GameCard component and the Inventory grid view so that
 * card-style class logic is not duplicated across pages.
 */
export function coverCardContainerClass(
  cardStyle: Config["cover_card_style"],
  anim: boolean,
): string {
  const base =
    `game-cover-card border rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all duration-300 ease-out relative ${glassCardBaseClass}`;
  const card1Base =
    "game-cover-card game-card-style-card1 rounded-[var(--radius)] cursor-pointer relative";
  if (cardStyle === "card1") {
    return `${card1Base} ${anim ? "is-animated" : ""}`;
  }
  return `${base} ${anim ? "hover:-translate-y-1 hover:shadow-lg" : ""}`;
}

/**
 * Returns the surface-wrapper className for a cover card.
 *
 * The "surface" is the inner `<div>` that contains the cover image and
 * info bar.  In card1 style it needs an explicit `bg-card` so the
 * reveal text layer draws correctly.
 */
export function coverCardSurfaceClass(
  cardStyle: Config["cover_card_style"],
): string {
  return cardStyle === "card1" ? "game-card-surface bg-card" : "game-card-surface";
}
