# Building OratioText

This document explains how to build OratioText for macOS and Windows using PyInstaller, both locally and via GitHub Actions CI.

## Prerequisites

| Requirement | macOS | Windows |
|---|---|---|
| Python | 3.8+ | 3.8+ |
| FFmpeg | `brew install ffmpeg` | `choco install ffmpeg` or [download](https://ffmpeg.org/download.html) |
| PyInstaller | `pip install pyinstaller` | `pip install pyinstaller` |

> [!IMPORTANT]
> FFmpeg **must be in your system PATH** before building. The PyInstaller spec files locate it automatically at build time.

## Local Build

### macOS

```bash
# 1. Create and activate virtual environment
python -m venv oratiotext-venv
source oratiotext-venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt
pip install pyinstaller

# 3. Build the .app bundle
pyinstaller --clean OratioText.spec
```

The output will be at `dist/OratioText.app`.

### Windows

```batch
REM 1. Create and activate virtual environment
python -m venv oratiotext-venv
oratiotext-venv\Scripts\activate

REM 2. Install dependencies
pip install -r requirements.txt
pip install pyinstaller

REM 3. Build the .exe
pyinstaller --clean OratioText-windows.spec
```

Or use the provided build script:
```batch
scripts\build_windows.bat
```

The output will be at `dist\OratioText\OratioText.exe`.

## GitHub Actions Workflow

The GitHub Actions workflow (`.github/workflows/build.yml`) automatically builds when you:
- Push to `master` or `develop` branches
- Create a pull request to `master`
- Create a GitHub release

### Build Matrix

| Platform | Runner | Architecture |
|---|---|---|
| macOS Apple Silicon | `macos-14` | ARM64 |
| macOS Intel | `macos-13` | x86_64 |
| Windows | `windows-latest` | x86_64 |

### Build Artifacts

Each build produces a zip archive uploaded as a GitHub Actions artifact:
- `OratioText-macos-arm64.zip` — macOS Apple Silicon (.app bundle)
- `OratioText-macos-x86_64.zip` — macOS Intel (.app bundle)
- `OratioText-windows.zip` — Windows (.exe with dependencies)

### Release Process

1. Go to your GitHub repository → **Releases** → **Create a new release**
2. Fill in the tag (e.g., `v1.0.0`), title, and description
3. Publish the release
4. The workflow automatically builds and uploads all three platform artifacts to the release

## Configuration

### PyInstaller Spec Files

| File | Platform | Description |
|---|---|---|
| `OratioText.spec` | macOS | Builds `.app` bundle with `Info.plist` and bundle identifier |
| `OratioText-windows.spec` | Windows | Builds folder-based `.exe` distribution |

Both spec files:
- Automatically find `ffmpeg` from the system PATH via `shutil.which()`
- Bundle all Whisper model data files
- Include hidden imports for `whisper`, `components`, and `utils`

### Info.plist (macOS only)

The `Info.plist` file provides:
- Bundle information (name, identifier, version)
- Document type associations (mp3, wav, m4a, aac, flac, ogg)
- Minimum macOS version (10.15.0)

## Troubleshooting

### FFmpeg not found during build

Make sure ffmpeg is installed and in your PATH:
```bash
# macOS
brew install ffmpeg
which ffmpeg

# Windows
choco install ffmpeg
where ffmpeg
```

### macOS: "unidentified developer" warning

Since the app is not notarized by Apple, users need to right-click → Open the first time, then confirm. For production distribution, consider an [Apple Developer ID certificate](https://developer.apple.com/developer-id/).

### GitHub Actions build fails

1. Check the workflow logs for specific error messages
2. Ensure `requirements.txt` is up to date
3. Verify the workflow file is valid YAML at `.github/workflows/build.yml`
