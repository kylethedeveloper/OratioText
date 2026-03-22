use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

pub struct TranscriptionResult {
    pub text: String,
    pub segments: Vec<TranscriptionSegment>,
    pub language: String,
}

pub struct TranscriptionSegment {
    pub start: f64,
    pub end: f64,
    pub text: String,
}

pub struct Transcriber {
    ctx: Option<WhisperContext>,
    current_model: Option<String>,
}

impl Transcriber {
    pub fn new() -> Self {
        Self {
            ctx: None,
            current_model: None,
        }
    }

    /// Loads a Whisper model from the given path. Skips if already loaded.
    pub fn load_model(&mut self, model_path: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let path_str = model_path.to_string_lossy().to_string();

        // Skip if same model is already loaded
        if self.current_model.as_deref() == Some(&path_str) && self.ctx.is_some() {
            return Ok(());
        }

        let params = WhisperContextParameters::default();
        let ctx = WhisperContext::new_with_params(&path_str, params)
            .map_err(|e| format!("Failed to load Whisper model: {:?}", e))?;

        self.ctx = Some(ctx);
        self.current_model = Some(path_str);
        Ok(())
    }

    /// Transcribes an audio file with a progress callback and cancellation support.
    pub fn transcribe_with_progress<F>(
        &self,
        audio_path: &str,
        on_progress: F,
        cancel_flag: Arc<AtomicBool>,
    ) -> Result<TranscriptionResult, Box<dyn std::error::Error>>
    where
        F: Fn(&str, i32) + Send + Sync + 'static,
    {
        let on_progress = Arc::new(on_progress);
        let ctx = self
            .ctx
            .as_ref()
            .ok_or("No model loaded. Call load_model first.")?;

        // Check cancellation early
        if cancel_flag.load(Ordering::SeqCst) {
            return Err("Transcription cancelled".into());
        }

        // Stage 1: Converting audio
        on_progress("Converting audio...", 5);
        let samples = self.read_audio_file(audio_path)?;

        if cancel_flag.load(Ordering::SeqCst) {
            return Err("Transcription cancelled".into());
        }

        // Stage 2: Transcribing
        on_progress("Transcribing...", 10);

        // Configure whisper parameters
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_language(None);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_translate(false);

        // Set progress callback
        let progress_cb = on_progress.clone();
        params.set_progress_callback_safe(move |progress| {
            let mapped = 10 + (progress as f64 * 0.8) as i32;
            progress_cb("Transcribing...", mapped);
        });

        // Set abort callback bypassing whisper-rs `set_abort_callback_safe`
        // due to a pointer casting bug in version 0.14 of the crate
        let abort_flag = cancel_flag.clone();
        let abort_box: Box<Box<dyn FnMut() -> bool>> = Box::new(Box::new(move || {
            abort_flag.load(Ordering::SeqCst)
        }));
        let abort_ptr = Box::into_raw(abort_box);

        unsafe extern "C" fn abort_trampoline(user_data: *mut std::ffi::c_void) -> bool {
            let closure = &mut *(user_data as *mut Box<dyn FnMut() -> bool>);
            closure()
        }

        unsafe {
            params.set_abort_callback(Some(abort_trampoline));
            params.set_abort_callback_user_data(abort_ptr as *mut std::ffi::c_void);
        }

        // Run transcription
        let mut state = ctx.create_state().map_err(|e| format!("Failed to create state: {:?}", e))?;
        let full_result = state.full(params, &samples);

        // Clean up the abort callback closure to avoid memory leak
        unsafe {
            let _ = Box::from_raw(abort_ptr);
        }

        // Check if cancelled
        if cancel_flag.load(Ordering::SeqCst) {
            return Err("Transcription cancelled".into());
        }

        full_result.map_err(|e| format!("Transcription failed: {:?}", e))?;

        // Stage 3: Processing results
        on_progress("Processing results...", 95);

        // Extract results
        let num_segments = state.full_n_segments().map_err(|e| format!("Failed to get segments: {:?}", e))?;
        let mut segments = Vec::new();
        let mut full_text = String::new();

        for i in 0..num_segments {
            let text = state
                .full_get_segment_text(i)
                .map_err(|e| format!("Failed to get segment text: {:?}", e))?;
            let start = state.full_get_segment_t0(i).map_err(|e| format!("Failed to get segment start: {:?}", e))? as f64 * 0.01;
            let end = state.full_get_segment_t1(i).map_err(|e| format!("Failed to get segment end: {:?}", e))? as f64 * 0.01;

            full_text.push_str(text.trim());
            full_text.push('\n');

            segments.push(TranscriptionSegment {
                start,
                end,
                text: text.trim().to_string(),
            });
        }

        // Get detected language
        let lang_id = state.full_lang_id_from_state().unwrap_or(0);
        let language = whisper_rs::get_lang_str(lang_id)
            .unwrap_or("unknown")
            .to_string();

        on_progress("Complete", 100);

        Ok(TranscriptionResult {
            text: full_text,
            segments,
            language,
        })
    }

    /// Reads an audio file and converts it to 16kHz mono f32 PCM samples.
    fn read_audio_file(&self, path: &str) -> Result<Vec<f32>, Box<dyn std::error::Error>> {
        let path = Path::new(path);
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();

        match ext.as_str() {
            "wav" => self.read_wav(path),
            _ => self.convert_with_ffmpeg(path),
        }
    }

    fn read_wav(&self, path: &Path) -> Result<Vec<f32>, Box<dyn std::error::Error>> {
        self.convert_with_ffmpeg(path)
    }

    fn convert_with_ffmpeg(&self, path: &Path) -> Result<Vec<f32>, Box<dyn std::error::Error>> {
        use std::process::Command;

        let output = Command::new("ffmpeg")
            .args([
                "-i",
                &path.to_string_lossy(),
                "-ar",
                "16000",
                "-ac",
                "1",
                "-f",
                "f32le",
                "-acodec",
                "pcm_f32le",
                "-hide_banner",
                "-loglevel",
                "error",
                "pipe:1",
            ])
            .output()
            .map_err(|e| {
                format!(
                    "Failed to run ffmpeg. Make sure ffmpeg is installed and in your PATH. Error: {}",
                    e
                )
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("ffmpeg conversion failed: {}", stderr).into());
        }

        let bytes = output.stdout;
        if bytes.len() % 4 != 0 {
            return Err("Invalid audio data from ffmpeg".into());
        }

        let samples: Vec<f32> = bytes
            .chunks_exact(4)
            .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
            .collect();

        Ok(samples)
    }
}
