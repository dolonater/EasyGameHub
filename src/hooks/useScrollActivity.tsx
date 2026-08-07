import { useEffect } from "react";

/**
 * Global scroll activity tracker.
 * Any element with .app-scrollbar or .sidebar-scrollbar will receive
 * .is-scrolling while the user is actively scrolling it, then the class
 * is removed shortly after scrolling stops.
 */
export function ScrollActivityProvider() {
  useEffect(() => {
    const timers = new WeakMap<Element, number>();
    const activeTimeouts = new Set<number>();

    const markScrolling = (el: Element | null) => {
      if (!el) return;
      const target = el.closest(".app-scrollbar, .sidebar-scrollbar");
      if (!target) return;

      target.classList.add("is-scrolling");
      const prev = timers.get(target);
      if (prev) {
        window.clearTimeout(prev);
        activeTimeouts.delete(prev);
      }
      const id = window.setTimeout(() => {
        target.classList.remove("is-scrolling");
        timers.delete(target);
        activeTimeouts.delete(id);
      }, 800);
      timers.set(target, id);
      activeTimeouts.add(id);
    };

    const onScroll = (e: Event) => markScrolling(e.target as Element | null);
    const onWheel = (e: WheelEvent) => markScrolling(e.target as Element | null);
    const onTouchMove = (e: TouchEvent) => markScrolling(e.target as Element | null);

    document.addEventListener("scroll", onScroll, true);
    document.addEventListener("wheel", onWheel, { passive: true, capture: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true, capture: true });

    return () => {
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("wheel", onWheel, true);
      document.removeEventListener("touchmove", onTouchMove, true);
      activeTimeouts.forEach((id) => window.clearTimeout(id));
      activeTimeouts.clear();
    };
  }, []);

  return null;
}
