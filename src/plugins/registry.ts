import { invoke } from "@tauri-apps/api/core";
import type { PluginManifest, PluginRecord, PluginRegistry, PluginRegistryDto } from "./types";

export function installPlugin(path: string): Promise<PluginManifest> {
  return invoke<PluginManifest>("install_plugin", { path });
}

export function uninstallPlugin(id: string): Promise<void> {
  return invoke("uninstall_plugin", { id });
}

export function getPluginRegistry(): Promise<PluginRegistryDto> {
  return invoke<PluginRegistryDto>("get_plugin_registry");
}

export function savePluginRegistry(registry: PluginRegistry): Promise<void> {
  return invoke("save_plugin_registry", { registry });
}

export function readPluginConfig(id: string): Promise<unknown | null> {
  return invoke<unknown | null>("read_plugin_config", { id });
}

export function writePluginConfig(id: string, data: unknown): Promise<void> {
  return invoke("write_plugin_config", { id, data });
}

export function upsertPluginRecord(registry: PluginRegistry, record: PluginRecord): PluginRegistry {
  const index = registry.plugins.findIndex((p) => p.id === record.id);
  const plugins = [...registry.plugins];
  if (index >= 0) plugins[index] = record;
  else plugins.push(record);
  return { plugins };
}
