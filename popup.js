const statusEl = document.getElementById("status");
const rate = document.getElementById("rate");
const provider = document.getElementById("provider");
const settingsStatus = document.getElementById("settingsStatus");
const providerHelp = document.getElementById("providerHelp");
const apiKeyGroup = document.getElementById("apiKeyGroup");
const saveButton = document.getElementById("save");

const DEFAULTS = {
  ollama: { endpoint: "http://localhost:11434/v1", model: "phonon", voice: "default", apiKey: "ollama" },
  openai: { endpoint: "https://api.openai.com/v1", model: "gpt-4o-mini-tts", voice: "alloy", apiKey: "" }
};

const FIELDS = ["endpoint", "model", "voice", "apiKey"];
let providerSettings = {
  ollama: { ...DEFAULTS.ollama },
  openai: { ...DEFAULTS.openai }
};

function readForm() {
  return Object.fromEntries(FIELDS.map(field => [
    field,
    document.getElementById(field).value.trim()
  ]));
}

function writeForm(values) {
  for (const field of FIELDS) {
    document.getElementById(field).value = values[field] ?? "";
  }
}

function showProviderHelp() {
  const local = provider.value === "ollama";
  apiKeyGroup.hidden = local;
  providerHelp.textContent = local
    ? "Phonon returns WAV audio. The API speed is fixed at 1; the slider changes playback speed. Ollama must allow this extension in OLLAMA_ORIGINS."
    : "Uses /audio/speech and MP3 output. An API key is required.";
}

function showProviderSettings(providerName) {
  provider.value = providerName;
  writeForm(providerSettings[providerName] || DEFAULTS[providerName]);
  showProviderHelp();
}

async function persistProviderDraft(providerName, values) {
  providerSettings[providerName] = { ...values };
  await chrome.storage.local.set({
    providerSettings: {
      ...providerSettings,
      [providerName]: { ...values }
    }
  });
}

async function loadSettings() {
  try {
    const stored = await chrome.storage.local.get(null);
    const selectedProvider = stored.provider === "ollama" ? "ollama" : "openai";
    const savedProviders = stored.providerSettings || {};

    // Read the new per-provider structure. Migrate existing flat settings
    // into the provider that was selected when those settings were saved.
    providerSettings = {
      ollama: { ...DEFAULTS.ollama, ...(savedProviders.ollama || {}) },
      openai: { ...DEFAULTS.openai, ...(savedProviders.openai || {}) }
    };

    if (!savedProviders[selectedProvider] && FIELDS.some(field =>
      stored[field] !== undefined && stored[field] !== DEFAULTS.openai[field]
    )) {
      providerSettings[selectedProvider] = {
        ...DEFAULTS[selectedProvider],
        ...Object.fromEntries(FIELDS.map(field => [
          field,
          stored[field] !== undefined ? stored[field] : DEFAULTS[selectedProvider][field]
        ]))
      };
      await chrome.storage.local.set({ providerSettings });
    }

    showProviderSettings(selectedProvider);
    rate.value = String(stored.speed ?? 1);
    document.getElementById("rateValue").value = Number(rate.value).toFixed(1) + "×";
    settingsStatus.textContent = "Settings loaded.";
  } catch (error) {
    settingsStatus.textContent = "Could not load settings: " + error.message;
  }
}

async function saveSettings() {
  saveButton.disabled = true;
  settingsStatus.textContent = "Saving settings…";
  try {
    const selectedProvider = provider.value;
    const values = readForm();

    if (!values.endpoint || !values.model || !values.voice) {
      throw new Error("API URL, model and voice are required.");
    }
    if (selectedProvider === "openai" && !values.apiKey) {
      throw new Error("API key is required for the OpenAI-compatible provider.");
    }

    let parsed;
    try {
      parsed = new URL(values.endpoint);
    } catch {
      throw new Error("Enter a valid API URL, including http:// or https://.");
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("API URL must start with http:// or https://.");
    }

    const nextProviders = {
      ...providerSettings,
      [selectedProvider]: { ...values }
    };
    const payload = {
      provider: selectedProvider,
      providerSettings: nextProviders,
      // Keep flat fields for compatibility with older extension versions.
      ...values,
      speed: Number(rate.value)
    };

    await chrome.storage.local.set(payload);
    const saved = await chrome.storage.local.get(Object.keys(payload));
    for (const key of Object.keys(payload)) {
      if (JSON.stringify(saved[key]) !== JSON.stringify(payload[key])) {
        throw new Error("Settings could not be verified after saving.");
      }
    }

    providerSettings = nextProviders;
    settingsStatus.textContent = "Settings saved and verified.";
  } catch (error) {
    settingsStatus.textContent = "Save failed: " + (error.message || "Unknown storage error");
  } finally {
    saveButton.disabled = false;
  }
}

async function changeProvider() {
  const nextProvider = provider.value;
  const previousProvider = nextProvider === "ollama" ? "openai" : "ollama";
  try {
    // Preserve edits to the previous provider even if Save was not clicked.
    await persistProviderDraft(previousProvider, readForm());
    showProviderSettings(nextProvider);
    settingsStatus.textContent = "Loaded saved " +
      (nextProvider === "ollama" ? "Ollama" : "OpenAI-compatible") +
      " settings. Click Save settings to make them active.";
  } catch (error) {
    settingsStatus.textContent = "Could not switch provider: " + error.message;
    showProviderSettings(previousProvider);
  }
}

async function send(command) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    const result = await chrome.tabs.sendMessage(tab.id, {
      command,
      rate: Number(rate.value)
    });
    if (result?.status) {
      const s = result.status;
      statusEl.textContent = s.speaking
        ? "Reading paragraph " + (s.index + 1) + " of " + s.total
        : s.finished ? "Finished reading" : "Ready to read";
    }
    if (result?.error) statusEl.textContent = result.error;
  } catch {
    statusEl.textContent = "This page cannot be read. Refresh the page and try again.";
  }
}

provider.addEventListener("change", changeProvider);
saveButton.addEventListener("click", saveSettings);
document.getElementById("start").onclick = () => send("start");
document.getElementById("stop").onclick = () => send("stop");
document.getElementById("forward").onclick = () => send("forward");
document.getElementById("backward").onclick = () => send("backward");
rate.oninput = () => {
  document.getElementById("rateValue").value = Number(rate.value).toFixed(1) + "×";
  send("setRate");
};

loadSettings();
send("getStatus");
