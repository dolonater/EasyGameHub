import { useLayoutEffect, useRef, useState } from "react";

/**
 * Smoothly animates a container's height when its content changes.
 * Best used around keyed view-switch content (list/grid, chart mode, etc.).
 */
export function useAnimatedHeight(trigger: unknown, enabled: boolean) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const prevHeightRef = useRef<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    const to = inner.getBoundingClientRect().height;
    const from = prevHeightRef.current ?? to;
    prevHeightRef.current = to;

    if (!enabled) {
      setHeight(null);
      return;
    }

    if (Math.abs(from - to) < 1) {
      setHeight(null);
      return;
    }

    // Start from previous measured height, then animate to the new one.
    setHeight(from);

    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setHeight(to));
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [trigger, enabled]);

  const onTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== outerRef.current || e.propertyName !== "height") return;
    const inner = innerRef.current;
    if (inner) prevHeightRef.current = inner.getBoundingClientRect().height;
    setHeight(null);
  };

  return {
    outerRef,
    innerRef,
    onTransitionEnd,
    outerStyle: enabled && height != null
      ? { height: `${height}px`, overflow: "hidden" as const }
      : undefined,
    outerClassName: enabled ? "transition-[height] duration-200 ease-out" : "",
  };
}
