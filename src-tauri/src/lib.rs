// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use base64::{engine::general_purpose, Engine as _};
use std::fs;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    fs::write(path, contents).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_png_file(path: String, data_url: String) -> Result<(), String> {
    let contents_base64 = data_url
        .strip_prefix("data:image/png;base64,")
        .ok_or_else(|| "图片编码不是 PNG data URL".to_string())?;
    let contents = general_purpose::STANDARD
        .decode(contents_base64)
        .map_err(|error| error.to_string())?;
    if !contents.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Err("图片数据不是有效 PNG".to_string());
    }
    fs::write(path, contents).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            read_text_file,
            write_text_file,
            write_png_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
