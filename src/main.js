// ==========================================================================
// OratioText — Frontend Logic
// ==========================================================================

const { invoke } = window.__TAURI__.core;
const { open, save } = window.__TAURI__.dialog;
const { listen } = window.__TAURI__.event;

// In Tauri v2 plain-HTML mode, fs plugin is not available via __TAURI__.fs
// We use the save_file Rust command instead (already registered in lib.rs)
const writeTextFile = null;

// ---- State ----------------------------------------------------------------

let transcriptionResult = null;
let selectedFilePath = null;

// ---- DOM Elements ---------------------------------------------------------

const filePathInput = document.getElementById("file-path");
const browseBtn = document.getElementById("browse-btn");
const modelSelect = document.getElementById("model-select");
const downloadBtn = document.getElementById("download-btn");
const downloadProgress = document.getElementById("download-progress");
const progressFill = document.getElementById("progress-fill");
const progressText = document.getElementById("progress-text");
const modelInfo = document.getElementById("model-info");
const languageSelect = document.getElementById("language-select");
const generateBtn = document.getElementById("generate-btn");
const stopBtn = document.getElementById("stop-btn");
const timestampsToggle = document.getElementById("timestamps-toggle");
const saveBtn = document.getElementById("save-btn");
const outputArea = document.getElementById("transcription-output");
const statusBar = document.getElementById("status-bar");
const statusText = document.getElementById("status-text");
const languageInfo = document.getElementById("language-info");
const languageText = document.getElementById("language-text");

// ---- Navigation Elements --------------------------------------------------
const menuToggle = document.getElementById("menu-toggle");
const navDropdown = document.getElementById("nav-dropdown");
const navItems = document.querySelectorAll(".nav-item");
const pages = {
  home: document.getElementById("page-home"),
  history: document.getElementById("page-history"),
  about: document.getElementById("page-about"),
};

// ---- Initialization -------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  await loadModels();
  await loadAppVersion();
  setupEventListeners();
  setupDownloadProgressListener();
  setupTranscriptionProgressListener();
});

async function loadAppVersion() {
  try {
    const version = await invoke("get_app_version");
    const appVersionEl = document.getElementById("app-version");
    if (appVersionEl) {
      appVersionEl.textContent = `Version ${version}`;
    }
  } catch (err) {
    console.error("Failed to load app version:", err);
  }
}

async function loadModels() {
  try {
    const [models, sysInfo] = await Promise.all([
      invoke("list_models"),
      invoke("get_system_info"),
    ]);

    const recommendedModel = getRecommendedModel(sysInfo.total_memory_gb);

    modelSelect.innerHTML = "";

    models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model.name;
      const isRecommended = model.name === recommendedModel;
      option.textContent = `${model.name} (${model.size})${model.downloaded ? " ✓" : ""}${isRecommended ? " (Recommended)" : ""}`;
      option.dataset.downloaded = model.downloaded;
      modelSelect.appendChild(option);
    });

    // Select first downloaded, or recommended, or first
    const firstDownloaded = models.findIndex((m) => m.downloaded);
    const recommendedIndex = models.findIndex((m) => m.name === recommendedModel);
    if (firstDownloaded >= 0) {
      modelSelect.selectedIndex = firstDownloaded;
    } else if (recommendedIndex >= 0) {
      modelSelect.selectedIndex = recommendedIndex;
    } else {
      modelSelect.selectedIndex = 0;
    }

    updateModelUI();
  } catch (err) {
    console.error("Failed to load models:", err);
    modelSelect.innerHTML = '<option value="" disabled>Failed to load models</option>';
  }
}

function getRecommendedModel(totalMemoryGb) {
  if (totalMemoryGb >= 16) return "turbo";
  if (totalMemoryGb >= 8) return "small";
  if (totalMemoryGb >= 4) return "base";
  return "tiny";
}

// ---- Event Listeners ------------------------------------------------------

function setupEventListeners() {
  browseBtn.addEventListener("click", browseFile);
  downloadBtn.addEventListener("click", downloadModel);
  generateBtn.addEventListener("click", startTranscription);
  stopBtn.addEventListener("click", stopTranscription);
  saveBtn.addEventListener("click", saveTranscription);
  timestampsToggle.addEventListener("change", updateTranscriptionDisplay);
  modelSelect.addEventListener("change", updateModelUI);

  // Navigation events
  menuToggle.addEventListener("click", () => {
    navDropdown.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!menuToggle.contains(e.target) && !navDropdown.contains(e.target)) {
      navDropdown.classList.add("hidden");
    }
  });

  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetPage = btn.dataset.page;
      navDropdown.classList.add("hidden");
      
      // Update active button
      navItems.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // Show target page, hide others
      Object.keys(pages).forEach((page) => {
        if (page === targetPage) {
          pages[page].classList.remove("hidden");
        } else {
          pages[page].classList.add("hidden");
        }
      });
    });
  });
}

