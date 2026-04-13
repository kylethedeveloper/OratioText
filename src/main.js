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
  settings: document.getElementById("page-settings"),
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

// ---- Theme & App Settings ---------------------------------------------------------

const themeToggle = document.getElementById("theme-toggle");
const iconMoon = document.getElementById("icon-moon");
const iconSun = document.getElementById("icon-sun");
const iconSystem = document.getElementById("icon-system");
const appThemeSelect = document.getElementById("app-theme-select");
const appLanguageSelect = document.getElementById("app-language-select");

function setThemeIcons(theme) {
  iconMoon.classList.add("hidden");
  iconSun.classList.add("hidden");
  iconSystem.classList.add("hidden");

  if (theme === "light") {
    iconSun.classList.remove("hidden");
  } else if (theme === "dark") {
    iconMoon.classList.remove("hidden");
  } else {
    iconSystem.classList.remove("hidden");
  }
}

function applyTheme(theme) {
  let isLight = false;

  if (theme === "system") {
    isLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  } else {
    isLight = (theme === "light");
  }

  if (isLight) {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }

  setThemeIcons(theme);
}

function initTheme() {
  const savedTheme = localStorage.getItem("oratiotext-theme") || "system";

  if (appThemeSelect) {
    appThemeSelect.value = savedTheme;
  }

  applyTheme(savedTheme);

  // Listen for system theme changes if set to system
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    if ((localStorage.getItem("oratiotext-theme") || "system") === "system") {
      applyTheme("system");
    }
  });
}

function toggleTheme() {
  const currentSaved = localStorage.getItem("oratiotext-theme") || "system";
  let nextTheme = "dark";

  if (currentSaved === "dark") {
    nextTheme = "light";
  } else if (currentSaved === "light") {
    nextTheme = "system";
  } else {
    nextTheme = "dark"; // Default to dark from system
  }

  localStorage.setItem("oratiotext-theme", nextTheme);
  if (appThemeSelect) {
    appThemeSelect.value = nextTheme;
  }
  applyTheme(nextTheme);
}

themeToggle.addEventListener("click", toggleTheme);

function initSettings() {
  initTheme();

  if (appThemeSelect) {
    appThemeSelect.addEventListener("change", (e) => {
      const theme = e.target.value;
      localStorage.setItem("oratiotext-theme", theme);
      applyTheme(theme);
    });
  }

  const savedLang = localStorage.getItem("oratiotext-app-language");
  if (savedLang && appLanguageSelect) {
    appLanguageSelect.value = savedLang;
  }

  if (appLanguageSelect) {
    appLanguageSelect.addEventListener("change", (e) => {
      localStorage.setItem("oratiotext-app-language", e.target.value);
    });
  }
}

initSettings();

// ---- Downloaded Models Manager (Settings) ---------------------------------

async function renderDownloadedModels() {
  const list = document.getElementById("downloaded-models-list");
  const totalSizeEl = document.getElementById("models-total-size");
  if (!list) return;

  try {
    const models = await invoke("list_models");
    const downloaded = models.filter((m) => m.downloaded);

    if (downloaded.length === 0) {
      list.innerHTML = '<p class="placeholder-text">No models downloaded yet.</p>';
      if (totalSizeEl) totalSizeEl.textContent = "";
      return;
    }

    // Compute total size
    const totalBytes = downloaded.reduce((sum, m) => sum + (m.file_size_bytes || 0), 0);
    if (totalSizeEl) {
      totalSizeEl.textContent = `Total: ${formatFileSize(totalBytes)}`;
    }

    list.innerHTML = "";
    downloaded.forEach((model) => {
      const row = document.createElement("div");
      row.className = "model-manager-row";
      row.dataset.modelName = model.name;

      const info = document.createElement("div");
      info.className = "model-manager-info";

      const name = document.createElement("span");
      name.className = "model-manager-name";
      name.textContent = model.name;

      const meta = document.createElement("span");
      meta.className = "model-manager-meta";
      const sizeOnDisk = model.file_size_bytes
        ? formatFileSize(model.file_size_bytes)
        : model.size;
      meta.textContent = sizeOnDisk;

      info.appendChild(name);
      info.appendChild(meta);

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn-danger btn-sm model-delete-btn";
      deleteBtn.textContent = "Delete";
      deleteBtn.title = `Delete ${model.name} model`;
      deleteBtn.addEventListener("click", () => deleteDownloadedModel(model.name, row));

      row.appendChild(info);
      row.appendChild(deleteBtn);
      list.appendChild(row);
    });
  } catch (err) {
    list.innerHTML = `<p style="color: var(--color-error); font-size: 0.85rem;">Failed to load models: ${escapeHtml(String(err))}</p>`;
  }
}

