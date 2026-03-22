use std::path::PathBuf;

use futures_util::StreamExt;
use reqwest;
use tauri::Emitter;

const HUGGINGFACE_BASE_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

/// Manages Whisper GGML model files: download, cache, and lookup.
pub struct ModelManager {
    models_dir: PathBuf,
}

impl ModelManager {
    pub fn new() -> Self {
        let models_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("OratioText")
            .join("models");

        // Ensure directory exists
        std::fs::create_dir_all(&models_dir).ok();

        Self { models_dir }
    }

    /// Returns the filename for a given model name.
    /// Maps display names to actual HuggingFace filenames.
    fn model_filename(model_name: &str) -> String {
        let ggml_name = match model_name {
            "large" => "large-v3",
            "turbo" => "large-v3-turbo",
            other => other,
        };
        format!("ggml-{}.bin", ggml_name)
    }

    /// Returns the full path where a model would be stored.
    pub fn get_model_path(&self, model_name: &str) -> Option<PathBuf> {
        let path = self.models_dir.join(Self::model_filename(model_name));
        if path.exists() {
            Some(path)
        } else {
            None
        }
    }

    /// Checks if a model is already downloaded.
    pub fn is_model_downloaded(&self, model_name: &str) -> bool {
        self.models_dir
            .join(Self::model_filename(model_name))
            .exists()
    }

    /// Downloads a model from Hugging Face, emitting progress events to the frontend.
    pub async fn download_model(
        &self,
        model_name: &str,
        app: &tauri::AppHandle,
    ) -> Result<PathBuf, Box<dyn std::error::Error + Send + Sync>> {
        let filename = Self::model_filename(model_name);
        let dest_path = self.models_dir.join(&filename);

        // If already downloaded, return early
        if dest_path.exists() {
            return Ok(dest_path);
        }

        let url = format!("{}/{}", HUGGINGFACE_BASE_URL, filename);

        let response = reqwest::get(&url).await?;

        if !response.status().is_success() {
            return Err(format!(
                "Failed to download model '{}': HTTP {}",
                model_name,
                response.status()
            )
            .into());
        }

        let total_bytes = response.content_length().unwrap_or(0);
        let mut downloaded_bytes: u64 = 0;

        // Write to a temporary file first, then rename
        let tmp_path = dest_path.with_extension("bin.tmp");
        let mut file = tokio::fs::File::create(&tmp_path).await?;
        let mut stream = response.bytes_stream();

        use tokio::io::AsyncWriteExt;

        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            file.write_all(&chunk).await?;
            downloaded_bytes += chunk.len() as u64;

            let percent = if total_bytes > 0 {
                (downloaded_bytes as f64 / total_bytes as f64) * 100.0
            } else {
                0.0
            };

            // Emit progress event to frontend
            let _ = app.emit(
                "download-progress",
                serde_json::json!({
                    "model": model_name,
                    "downloadedBytes": downloaded_bytes,
                    "totalBytes": total_bytes,
                    "percent": percent,
                }),
            );
        }

        file.flush().await?;
        drop(file);

        // Rename temp file to final path
        tokio::fs::rename(&tmp_path, &dest_path).await?;

        Ok(dest_path)
    }
}
