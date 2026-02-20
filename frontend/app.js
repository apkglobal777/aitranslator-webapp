const API_BASE = window.TRANSLATOR_API_BASE || "";
const TRANSLATE_ENDPOINT = `${API_BASE}/api/translate`;
const HISTORY_KEY = "translator_history_v1";
const HISTORY_LIMIT = 10;

const sourceText = document.getElementById("sourceText");
const translatedText = document.getElementById("translatedText");
const translateBtn = document.getElementById("translateBtn");
const clearBtn = document.getElementById("clearBtn");
const copyBtn = document.getElementById("copyBtn");
const swapBtn = document.getElementById("swapBtn");
const statusText = document.getElementById("statusText");
const charCount = document.getElementById("charCount");
const sourceLangLabel = document.getElementById("sourceLangLabel");
const targetLangLabel = document.getElementById("targetLangLabel");
const sourceFieldLabel = document.getElementById("sourceFieldLabel");
const targetFieldLabel = document.getElementById("targetFieldLabel");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const historyList = document.getElementById("historyList");
const historyEmpty = document.getElementById("historyEmpty");
const panel = document.querySelector(".panel");
const chips = Array.from(document.querySelectorAll(".chip"));

const languages = {
  en: "English",
  hi: "Hindi"
};

const statusClasses = [
  "status-ready",
  "status-loading",
  "status-success",
  "status-error",
  "status-warning"
];

const state = {
  sourceLang: "en",
  targetLang: "hi"
};

const setStatus = (message, type = "ready") => {
  statusText.classList.remove(...statusClasses);
  statusText.classList.add(`status-${type}`);
  statusText.textContent = message;
};

const setBusy = (busy) => {
  translateBtn.disabled = busy;
  swapBtn.disabled = busy;
  clearBtn.disabled = busy;
  panel.classList.toggle("loading", busy);
  translateBtn.textContent = busy ? "Translating..." : "Translate";
};

const updateCharCount = () => {
  charCount.textContent = `${sourceText.value.length} / 2000`;
};

const formatTime = (isoTimestamp) => {
  const date = new Date(isoTimestamp);
  return date.toLocaleString();
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");

const getHistory = () => {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveHistory = (items) => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, HISTORY_LIMIT)));
};

const renderHistory = () => {
  const items = getHistory();
  historyList.innerHTML = "";
  historyEmpty.style.display = items.length ? "none" : "block";

  items.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "history-item";
    li.innerHTML = `
      <div class="history-meta">${languages[item.source_lang]} -> ${languages[item.target_lang]} | ${formatTime(item.created_at)}</div>
      <div class="history-row">
        <p class="history-text"><strong>In:</strong> ${escapeHtml(item.source_text)}</p>
        <div class="history-actions">
          <button type="button" class="mini-btn" data-action="reuse" data-index="${index}">Reuse</button>
          <button type="button" class="mini-btn" data-action="copy" data-index="${index}">Copy</button>
        </div>
      </div>
      <p class="history-text"><strong>Out:</strong> ${escapeHtml(item.translated_text)}</p>
    `;
    historyList.appendChild(li);
  });
};

const addHistory = (item) => {
  const current = getHistory();
  const updated = [item, ...current];
  saveHistory(updated);
  renderHistory();
};

const updateLanguageUI = () => {
  sourceLangLabel.textContent = languages[state.sourceLang];
  targetLangLabel.textContent = languages[state.targetLang];
  sourceFieldLabel.textContent = `Input text (${languages[state.sourceLang]})`;
  targetFieldLabel.textContent = `${languages[state.targetLang]} translation`;
  sourceText.placeholder =
    state.sourceLang === "en"
      ? "Type your English sentence here..."
      : "Type your Hindi sentence here...";
  translatedText.placeholder = "Translation appears here...";
  translatedText.style.fontFamily =
    state.targetLang === "hi"
      ? '"Noto Sans Devanagari", "Mangal", sans-serif'
      : '"Space Grotesk", "Segoe UI", sans-serif';
};

const resetOutput = () => {
  translatedText.value = "";
  setStatus("Ready", "ready");
};

const translate = async () => {
  const text = sourceText.value.trim();

  if (!text) {
    setStatus("Enter text before translating.", "error");
    sourceText.focus();
    return;
  }

  setBusy(true);
  setStatus("Sending request...", "loading");

  try {
    const response = await fetch(TRANSLATE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        source_lang: state.sourceLang,
        target_lang: state.targetLang
      })
    });

    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const errBody = await response.json();
        message = errBody.error || message;
      } catch {
        // Keep fallback message when backend does not return JSON.
      }
      throw new Error(message);
    }

    const data = await response.json();
    const output = data.translation || data.translated_text || "";

    if (!output) {
      throw new Error("No translation field in API response");
    }

    translatedText.value = output;
    setStatus("Translated successfully", "success");
    addHistory({
      source_text: text,
      translated_text: output,
      source_lang: state.sourceLang,
      target_lang: state.targetLang,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    setStatus(error.message || "Translation failed", "error");
  } finally {
    setBusy(false);
  }
};

translateBtn.addEventListener("click", translate);

sourceText.addEventListener("input", () => {
  updateCharCount();
  if (!sourceText.value.trim()) {
    resetOutput();
  }
});

sourceText.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    translate();
  }
});

clearBtn.addEventListener("click", () => {
  sourceText.value = "";
  translatedText.value = "";
  updateCharCount();
  setStatus("Ready", "ready");
  sourceText.focus();
});

copyBtn.addEventListener("click", async () => {
  const value = translatedText.value.trim();
  if (!value) {
    setStatus("Nothing to copy yet.", "warning");
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    setStatus("Copied translation to clipboard", "success");
  } catch {
    setStatus("Clipboard blocked by browser", "error");
  }
});

swapBtn.addEventListener("click", () => {
  const nextSource = state.targetLang;
  state.targetLang = state.sourceLang;
  state.sourceLang = nextSource;
  const previousInput = sourceText.value;
  sourceText.value = translatedText.value;
  translatedText.value = previousInput;
  updateLanguageUI();
  updateCharCount();
  setStatus("Languages swapped. Backend may support only en -> hi.", "warning");
});

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    sourceText.value = chip.dataset.sample || "";
    updateCharCount();
    resetOutput();
    sourceText.focus();
  });
});

historyList.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const index = Number(button.dataset.index);
  const items = getHistory();
  const item = items[index];
  if (!item) {
    return;
  }

  if (action === "reuse") {
    state.sourceLang = item.source_lang;
    state.targetLang = item.target_lang;
    sourceText.value = item.source_text;
    translatedText.value = item.translated_text;
    updateLanguageUI();
    updateCharCount();
    setStatus("Loaded from history", "success");
  }

  if (action === "copy") {
    try {
      await navigator.clipboard.writeText(item.translated_text);
      setStatus("Copied history translation", "success");
    } catch {
      setStatus("Clipboard blocked by browser", "error");
    }
  }
});

clearHistoryBtn.addEventListener("click", () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
  setStatus("History cleared", "ready");
});

updateCharCount();
updateLanguageUI();
renderHistory();