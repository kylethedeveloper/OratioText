# Building OratioText

## Prerequisites

| Requirement | macOS | Windows |
|---|---|---|
| Rust | [rustup.rs](https://rustup.rs/) | [rustup.rs](https://rustup.rs/) |
| Node.js | `brew install node` | [nodejs.org](https://nodejs.org/) |
| FFmpeg | `brew install ffmpeg` | `choco install ffmpeg` |

## Local Build

### Development mode

```bash
cargo tauri dev
```

This starts the app in dev mode with hot-reloading for the frontend.

### Production build

```bash
cargo tauri build
```

Output:
- **macOS**: `src-tauri/target/release/bundle/dmg/OratioText_*.dmg`
- **Windows**: `src-tauri/target/release/bundle/msi/OratioText_*.msi`

## GitHub Actions CI

The workflow (`.github/workflows/build.yml`) uses the official [Tauri Action](https://github.com/tauri-apps/tauri-action) to build for all platforms.

### Triggers

- Push to `master` or `develop` → builds artifacts
- Pull request to `master` → builds artifacts
- GitHub Release published → builds and uploads to release

### Build Matrix

| Platform | Target | Output |
|---|---|---|
| macOS Apple Silicon | `aarch64-apple-darwin` | `.dmg` |
| macOS Intel | `x86_64-apple-darwin` | `.dmg` |
| Windows | `x86_64-pc-windows-msvc` | `.msi` / `.exe` |

### Accessing Build Artifacts

For non-release builds, download artifacts from:
**GitHub repo → Actions tab → click workflow run → Artifacts section**

## Project Structure

```
src-tauri/           # Rust backend (Tauri)
├── Cargo.toml       # Rust dependencies
├── src/
│   ├── main.rs      # Entry point
│   ├── lib.rs       # Tauri setup + commands
│   ├── transcriber.rs    # Whisper transcription
│   └── model_manager.rs  # Model downloads
├── tauri.conf.json  # Tauri config
└── capabilities/    # Permission config

src/                 # Frontend (HTML/CSS/JS)
├── index.html
├── styles.css
└── main.js
```

## Whisper Models

Models are **not bundled** with the app. They are downloaded from [Hugging Face](https://huggingface.co/ggerganov/whisper.cpp) on first use and cached in:
- **macOS**: `~/Library/Application Support/OratioText/models/`
- **Windows**: `%APPDATA%/OratioText/models/`

| Model | Size | Quality |
|---|---|---|
| tiny | ~75 MB | Fastest, lower accuracy |
| base | ~142 MB | Good balance for short audio |
| small | ~466 MB | Good accuracy |
| medium | ~1.5 GB | High accuracy |
| large | ~2.9 GB | Best accuracy, slowest |
