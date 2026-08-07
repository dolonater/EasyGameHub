const KEY = "doona-sidebar-icons-only";
const POSITION_KEY = "doona-sidebar-position";
const CHANGE_EVENT = "doona-sidebar-mode-change";

export type SidebarPosition = "left" | "right" | "top" | "bottom";

function dispatchSidebarModeChange() {
  try {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {}
}

function normalizeSidebarPosition(value: unknown): SidebarPosition {
  return value === "right" || value === "top" || value === "bottom" ? value : "left";
}

export function getSidebarIconsOnly(): boolean {
  try { return localStorage.getItem(KEY) === "true"; } catch { return false; }
}

export function setSidebarIconsOnly(v: boolean) {
  try {
    localStorage.setItem(KEY, String(v));
    dispatchSidebarModeChange();
  } catch {}
}

export function getSidebarPosition(): SidebarPosition {
  try {
    return normalizeSidebarPosition(localStorage.getItem(POSITION_KEY));
  } catch {
    return "left";
  }
}

export function setSidebarPosition(position: SidebarPosition) {
  try {
    localStorage.setItem(POSITION_KEY, normalizeSidebarPosition(position));
    dispatchSidebarModeChange();
  } catch {}
}

export function onSidebarChange(cb: () => void) {
  const storageHandler = (e: StorageEvent) => {
    if (e.key === KEY || e.key === POSITION_KEY) cb();
  };
  const eventHandler = () => cb();
  window.addEventListener("storage", storageHandler);
  window.addEventListener(CHANGE_EVENT, eventHandler);
  return () => {
    window.removeEventListener("storage", storageHandler);
    window.removeEventListener(CHANGE_EVENT, eventHandler);
  };
}
