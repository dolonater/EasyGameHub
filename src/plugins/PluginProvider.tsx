import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { installPlugin, getPluginRegistry, savePluginRegistry, uninstallPlugin } from "./registry";
import { loadPlugin, unloadPlugin, isPluginLoaded, clearError } from "./loader";
import { registeredPages, registeredSettingsSections } from "./sdk";
import type { RegisteredPage, RegisteredSettingsSection } from "./sdk";
import type { PluginRecord } from "./types";
import { showToast } from "../lib/toast";

interface PluginContextValue {
  records: PluginRecord[];
  pluginsDir: string;
  pages: RegisteredPage[];
  settingsSections: RegisteredSettingsSection[];
  refresh: () => Promise<void>;
  setEnabled: (id: string, enabled: boolean) => Promise<void>;
  reload: (id: string) => Promise<void>;
  install: () => Promise<void>;
  uninstall: (id: string) => Promise<void>;
}

const PluginContext = createContext<PluginContextValue | null>(null);

export function usePlugins(): PluginContextValue {
  const ctx = useContext(PluginContext);
  if (!ctx) throw new Error("usePlugins must be used within PluginProvider");
  return ctx;
}

export function PluginProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<PluginRecord[]>([]);
  const [pluginsDir, setPluginsDir] = useState("");
  const [version, setVersion] = useState(0);
  const recordsRef = useRef<PluginRecord[]>([]);
  const pluginsDirRef = useRef("");

  useEffect(() => {
    recordsRef.current = records;
  }, [records]);
  useEffect(() => {
    pluginsDirRef.current = pluginsDir;
  }, [pluginsDir]);

  const refresh = useCallback(async () => {
    try {
      const dto = await getPluginRegistry();
      recordsRef.current = dto.plugins;
      pluginsDirRef.current = dto.plugins_dir;
      setRecords(dto.plugins);
      setPluginsDir(dto.plugins_dir);
    } catch (e) {
      console.error("Failed to load plugin registry:", e);
    }
  }, []);

  // Load enabled plugins on startup and after any registry refresh.
  useEffect(() => {
    (async () => {
      await refresh();
    })();
  }, [refresh]);

  useEffect(() => {
    (async () => {
      const dir = pluginsDirRef.current;
      if (!dir) return;
      for (const record of recordsRef.current) {
        if (record.enabled && !isPluginLoaded(record.id)) {
          await loadPlugin(record, dir);
        }
      }
      setVersion((v) => v + 1);
    })();
  }, [records, pluginsDir]);

  const setEnabled = useCallback(async (id: string, enabled: boolean) => {
    const record = recordsRef.current.find((p) => p.id === id);
    if (!record) return;
    record.enabled = enabled;
    await savePluginRegistry({ plugins: recordsRef.current });
    if (enabled) {
      await loadPlugin(record, pluginsDirRef.current);
    } else {
      await unloadPlugin(id);
    }
    await refresh();
    setVersion((v) => v + 1);
  }, [refresh]);

  const reload = useCallback(async (id: string) => {
    await unloadPlugin(id);
    const record = recordsRef.current.find((p) => p.id === id);
    if (!record || !record.enabled) {
      setVersion((v) => v + 1);
      return;
    }
    await clearError(id);
    const loaded = await loadPlugin(record, pluginsDirRef.current);
    if (!loaded) showToast("error", `插件 ${record.name} 加载失败`);
    else showToast("success", `插件 ${record.name} 已重载`);
    await refresh();
    setVersion((v) => v + 1);
  }, [refresh]);

  const install = useCallback(async () => {
    const file = await openDialog({
      multiple: false,
      filters: [{ name: "Plugin", extensions: ["zip"] }],
    });
    if (!file) return;
    const path = file as string;
    try {
      const manifest = await installPlugin(path);
      showToast("success", `插件 ${manifest.name} 已安装`);
      await refresh();
      setVersion((v) => v + 1);
    } catch (e) {
      showToast("error", `安装失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [refresh]);

  const uninstall = useCallback(async (id: string) => {
    await unloadPlugin(id);
    try {
      await uninstallPlugin(id);
      await refresh();
      setVersion((v) => v + 1);
    } catch (e) {
      showToast("error", `卸载失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [refresh]);

  const value = useMemo<PluginContextValue>(
    () => ({
      records,
      pluginsDir,
      pages: registeredPages.filter((p) => isPluginLoaded(p.pluginId)),
      settingsSections: registeredSettingsSections.filter((s) => isPluginLoaded(s.pluginId)),
      refresh,
      setEnabled,
      reload,
      install,
      uninstall,
    }),
    [records, pluginsDir, version, refresh, setEnabled, reload, install, uninstall]
  );

  return <PluginContext.Provider value={value}>{children}</PluginContext.Provider>;
}
