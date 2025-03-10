from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QComboBox, QLabel
)
from utils.whisper_handler import WhisperHandler
from utils.system_info import SystemInfo

class ModelSelector(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.init_ui()

    def init_ui(self):
        # Create main vertical layout
        layout = QVBoxLayout()
        self.setLayout(layout)

        # Create horizontal layout for label and combo box
        model_layout = QHBoxLayout()

        # Create model selection combo box
        self.model_label = QLabel("Select Model:")
        self.model_combo = QComboBox()
        self.model_combo.addItems(WhisperHandler.get_available_models())

        # Add label and combo box to horizontal layout
        model_layout.addWidget(self.model_label)
        model_layout.addWidget(self.model_combo)
        model_layout.addStretch()  # Add stretch to push widgets to the left

        # Create recommendation label
        self.recommendation_label = QLabel()
        self.update_recommendation()

        # Add layouts and widgets to main layout
        layout.addLayout(model_layout)
        layout.addWidget(self.recommendation_label)

    def update_recommendation(self):
        """Update the model recommendation based on system specs."""
        recommended_model, reason = SystemInfo.get_recommended_model()
        self.recommendation_label.setText(f"Recommended: {recommended_model}\n{reason}")
        
        # Set the recommended model as current selection
        index = self.model_combo.findText(recommended_model)
        if index >= 0:
            self.model_combo.setCurrentIndex(index)

    def get_selected_model(self):
        """Return the selected model name."""
        return self.model_combo.currentText()
