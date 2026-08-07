use crate::core::view_settings::{self, ViewSettingsData};
use crate::AppState;

#[tauri::command]
pub fn get_view_settings_data(
    state: tauri::State<'_, AppState>,
) -> Result<ViewSettingsData, String> {
    view_settings::load_view_settings(&state.view_settings_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_view_settings_data(
    state: tauri::State<'_, AppState>,
    data: ViewSettingsData,
) -> Result<(), String> {
    view_settings::save_view_settings(&state.view_settings_path, &data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reset_builtin_view_settings_presets(
    state: tauri::State<'_, AppState>,
) -> Result<ViewSettingsData, String> {
    let mut data =
        view_settings::load_view_settings(&state.view_settings_path).map_err(|e| e.to_string())?;
    view_settings::reset_builtin_view_presets(&mut data);
    view_settings::save_view_settings(&state.view_settings_path, &data)
        .map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub fn read_view_settings_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub fn write_view_settings_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| format!("Failed to write file: {}", e))
}