function setupDownloadProgressListener() {
  listen("download-progress", (event) => {
    const { percent } = event.payload;
    progressFill.style.width = `${percent.toFixed(1)}%`;
    progressText.textContent = `${percent.toFixed(1)}%`;
  });
}

function setupTranscriptionProgressListener() {
  listen("transcription-progress", (event) => {
    const { stage, percent } = event.payload;
    // Update existing elements rather than replacing innerHTML so the
    // CSS transition on progress-bar-fill actually fires
    const existing = outputArea.querySelector(".transcription-progress");
    if (existing) {
      existing.querySelector(".progress-stage").textContent = stage;
      existing.querySelector(".progress-bar-fill").style.width = `${percent}%`;
      existing.querySelector(".progress-percent").textContent = `${percent}%`;
    } else {
      outputArea.innerHTML = `<div class="transcription-progress"><p class="progress-stage">${escapeHtml(stage)}</p><div class="progress-bar-inline"><div class="progress-bar-fill" style="width: ${percent}%"></div></div><p class="progress-percent">${percent}%</p></div>`;
    }
  });
}

// ---- File Browsing --------------------------------------------------------

async function browseFile() {
  try {
    const filePath = await open({
      multiple: false,
      filters: [
        {
          name: "Media Files",
          extensions: ["mp3", "wav", "m4a", "mp4", "avi", "mov", "wmv", "flac", "ogg"],
        },
      ],
    });

    if (filePath) {
      selectedFilePath = filePath;
      filePathInput.value = filePath;
      updateGenerateButton();
    }
  } catch (err) {
    console.error("File browse error:", err);
  }
}

// ---- Model Management -----------------------------------------------------

function updateModelUI() {
  const selectedOption = modelSelect.options[modelSelect.selectedIndex];
  if (!selectedOption) return;

  const isDownloaded = selectedOption.dataset.downloaded === "true";
  downloadBtn.disabled = isDownloaded;
  downloadBtn.textContent = isDownloaded ? "Downloaded ✓" : "Download";
  modelInfo.textContent = isDownloaded
    ? "Model is ready to use"
    : "Download required before transcription";

  updateGenerateButton();
}

async function downloadModel() {
  const modelName = modelSelect.value;
  if (!modelName) return;

  downloadBtn.disabled = true;
  downloadBtn.textContent = "Downloading...";
  downloadProgress.classList.remove("hidden");
  progressFill.style.width = "0%";
  progressText.textContent = "0%";

  try {
    await invoke("download_model", { modelName });

    // Refresh model list to update download status
    await loadModels();
    modelInfo.textContent = "Model downloaded successfully!";
  } catch (err) {
    modelInfo.textContent = `Download failed: ${err}`;
    downloadBtn.disabled = false;
    downloadBtn.textContent = "Retry Download";
  } finally {
    downloadProgress.classList.add("hidden");
  }
}

// ---- Transcription --------------------------------------------------------

function updateGenerateButton() {
  const selectedOption = modelSelect.options[modelSelect.selectedIndex];
  const modelReady = selectedOption && selectedOption.dataset.downloaded === "true";
  const fileSelected = !!selectedFilePath;
  generateBtn.disabled = !(modelReady && fileSelected);
}

async function startTranscription() {
  if (!selectedFilePath) return;

  const modelName = modelSelect.value;
  if (!modelName) return;

  // Show loading state
  setLoading(true, "Transcribing...");
  generateBtn.classList.add("hidden");
  stopBtn.classList.remove("hidden");
  outputArea.innerHTML = `<div class="transcription-progress"><p class="progress-stage">Starting...</p><div class="progress-bar-inline"><div class="progress-bar-fill" style="width: 0%"></div></div><p class="progress-percent">0%</p></div>`;
  saveBtn.disabled = true;
  languageInfo.classList.add("hidden");

  try {
    transcriptionResult = await invoke("transcribe", {
      filePath: selectedFilePath,
      modelName,
      language: languageSelect.value
    });

    updateTranscriptionDisplay();
    saveBtn.disabled = false;

    // Show detected language
    if (transcriptionResult.language) {
      languageText.textContent = `Detected language: ${transcriptionResult.language}`;
      languageInfo.classList.remove("hidden");
    }
  } catch (err) {
    const cancelled = String(err).includes("cancelled");
    if (cancelled) {
      outputArea.innerHTML = '<p class="placeholder-text">Transcription stopped.</p>';
    } else {
      outputArea.innerHTML = `<p style="color: var(--color-error);">Transcription failed: ${escapeHtml(String(err))}</p>`;
    }
    transcriptionResult = null;
  } finally {
    setLoading(false);
    generateBtn.classList.remove("hidden");
    stopBtn.classList.add("hidden");
    stopBtn.disabled = false;
    stopBtn.textContent = "Stop";
  }
}

