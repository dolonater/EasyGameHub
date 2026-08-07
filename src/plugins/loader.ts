import { convertFileSrc } from "@tauri-apps/api/core";
import {
  apiVersion,
  createPluginSdk,
  clearPluginRegistrations,
  runPluginDispose,
  clearPluginDispose,
} from "./sdk";
import { removePluginListeners } from "./events";
import { getPluginRegistry, savePluginRegistry } from "./registry";
import type { PluginRecord } from "./types";

export const MAX_API_VERSION = apiVersion;

export interface LoadedPlugin {
  record: PluginRecord;
  module: Record<string, unknown>;
  apiVersion: number;
}

const loaded = new Map<string, LoadedPlugin>();
const loading = new Set<string>();

export function getLoadedPlugins(): LoadedPlugin[] {
  return Array.from(loaded.values());
}

export function isPluginLoaded(id: string): boolean {
  return loaded.has(id);
}

export function isPluginLoading(id: string): boolean {
  return loading.has(id);
}

/// Wrap an async call so plugin failures are contained and recorded.
async function safe<T>(id: string, label: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    await reportError(id, e);
    console.error(`[plugin:${id}] ${label} failed:`, e);
    return undefined;
  }
}

/// Record an error on the plugin record; auto-disable after 3 consecutive.
export async function reportError(id: string, error: unknown): Promise<void> {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const dto = await getPluginRegistry();
    const record = dto.plugins.find((p) => p.id === id);
    if (!record) return;
    record.last_error = message;
    record.error_count += 1;
    if (record.error_count >= 3) record.enabled = false;
    await savePluginRegistry({ plugins: dto.plugins });
  } catch (e) {
    console.error(`[plugin:${id}] failed to report error:`, e);
  }
}

export async function clearError(id: string): Promise<void> {
  const dto = await getPluginRegistry();
  const record = dto.plugins.find((p) => p.id === id);
  if (!record) return;
  record.last_error = null;
  record.error_count = 0;
  await savePluginRegistry({ plugins: dto.plugins });
}

/// Load (or reload) a plugin: dynamic-import its bundle and call setup(sdk).
export async function loadPlugin(record: PluginRecord, pluginsDir: string): Promise<LoadedPlugin | null> {
  if (loading.has(record.id)) return null;
  loading.add(record.id);
  try {
    return await doLoad(record, pluginsDir);
  } finally {
    loading.delete(record.id);
  }
}

async function doLoad(record: PluginRecord, pluginsDir: string): Promise<LoadedPlugin | null> {
  clearPluginRegistrations(record.id);
  clearPluginDispose(record.id);

  if (record.api_version > MAX_API_VERSION) {
    await reportError(record.id, `api_version ${record.api_version} > supported ${MAX_API_VERSION}`);
    return null;
  }

  const entryPath = `${pluginsDir.replace(/\\/g, "/")}/${record.id}/${record.entry}`;
  const sdk = createPluginSdk(record.id, record.permissions);

  const result = await safe(record.id, "load", async () => {
    const module = (await import(/* @vite-ignore */ convertFileSrc(entryPath))) as Record<string, unknown>;
    const setup = typeof module.setup === "function" ? (module.setup as (sdk: unknown) => unknown) : null;
    if (setup) {
      try {
        await setup(sdk);
      } catch (e) {
        await reportError(record.id, e);
        console.error(`[plugin:${record.id}] setup failed:`, e);
      }
    }
    return module;
  });

  if (!result) return null;

  const loadedPlugin: LoadedPlugin = {
    record: { ...record, last_error: null, error_count: 0 },
    module: result,
    apiVersion: record.api_version,
  };
  loaded.set(record.id, loadedPlugin);
  return loadedPlugin;
}

/// Unload a plugin: run plugin cleanup, then drop registrations/listeners/memory.
export async function unloadPlugin(id: string): Promise<void> {
  const plugin = loaded.get(id);
  try {
    const disposeErrors = await runPluginDispose(id);
    for (const error of disposeErrors) {
      await reportError(id, error);
      console.error(`[plugin:${id}] dispose failed:`, error);
    }

    const teardown = plugin?.module.teardown;
    if (typeof teardown === "function") {
      try {
        await (teardown as () => unknown)();
      } catch (e) {
        await reportError(id, e);
        console.error(`[plugin:${id}] teardown failed:`, e);
      }
    }
  } finally {
    clearPluginDispose(id);
    clearPluginRegistrations(id);
    removePluginListeners(id);
    loaded.delete(id);
  }
}
