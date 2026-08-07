use serde::Serialize;
use std::path::Path;

use crate::AppState;

/// Registry view returned to the frontend — includes the absolute plugins
/// dir so the frontend can build asset-protocol URLs for bundles.
#[derive(Debug, Clone, Serialize)]
pub struct PluginRegistryDto {
    pub plugins_dir: String,
    pub plugins: Vec<crate::core::plugins::PluginRecord>,
}

/// Install (or update, same id overwrites) a plugin from a zip file path.
#[tauri::command]
pub fn install_plugin(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<crate::core::plugins::PluginManifest, String> {
    let manifest = crate::core::plugins::extract_plugin_zip(Path::new(&path), &state.plugins_dir)
        .map_err(|e| e.to_string())?;

    let mut registry = crate::core::plugins::load_registry(&state.plugins_registry_path)
        .map_err(|e| e.to_string())?;

    let record = crate::core::plugins::PluginRecord::from_manifest(&manifest);
    if let Some(existing) = registry.plugins.iter_mut().find(|p| p.id == manifest.id) {
        *existing = record;
    } else {
        registry.plugins.push(record);
    }
    crate::core::plugins::save_registry(&state.plugins_registry_path, &registry)
        .map_err(|e| e.to_string())?;

    Ok(manifest)
}

/// Remove a plugin: drop the registry entry and delete its folder.
#[tauri::command]
pub fn uninstall_plugin(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    let mut registry = crate::core::plugins::load_registry(&state.plugins_registry_path)
        .map_err(|e| e.to_string())?;
    registry.plugins.retain(|p| p.id != id);
    crate::core::plugins::save_registry(&state.plugins_registry_path, &registry)
        .map_err(|e| e.to_string())?;
    crate::core::plugins::remove_plugin_dir(&state.plugins_dir, &id).map_err(|e| e.to_string())?;
    Ok(())
}

/// Read the full plugin registry plus the plugins dir.
#[tauri::command]
pub fn get_plugin_registry(state: tauri::State<'_, AppState>) -> Result<PluginRegistryDto, String> {
    let registry = crate::core::plugins::load_registry(&state.plugins_registry_path)
        .map_err(|e| e.to_string())?;
    Ok(PluginRegistryDto {
        plugins_dir: state.plugins_dir.to_string_lossy().to_string(),
        plugins: registry.plugins,
    })
}

/// Persist a full registry (used for enable/disable toggles and error reporting).
#[tauri::command]
pub fn save_plugin_registry(
    state: tauri::State<'_, AppState>,
    registry: crate::core::plugins::PluginRegistry,
) -> Result<(), String> {
    crate::core::plugins::save_registry(&state.plugins_registry_path, &registry)
        .map_err(|e| e.to_string())
}

/// Read a plugin's private config (plugins/<id>/config.json).
#[tauri::command]
pub fn read_plugin_config(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<serde_json::Value>, String> {
    let registry = crate::core::plugins::load_registry(&state.plugins_registry_path)
        .map_err(|e| e.to_string())?;
    if !registry.plugins.iter().any(|p| p.id == id) {
        return Err(format!("Plugin not installed: {}", id));
    }
    let path = state.plugins_dir.join(&id).join("config.json");
    if !path.exists() {
        return Ok(None);
    }
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let value = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(Some(value))
}

/// Write a plugin's private config (plugins/<id>/config.json).
#[tauri::command]
pub fn write_plugin_config(
    state: tauri::State<'_, AppState>,
    id: String,
    data: serde_json::Value,
) -> Result<(), String> {
    let registry = crate::core::plugins::load_registry(&state.plugins_registry_path)
        .map_err(|e| e.to_string())?;
    if !registry.plugins.iter().any(|p| p.id == id) {
        return Err(format!("Plugin not installed: {}", id));
    }
    let dir = state.plugins_dir.join(&id);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let content = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    std::fs::write(dir.join("config.json"), content).map_err(|e| e.to_string())?;
    Ok(())
}
