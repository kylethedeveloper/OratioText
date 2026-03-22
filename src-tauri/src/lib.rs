mod model_manager;
mod transcriber;

use model_manager::ModelManager;
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, State};
use transcriber::Transcriber;

struct AppState {
    model_manager: ModelManager,
    transcriber: Arc<Mutex<Transcriber>>,
    cancel_flag: Arc<AtomicBool>,
}

#[derive(Serialize)]
struct SystemInfo {
    os: String,
    arch: String,
    total_memory_gb: f64,
}

#[derive(Serialize)]
struct TranscriptionResult {
    text: String,
    segments: Vec<Segment>,
    language: String,
}

#[derive(Serialize)]
struct Segment {
    start: f64,
    end: f64,
    text: String,
}

#[derive(Serialize)]
struct ModelInfo {
    name: String,
    size: String,
    downloaded: bool,
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    use sysinfo::System;
    let sys = System::new_all();
    let total_memory_gb = sys.total_memory() as f64 / (1024.0 * 1024.0 * 1024.0);

    SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        total_memory_gb,
    }
}

#[tauri::command]
fn list_models(state: State<AppState>) -> Vec<ModelInfo> {
    let models = vec![
        ("tiny", "~75 MB"),
        ("base", "~142 MB"),
        ("small", "~466 MB"),
        ("medium", "~1.5 GB"),
        ("turbo", "~1.6 GB"),
        ("large", "~2.9 GB"),
    ];

    models
        .into_iter()
        .map(|(name, size)| ModelInfo {
            name: name.to_string(),
            size: size.to_string(),
            downloaded: state.model_manager.is_model_downloaded(name),
        })
        .collect()
}

#[tauri::command]
async fn download_model(
    model_name: String,
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    state
        .model_manager
        .download_model(&model_name, &app)
        .await
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn transcribe(
    file_path: String,
    model_name: String,
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<TranscriptionResult, String> {
    let model_path = state
        .model_manager
        .get_model_path(&model_name)
        .ok_or_else(|| format!("Model '{}' is not downloaded", model_name))?;

    let transcriber = state.transcriber.clone();
    let cancel_flag = state.cancel_flag.clone();
    let app_handle = app.clone();

    // Reset cancel flag
    cancel_flag.store(false, Ordering::SeqCst);

    // Emit initial progress
    let _ = app.emit(
        "transcription-progress",
        serde_json::json!({ "stage": "Loading model...", "percent": 0 }),
    );

    // Run CPU-heavy work on a blocking thread so the UI stays responsive
    let result = tokio::task::spawn_blocking(move || {
        let mut t = transcriber.lock().map_err(|e| e.to_string())?;

        t.load_model(&model_path).map_err(|e| e.to_string())?;

        let app_for_callback = app_handle.clone();
        let cancel_for_callback = cancel_flag.clone();
        let result = t
            .transcribe_with_progress(
                &file_path,
                move |stage, percent| {
                    let _ = app_for_callback.emit(
                        "transcription-progress",
                        serde_json::json!({ "stage": stage, "percent": percent }),
                    );
                },
                cancel_for_callback,
            )
            .map_err(|e| e.to_string())?;

        Ok::<_, String>(result)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))??;

    Ok(TranscriptionResult {
        text: result.text,
        segments: result
            .segments
            .into_iter()
            .map(|s| Segment {
                start: s.start,
                end: s.end,
                text: s.text,
            })
            .collect(),
        language: result.language,
    })
}

#[tauri::command]
fn stop_transcription(state: State<AppState>) {
    state.cancel_flag.store(true, Ordering::SeqCst);
}

#[tauri::command]
fn save_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| format!("Failed to save file: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            model_manager: ModelManager::new(),
            transcriber: Arc::new(Mutex::new(Transcriber::new())),
            cancel_flag: Arc::new(AtomicBool::new(false)),
        })
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            list_models,
            download_model,
            transcribe,
            stop_transcription,
            save_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
