# OratioText

| <img src="assets/appicon.png" alt="OratioText Icon" width="200" height="auto"> | A cross-platform desktop application for converting speech to text using [Whisper](https://github.com/ggerganov/whisper.cpp). This application only <ins>**runs on your computer**</ins> and uses the AI model <ins>locally</ins>. |
| :-------------------: | :----------: |

## Features

- Support for various file formats: 
    - AUDIO: *.mp3, *.wav, *.m4a, *.flac, *.ogg
    - VIDEO: *.mp4, *.avi, *.mov, *.wmv
- Automatic model recommendation based on system specifications
- Multiple Whisper model options; tiny, base, small, medium, large
- Easy-to-use graphical interface
- Export transcription results
- Lightweight installer (~10 MB) — models downloaded on first use

## Architecture

Built with [Tauri v2](https://tauri.app/) and [whisper.cpp](https://github.com/ggerganov/whisper.cpp):

- **Frontend**: HTML / CSS / JavaScript (rendered in system WebView)
- **Backend**: Rust with [whisper-rs](https://github.com/tazz4843/whisper-rs) bindings
- **Audio conversion**: FFmpeg (must be installed separately)

## Installation

You can download the latest installers and packages for your operating system from the [GitHub Releases](https://github.com/kylethedeveloper/OratioText/releases) page.

Choose the appropriate file for your platform:
- **macOS**: `.dmg`
- **Windows**: `.msi` or `.exe`
- **Linux**: `.deb` or `.AppImage`

## Basic Usage

1. Select an audio/video file using the file picker
2. Choose a Whisper model (download if needed)
3. Click "Generate" to start the transcription
4. Save the transcription results when complete

## System Requirements

- macOS 10.15+, Windows 10+, or Linux (Ubuntu 22.04+ / equivalent)
- FFmpeg installed and in PATH
- Internet connection for initial model download

### macOS Installation Note

Since the app is not signed with an Apple Developer certificate (yet), macOS Gatekeeper may show a warning saying **"OratioText is damaged and can't be opened"**. This is expected for unsigned open-source apps.

To fix this, run the following command in Terminal after installing the app:

```bash
xattr -cr /Applications/OratioText.app
```

Then open the app normally.

### Linux Installation Note

If you downloaded the `.AppImage`, you need to make it executable before running:

```bash
chmod +x OratioText_*.AppImage
./OratioText_*.AppImage
```

For the `.deb` package, install it with:

```bash
sudo dpkg -i OratioText_*.deb
```

Make sure you have FFmpeg and the required WebKit2GTK runtime libraries installed:

```bash
sudo apt install ffmpeg libwebkit2gtk-4.1-0
```

## Development

### Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Cmake](https://cmake.org/download/)
- [Node.js](https://nodejs.org/) (LTS)
- [FFmpeg](https://ffmpeg.org/download.html)

### Setup

1. Clone this repository:

```bash
git clone https://github.com/kylethedeveloper/OratioText.git
cd OratioText
```
2. Install `tauri-cli` if not installed:

```bash
cargo install tauri-cli --version "^2.0.0" --locked
```

3. Run in dev mode

```bash
cargo tauri dev
```

### Build for production

```bash
cargo tauri build
```

See [BUILD.md](./BUILD.md) for detailed build and CI instructions. 

See [TODO.md](./TODO.md) for a list of features to be added.

--- 

[*MIT License*](./LICENSE)
