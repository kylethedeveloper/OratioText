import os
import whisper
import torch
from typing import Optional, Tuple, Dict
from whisper.tokenizer import LANGUAGES
from whisper.utils import format_timestamp
import sys

class WhisperHandler:
    def __init__(self):
        self.model = None
        self.model_name = None
        self.last_result = None
        self.set_ffmpeg_path()  # Set the FFmpeg path when initializing

    def set_ffmpeg_path(self):
        """Set the path for the bundled FFmpeg binary."""
        if getattr(sys, 'frozen', False):
            # Running as a bundled executable
            if sys.platform.startswith('win'):
                ffmpeg_path = os.path.join(sys._MEIPASS, 'ffmpeg.exe')
            else:
                ffmpeg_path = os.path.join(sys._MEIPASS, 'ffmpeg')
            
            os.environ["FFMPEG_BINARY"] = ffmpeg_path
            # Add the FFmpeg path to the system PATH
            os.environ["PATH"] = f"{os.path.dirname(ffmpeg_path)};{os.environ['PATH']}" if sys.platform.startswith('win') else f"{os.path.dirname(ffmpeg_path)}:{os.environ['PATH']}"
        else:
            # Running in a normal Python environment
            os.environ["FFMPEG_BINARY"] = 'ffmpeg'  # Assume it's in the PATH

    def load_model(self, model_name: str) -> None:
        """Load a Whisper model."""
        if self.model_name != model_name:
            self.model = whisper.load_model(model_name)
            self.model_name = model_name

    def transcribe(self, audio_path: str, progress_callback=None) -> Tuple[str, dict]:
        """
        Transcribe audio file to text.
        
        Args:
            audio_path: Path to the audio file
            progress_callback: Optional callback function to report progress
            
        Returns:
            Tuple of (transcribed_text, metadata)
        """
        if self.model is None:
            raise RuntimeError("Model not loaded. Call load_model first.")

        # Transcribe the audio
        result = self.model.transcribe(
            audio=audio_path,
            fp16=torch.cuda.is_available(),
            language=None,  # Auto-detect language
        )

        # Store the result for later use
        self.last_result = result

        # Get the detected language code
        language_code = result.get("language", "unknown")
        # Convert to full language name using Whisper's LANGUAGES dictionary
        language_name = LANGUAGES.get(language_code, f"Unknown ({language_code})")

        # Format the transcription with timestamps
        formatted_text = self.get_formatted_text(include_timestamps=True)

        return formatted_text, {
            "language": language_name.title(),  # Capitalize the language name
            "segments": result.get("segments", []),
        }

    def get_formatted_text(self, include_timestamps: bool = True) -> str:
        """Get the transcription text with or without timestamps."""
        if not self.last_result:
            return ""

        formatted_text = ""
        for segment in self.last_result["segments"]:
            if include_timestamps:
                start = format_timestamp(segment["start"])
                end = format_timestamp(segment["end"])
                text = segment["text"].strip()
                formatted_text += f"[{start} --> {end}]  {text}\n"
            else:
                formatted_text += f"{segment['text'].strip()}\n"

        return formatted_text

    @staticmethod
    def get_available_models() -> list:
        """Get list of available Whisper models."""
        return ["tiny", "base", "small", "medium", "large"]

    def cleanup(self) -> None:
        """Clean up resources."""
        if self.model is not None:
            del self.model
            torch.cuda.empty_cache()
            self.model = None
            self.model_name = None
            self.last_result = None
