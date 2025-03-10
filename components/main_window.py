from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QPushButton,
    QTextEdit, QMessageBox, QProgressDialog, QCheckBox
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from components.file_selector import FileSelector
from components.model_selector import ModelSelector
from utils.whisper_handler import WhisperHandler

class TranscriptionThread(QThread):
    finished = pyqtSignal(str, dict)
    error = pyqtSignal(str)

    def __init__(self, whisper_handler, model_name, file_path):
        super().__init__()
        self.whisper_handler = whisper_handler
        self.model_name = model_name
        self.file_path = file_path

    def run(self):
        try:
            self.whisper_handler.load_model(self.model_name)
            text, metadata = self.whisper_handler.transcribe(self.file_path)
            self.finished.emit(text, metadata)
        except Exception as e:
            self.error.emit(str(e))

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.whisper_handler = WhisperHandler()
        self.init_ui()

    def init_ui(self):
        self.setWindowTitle('OratioText')
        self.setMinimumSize(800, 600)

        # Create central widget and layout
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)
        layout.setSpacing(5)  # Set consistent spacing between all components
        layout.setContentsMargins(10, 10, 10, 10)  # Set consistent margins around the window

        # Add file selector
        self.file_selector = FileSelector()
        layout.addWidget(self.file_selector)

        # Add model selector
        self.model_selector = ModelSelector()
        layout.addWidget(self.model_selector)

        # Add generate button
        self.generate_btn = QPushButton("Generate Transcription")
        self.generate_btn.clicked.connect(self.start_transcription)
        layout.addWidget(self.generate_btn)

        # Add timestamp checkbox
        self.timestamp_checkbox = QCheckBox("Include Timestamps")
        self.timestamp_checkbox.setChecked(True)  # Checked by default
        self.timestamp_checkbox.setEnabled(False)  # Disabled by default
        self.timestamp_checkbox.stateChanged.connect(self.toggle_timestamps)
        layout.addWidget(self.timestamp_checkbox)

        # Add text output area
        self.text_output = QTextEdit()
        self.text_output.setReadOnly(True)
        self.text_output.setPlaceholderText("Transcription will appear here...")
        layout.addWidget(self.text_output)

        # Add save button
        self.save_btn = QPushButton("Save Transcription")
        self.save_btn.clicked.connect(self.save_transcription)
        self.save_btn.setEnabled(False)
        layout.addWidget(self.save_btn)

    def toggle_timestamps(self):
        """Toggle timestamps in the transcription text."""
        if hasattr(self.whisper_handler, 'last_result') and self.whisper_handler.last_result:
            text = self.whisper_handler.get_formatted_text(
                include_timestamps=self.timestamp_checkbox.isChecked()
            )
            self.text_output.setText(text)

    def start_transcription(self):
        file_path = self.file_selector.get_selected_file()
        if not file_path:
            QMessageBox.warning(self, "Error", "Please select an audio/video file first.")
            return

        model_name = self.model_selector.get_selected_model()
        
        # Disable UI elements
        self.generate_btn.setEnabled(False)
        self.timestamp_checkbox.setChecked(True)   # Checked by default during transcription
        self.timestamp_checkbox.setEnabled(False)  # Ensure checkbox is disabled during transcription
        self.text_output.clear()
        
        # Create and start transcription thread
        self.thread = TranscriptionThread(self.whisper_handler, model_name, file_path)
        self.thread.finished.connect(self.handle_transcription_complete)
        self.thread.error.connect(self.handle_transcription_error)
        self.thread.start()

        # Show progress dialog
        self.progress = QProgressDialog("Transcribing... This may take a while.", None, 0, 0, self)
        self.progress.setWindowModality(Qt.WindowModality.WindowModal)
        self.progress.show()

    def handle_transcription_complete(self, text, metadata):
        self.progress.close()
        self.generate_btn.setEnabled(True)
        self.text_output.setText(text)
        self.save_btn.setEnabled(True)
        self.timestamp_checkbox.setEnabled(True)

        # Show language detection info
        if metadata.get('language'):
            QMessageBox.information(self, "Transcription Complete", 
                                  f"Detected language: {metadata['language']}")

    def handle_transcription_error(self, error_msg):
        self.progress.close()
        self.generate_btn.setEnabled(True)
        QMessageBox.critical(self, "Error", f"Transcription failed: {error_msg}")

    def save_transcription(self):
        from PyQt6.QtWidgets import QFileDialog
        file_name, _ = QFileDialog.getSaveFileName(
            self,
            "Save Transcription",
            "",
            "Text Files (*.txt);;All Files (*.*)"
        )
        if file_name:
            try:
                with open(file_name, 'w', encoding='utf-8') as f:
                    f.write(self.text_output.toPlainText())
                QMessageBox.information(self, "Success", "Transcription saved successfully!")
            except Exception as e:
                QMessageBox.critical(self, "Error", f"Failed to save file: {str(e)}")

    def closeEvent(self, event):
        self.whisper_handler.cleanup()
        super().closeEvent(event)
