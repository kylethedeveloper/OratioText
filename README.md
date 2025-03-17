# OratioText

| <img src="assets/appicon.png" alt="OratioText Icon" width="200" height="auto"> | A cross-platform desktop application for converting speech to text using OpenAI's [Whisper](https://github.com/openai/whisper) model. This application only <ins>**runs on your computer**</ins> and uses the AI model <ins>locally</ins>. |
| :-------------------: | :----------: |

## Features

- Support for various file formats: 
    - AUDIO: *.mp3, *.wav, *.m4a, *.flac, *.ogg
    - VIDEO: *.mp4, *.avi, *.mov, *.wmv
- Automatic model recommendation based on system specifications
- Multiple Whisper model options; tiny, base, small, medium, large
- Easy-to-use graphical interface
- Export transcription results

## Usage

1. Select an audio/video file using the file picker
2. Choose a Whisper model (or use the recommended one)
3. Click "Generate" to start the transcription
4. Save the transcription results when complete

## System Requirements

- Python 3.8 or higher
- Sufficient disk space for Whisper models
- GPU support is optional but recommended for faster processing

## Development

1. Clone this repository:
```bash
git clone https://github.com/kylethedeveloper/OratioText.git
cd OratioText
```

2. Create a virtual environment (recommended):
```bash
python -m venv oratiotext
source oratiotext/bin/activate  
# On Windows: venv\Scripts\activate
```

3. Install the required dependencies:
```bash
pip install -r requirements.txt
```

4. Run the application:
```bash
python -m main
```

## Build

This part is a bit tricky. To build this application, [`pyinstaller`](https://pyinstaller.org/en/stable/) is used. 

1. Activate the virtual environment:
```bash
source oratiotext/bin/activate  
# On Windows: venv\Scripts\activate
```

2. Install `pyinstaller`:
```bash
pip install pyinstaller
```

3. Run `pyinstaller` with the provided [.spec file](./OratioText.spec):
```bash
pyinstaller --clean OratioText.spec
```

## TODO

- [ ] Add a cancel button
- [ ] Add a progress bar for the transcription
- [ ] Add a progress bar for the download of the Whisper model (with cancel option)
- [ ] Add a help menu
- [ ] Add an about menu (feedback, donate, etc)
- [x] Add an icon
- [ ] Build an installer for Windows, MacOS and Linux

--- 

[*MIT License*](./LICENSE)
