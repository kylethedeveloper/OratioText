from PyQt6.QtWidgets import (
    QWidget, QHBoxLayout, QLineEdit, QPushButton, QFileDialog
)

class FileSelector(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.init_ui()

    def init_ui(self):
        layout = QHBoxLayout()
        self.setLayout(layout)

        # Create file path input
        self.file_path = QLineEdit()
        self.file_path.setPlaceholderText("Select an audio/video file...")
        self.file_path.setReadOnly(True)

        # Create browse button
        self.browse_btn = QPushButton("Browse")
        self.browse_btn.clicked.connect(self.browse_file)

        # Add widgets to layout
        layout.addWidget(self.file_path)
        layout.addWidget(self.browse_btn)

    def browse_file(self):
        file_name, _ = QFileDialog.getOpenFileName(
            self,
            "Select Audio/Video File",
            "",
            "Media Files (*.mp3 *.wav *.m4a *.mp4 *.avi *.mov *.wmv *.flac *.ogg)"
        )
        if file_name:
            self.file_path.setText(file_name)

    def get_selected_file(self):
        """Return the selected file path."""
        return self.file_path.text()
