import { invoke } from "@tauri-apps/api/core";

let listeners: Array<(v: boolean) => void> = [];
let _fullscreen = false;

export function isFullscreen(): boolean {
  return _fullscreen;
}

export async function toggleFullscreen(): Promise<boolean> {
  _fullscreen = !_fullscreen;
  await invoke("toggle_fullscreen", { fullscreen: _fullscreen });
  listeners.forEach((cb) => cb(_fullscreen));
  return _fullscreen;
}

export function onFullscreenChange(cb: (v: boolean) => void) {
  listeners.push(cb);
  return () => { listeners = listeners.filter((l) => l !== cb); };
}
