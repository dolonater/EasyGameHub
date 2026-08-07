use crate::core::themes::{self, ThemesData};
use crate::AppState;

#[tauri::command]
pub fn get_themes_data(state: tauri::State<'_, AppState>) -> Result<ThemesData, String> {
    themes::load_themes(&state.themes_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_themes_data(state: tauri::State<'_, AppState>, data: ThemesData) -> Result<(), String> {
    themes::save_themes(&state.themes_path, &data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reset_preset_themes(state: tauri::State<'_, AppState>) -> Result<ThemesData, String> {
    let mut data = themes::load_themes(&state.themes_path).map_err(|e| e.to_string())?;
    themes::reset_presets(&mut data);
    themes::save_themes(&state.themes_path, &data).map_err(|e| e.to_string())?;
    Ok(data)
}

/// Read a theme export file from disk and return its raw JSON content.
/// The frontend handles JSON parsing and format detection.
#[tauri::command]
pub fn read_theme_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

/// Write theme JSON content to a file on disk (for export).
#[tauri::command]
pub fn write_theme_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| format!("Failed to write file: {}", e))
}