async function stopTranscription() {
  stopBtn.disabled = true;
  stopBtn.textContent = "Stopping...";
  try {
    await invoke("stop_transcription");
  } catch (err) {
    console.error("Failed to stop transcription:", err);
  }
}

function updateTranscriptionDisplay() {
  if (!transcriptionResult) return;

  const showTimestamps = timestampsToggle.checked;
  let html = "";

  transcriptionResult.segments.forEach((seg) => {
    if (showTimestamps) {
      const start = formatTimestamp(seg.start);
      const end = formatTimestamp(seg.end);
      html += `<span class="timestamp">[${start} → ${end}]</span>  ${escapeHtml(seg.text)}\n`;
    } else {
      html += `${escapeHtml(seg.text)}\n`;
    }
  });

  outputArea.innerHTML = html || '<p class="placeholder-text">No transcription results.</p>';
}

// ---- Save -----------------------------------------------------------------

async function saveTranscription() {
  if (!transcriptionResult) return;

  try {
    const filePath = await save({
      filters: [{ name: "Text Files", extensions: ["txt"] }],
      defaultPath: "transcription.txt",
    });

    if (filePath) {
      const text = getPlainTextOutput();

      // Use Tauri fs API if available, otherwise invoke a command
      if (writeTextFile) {
        await writeTextFile(filePath, text);
      } else {
        // Fallback: write via fetch or invoke
        const blob = new Blob([text], { type: "text/plain" });
        // For Tauri v2, we can use the path directly
        await invoke("save_file", { path: filePath, content: text }).catch(() => {
          // If no save_file command, create a download link
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "transcription.txt";
          a.click();
        });
      }
    }
  } catch (err) {
    console.error("Save error:", err);
  }
}

function getPlainTextOutput() {
  if (!transcriptionResult) return "";

  const showTimestamps = timestampsToggle.checked;
  let text = "";

  transcriptionResult.segments.forEach((seg) => {
    if (showTimestamps) {
      const start = formatTimestamp(seg.start);
      const end = formatTimestamp(seg.end);
      text += `[${start} → ${end}]  ${seg.text}\n`;
    } else {
      text += `${seg.text}\n`;
    }
  });

  return text;
}

// ---- Helpers --------------------------------------------------------------

function formatTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  if (hours > 0) {
    return `${pad(hours)}:${pad(mins)}:${pad(secs)}.${pad3(ms)}`;
  }
  return `${pad(mins)}:${pad(secs)}.${pad3(ms)}`;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function setLoading(loading, message = "Processing...") {
  if (loading) {
    statusBar.classList.remove("hidden");
    statusText.textContent = message;
    generateBtn.disabled = true;
  } else {
    statusBar.classList.add("hidden");
    updateGenerateButton();
  }
}

// ---- Theme Toggle ---------------------------------------------------------

const themeToggle = document.getElementById("theme-toggle");
const iconMoon = document.getElementById("icon-moon");
const iconSun = document.getElementById("icon-sun");

function setThemeIcons(isLight) {
  if (isLight) {
    iconMoon.classList.add("hidden");
    iconSun.classList.remove("hidden");
  } else {
    iconMoon.classList.remove("hidden");
    iconSun.classList.add("hidden");
  }
}

function initTheme() {
  const saved = localStorage.getItem("oratiotext-theme");
  if (saved === "light") {
    document.documentElement.setAttribute("data-theme", "light");
    setThemeIcons(true);
  }
}

function toggleTheme() {
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  if (isLight) {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("oratiotext-theme", "dark");
    setThemeIcons(false);
  } else {
    document.documentElement.setAttribute("data-theme", "light");
    localStorage.setItem("oratiotext-theme", "light");
    setThemeIcons(true);
  }
}

themeToggle.addEventListener("click", toggleTheme);
initTheme();

