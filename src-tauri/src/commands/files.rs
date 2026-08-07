use base64::Engine;

#[tauri::command]
pub fn write_binary_file(path: String, data_base64: String) -> Result<(), String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64)
        .map_err(|e| format!("Base64 decode: {}", e))?;
    std::fs::write(&path, bytes).map_err(|e| format!("Failed to write file: {}", e))
}
