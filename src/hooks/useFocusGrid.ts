import { useState, useEffect, useCallback, useRef } from "react";

interface FocusGridOptions {
  itemCount: number;
  columns: number;
  /** Whether the top toolbar is also focusable (adds 1 virtual slot) */
  hasToolbar?: boolean;
}

export interface FocusGrid {
  focusIndex: number;
  setFocusIndex: (i: number) => void;
  focusedItem: number | null;
  columns: number;
  navigate: (dir: "up" | "down" | "left" | "right") => void;
}

/**
 * 2D grid focus navigation with wrap-around.
 * Arrow keys / D-pad: move focus in 4 directions.
 * Enter: triggers action callback on focused item.
 */
export function useFocusGrid(
  { itemCount, columns, hasToolbar = false }: FocusGridOptions,
  onActivate?: (index: number) => void,
): FocusGrid {
  const [focusIndex, setFocusIndex] = useState(hasToolbar ? -1 : 0);
  const onActivateRef = useRef(onActivate);
  onActivateRef.current = onActivate;

  const rows = Math.ceil(itemCount / columns);

  const navigate = useCallback((dir: "up" | "down" | "left" | "right") => {
    setFocusIndex((prev) => {
      const max = itemCount - 1;
      const min = hasToolbar ? -1 : 0;

      let next = prev;
      if (dir === "right") {
        // Stay in toolbar row if on toolbar
        if (prev === -1) return prev;
        next = prev + 1;
        if (next > max) next = min;
      } else if (dir === "left") {
        if (prev === -1) return prev;
        next = prev - 1;
        if (next < min) next = max;
      } else if (dir === "down") {
        if (prev === -1) { next = 0; }
        else {
          next = prev + columns;
          if (next > max) {
            // If last row incomplete, wrap to exact column of next row start
            const col = prev % columns;
            next = col < itemCount % columns || itemCount % columns === 0 ? col : col - 1;
            if (next < 0) next = 0;
            if (next > max) next = prev; // stay if can't wrap
          }
        }
      } else if (dir === "up") {
        if (prev === -1) return prev; // can't go up from toolbar
        next = prev - columns;
        if (next < 0) {
          if (hasToolbar) { next = -1; }
          else {
            // Wrap to last row, same column
            const col = prev % columns;
            const lastRowStart = rows * columns - columns;
            next = lastRowStart + col;
            if (next > max) next = lastRowStart + (itemCount % columns) - 1;
            if (next >= max) next = max;
          }
        }
      }
      return next;
    });
  }, [itemCount, columns, rows, hasToolbar]);

  // Keyboard navigation
  const focusIndexRef = useRef(focusIndex);
  focusIndexRef.current = focusIndex;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if target is an input (user typing in search box etc.)
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key) {
        case "ArrowUp": e.preventDefault(); navigate("up"); break;
        case "ArrowDown": e.preventDefault(); navigate("down"); break;
        case "ArrowLeft": e.preventDefault(); navigate("left"); break;
        case "ArrowRight": e.preventDefault(); navigate("right"); break;
        case "Enter":
          if (focusIndexRef.current >= 0) {
            e.preventDefault();
            onActivateRef.current?.(focusIndexRef.current);
          }
          break;
        case "Escape":
          // Esc passes through — handled by page-level handler
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  const focusedItem = focusIndex >= 0 ? focusIndex : null;

  return { focusIndex, setFocusIndex, focusedItem, columns, navigate };
}