async function deleteDownloadedModel(modelName, rowEl) {
  // Visual confirmation
  const deleteBtn = rowEl.querySelector(".model-delete-btn");
  if (deleteBtn.dataset.confirming === "true") {
    // Second click — confirmed, proceed with deletion
    deleteBtn.disabled = true;
    deleteBtn.textContent = "Deleting...";
    rowEl.classList.add("model-row-deleting");
    try {
      await invoke("delete_model", { modelName });
      // Animate removal
      rowEl.style.opacity = "0";
      rowEl.style.transform = "translateX(8px)";
      rowEl.style.transition = "opacity 200ms ease, transform 200ms ease";
      setTimeout(() => {
        rowEl.remove();
        // Re-render to update total size & empty state
        renderDownloadedModels();
        // Refresh main model picker too
        loadModels();
      }, 220);
    } catch (err) {
      deleteBtn.disabled = false;
      deleteBtn.textContent = "Delete";
      deleteBtn.dataset.confirming = "false";
      deleteBtn.classList.remove("btn-danger-confirm");
      rowEl.classList.remove("model-row-deleting");
      const errMsg = document.createElement("span");
      errMsg.className = "model-delete-error";
      errMsg.textContent = `Error: ${err}`;
      rowEl.appendChild(errMsg);
      setTimeout(() => errMsg.remove(), 3000);
    }
  } else {
    // First click — ask for confirmation in-place
    deleteBtn.dataset.confirming = "true";
    deleteBtn.textContent = "Confirm?";
    deleteBtn.classList.add("btn-danger-confirm");
    // Auto-reset after 10 s
    setTimeout(() => {
      if (deleteBtn.dataset.confirming === "true") {
        deleteBtn.dataset.confirming = "false";
        deleteBtn.textContent = "Delete";
        deleteBtn.classList.remove("btn-danger-confirm");
      }
    }, 10000);
  }
}

function formatFileSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  } else if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  } else {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
}

// Render models when navigating to Settings page
navItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.page === "settings") {
      renderDownloadedModels();
    }
  });
});

document.getElementById("open-models-dir-btn")?.addEventListener("click", async () => {
  try {
    await invoke("open_models_dir");
  } catch (err) {
    console.error("Failed to open models directory:", err);
  }
});

// ---- Update Check ---------------------------------------------------------

const checkUpdateBtn = document.getElementById("check-update-btn");
const updateStatus = document.getElementById("update-status");

if (checkUpdateBtn) {
  checkUpdateBtn.addEventListener("click", checkForUpdates);
}

async function checkForUpdates() {
  checkUpdateBtn.disabled = true;
  checkUpdateBtn.textContent = "Checking...";
  updateStatus.classList.add("hidden");

  try {
    const response = await fetch("https://api.github.com/repos/kylethedeveloper/OratioText/releases/latest");
    if (!response.ok) throw new Error("Failed to check for updates");
    const data = await response.json();

    // Tag names typically have a 'v' prefix, e.g. 'v1.0.1'. Clean it up easily:
    const latestVersion = data.tag_name.replace(/^v/, '');
    const currentVersion = await invoke("get_app_version");

    const isNewer = compareVersions(latestVersion, currentVersion) > 0;

    updateStatus.classList.remove("hidden");
    if (isNewer) {
      updateStatus.textContent = "⚠ Newer version available!";
      updateStatus.style.color = "var(--color-warning)";
      updateStatus.style.pointerEvents = "auto";
      updateStatus.style.cursor = "pointer";
    } else {
      updateStatus.textContent = "☑ App up to date!";
      updateStatus.style.color = "var(--color-success)";
      updateStatus.style.pointerEvents = "none";
      updateStatus.style.cursor = "default";
    }
  } catch (err) {
    console.error("Update check failed", err);
    updateStatus.textContent = "Failed to check update.";
    updateStatus.style.color = "var(--color-error)";
    updateStatus.classList.remove("hidden");
  } finally {
    checkUpdateBtn.disabled = false;
    checkUpdateBtn.textContent = "Check for updates";
  }
}

function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const n1 = parts1[i] || 0;
    const n2 = parts2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}
