import { listen } from "@tauri-apps/api/event";

type EventHandler = (payload: unknown) => void;

const handlers = new Map<string, Set<EventHandler>>();
const pluginBindings = new Map<string, { event: string; handler: EventHandler }[]>();

/// Rust-emitted events forwarded to the same bus as local events.
const TAURI_EVENTS = ["backup:started", "backup:completed", "backup:failed"];

let tauriWired = false;

function wireTauriEvents() {
  if (tauriWired) return;
  tauriWired = true;
  for (const name of TAURI_EVENTS) {
    listen(name, (event) => emit(name, event.payload)).catch((e) => {
      console.error(`[plugins:events] failed to listen ${name}:`, e);
    });
  }
}

export function emit(event: string, payload?: unknown): void {
  const set = handlers.get(event);
  if (!set) return;
  for (const handler of Array.from(set)) {
    try {
      handler(payload);
    } catch (e) {
      console.error(`[plugins:events] handler for "${event}" threw:`, e);
    }
  }
}

export function on(event: string, handler: EventHandler): void {
  let set = handlers.get(event);
  if (!set) {
    set = new Set();
    handlers.set(event, set);
  }
  set.add(handler);
}

export function off(event: string, handler: EventHandler): void {
  handlers.get(event)?.delete(handler);
}

/// Register a handler on behalf of a plugin so it can be removed on unload.
export function onForPlugin(pluginId: string, event: string, handler: EventHandler): void {
  on(event, handler);
  let list = pluginBindings.get(pluginId);
  if (!list) {
    list = [];
    pluginBindings.set(pluginId, list);
  }
  list.push({ event, handler });
  wireTauriEvents();
}

/// Remove every handler registered by a plugin (called on unload).
export function removePluginListeners(pluginId: string): void {
  const list = pluginBindings.get(pluginId);
  if (!list) return;
  for (const { event, handler } of list) off(event, handler);
  pluginBindings.delete(pluginId);
}
