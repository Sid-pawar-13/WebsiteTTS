const provider = document.getElementById("provider");
const apiKeyGroup = document.getElementById("apiKeyGroup");
const providerHelp = document.getElementById("providerHelp");
const statusEl = document.getElementById("settingsStatus");
const testButton = document.getElementById("test");
const saveButton = document.getElementById("save");
const FIELDS = ["endpoint", "model", "voice", "apiKey"];

const DEFAULTS = {
  ollama: {
    endpoint: "http://localhost:11434/v1",
    model: "phonon",
    voice: "default",
    apiKey: "ollama"
  },
  openai: {
    endpoint: "https://api.openai.com/v1",
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    apiKey: ""
  }
};

let providerSettings = {
  ollama: { ...DEFAULTS.ollama },
  openai: { ...DEFAULTS.openai }
};

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = "status" + (type ? " " + type : "");
}

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

function updateProviderHelp() {
  const local = provider.value === "ollama";
  apiKeyGroup.hidden = local;
  providerHelp.textContent = local
    ? "Phonon returns WAV audio. Use http://localhost:11434/v1, model phonon and voice default. On macOS, run the OLLAMA_ORIGINS command shown below before launching Ollama."
    : "Uses the OpenAI-compatible POST /audio/speech endpoint and expects MP3 audio. An API key is required.";
}

function showProvider(name) {
  provider.value = name;
  writeForm(providerSettings[name] || DEFAULTS[name]);
  updateProviderHelp();
}

function validateConfig(values, providerName) {
  if (!values.endpoint || !values.model || !values.voice) {
    throw new Error("API URL, model and voice are required.");
  }
  if (providerName === "openai" && !values.apiKey) {
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
}

function speechUrl(endpoint) {
  const value = endpoint.trim().replace(/\/+$/, "");
  return value.endsWith("/audio/speech") ? value : value + "/audio/speech";
}

async function testConfiguration(values, providerName) {
  validateConfig(values, providerName);
  const headers = { "Content-Type": "application/json" };
  if (values.apiKey) headers.Authorization = "Bearer " + values.apiKey;

  const body = {
    model: values.model,
    input: "Hi! This is a test.",
    voice: values.voice,
    response_format: providerName === "ollama" ? "wav" : "mp3"
  };
  if (providerName === "openai") body.speed = 1;

  let response;
  try {
    response = await fetch(speechUrl(values.endpoint), {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
  } catch (error) {
    if (providerName === "ollama") {
      throw new Error("Could not connect to Ollama. Check that it is running and allows this extension in OLLAMA_ORIGINS. " + error.message);
    }
    throw new Error("Could not connect to the TTS API: " + error.message);
  }

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error("TTS API error (" + response.status + "): " + (detail || response.statusText));
  }

  const audio = await response.arrayBuffer();
  if (!audio.byteLength) {
    throw new Error("The API responded successfully but returned an empty audio file.");
  }

  const responseType = response.headers.get("content-type") || "";
  if (providerName === "ollama") {
    const signature = new TextDecoder().decode(new Uint8Array(audio, 0, Math.min(4, audio.byteLength)));
    if (signature !== "RIFF") {
      throw new Error("Ollama did not return a valid WAV file. Check that Phonon is selected and response_format is wav.");
    }
  } else if (responseType && !responseType.toLowerCase().startsWith("audio/") &&
      !responseType.toLowerCase().includes("application/octet-stream")) {
    throw new Error("The API returned " + responseType + " instead of audio. Check the model and speech endpoint.");
  }

  return {
    bytes: audio.byteLength,
    contentType: providerName === "ollama" ? "audio/wav" : (responseType || "audio/mpeg")
  };
}

async function runTest() {
  const providerName = provider.value;
  const values = readForm();
  testButton.disabled = true;
  saveButton.disabled = true;
  setStatus("Sending test prompt to " + (providerName === "ollama" ? "Ollama" : "the API") + "…");
  try {
    const result = await testConfiguration(values, providerName);
    setStatus("API test successful. Received " + result.bytes.toLocaleString() + " bytes of " + result.contentType + " audio.", "success");
    return { providerName, values };
  } catch (error) {
    setStatus("API test failed: " + (error.message || "Unknown error"), "error");
    throw error;
  } finally {
    testButton.disabled = false;
    saveButton.disabled = false;
  }
}

async function testOnly() {
  try {
    await runTest();
  } catch {
    // The error is already shown in the settings status.
  }
}

async function saveConfiguration() {
  let tested;
  try {
    tested = await runTest();
  } catch {
    return;
  }

  saveButton.disabled = true;
  testButton.disabled = true;
  try {
    const nextSettings = {
      ...providerSettings,
      [tested.providerName]: { ...tested.values }
    };
    await chrome.storage.local.set({
      provider: tested.providerName,
      providerSettings: nextSettings
    });

    const verified = await chrome.storage.local.get(["provider", "providerSettings"]);
    const savedConfig = verified.providerSettings?.[tested.providerName];
    const mismatchedFields = FIELDS.filter(field =>
      savedConfig?.[field] !== tested.values[field]
    );
    if (verified.provider !== tested.providerName || mismatchedFields.length > 0) {
      const detail = mismatchedFields.length
        ? "Fields not retained: " + mismatchedFields.join(", ") + "."
        : "The selected provider was not retained.";
      throw new Error("Chrome storage verification failed. " + detail);
    }

    providerSettings = nextSettings;
    setStatus("API test passed and configuration saved successfully.", "success");
  } catch (error) {
    setStatus("Could not save configuration: " + (error.message || "Unknown storage error"), "error");
  } finally {
    saveButton.disabled = false;
    testButton.disabled = false;
  }
}

async function loadSettings() {
  try {
    const stored = await chrome.storage.local.get(null);
    const selectedProvider = stored.provider === "ollama" ? "ollama" : "openai";
    const savedProviders = stored.providerSettings || {};

    providerSettings = {
      ollama: { ...DEFAULTS.ollama, ...(savedProviders.ollama || {}) },
      openai: { ...DEFAULTS.openai, ...(savedProviders.openai || {}) }
    };

    // Migrate existing installations that used flat settings in storage.
    if (!savedProviders[selectedProvider] && FIELDS.some(field => stored[field] !== undefined)) {
      providerSettings[selectedProvider] = {
        ...DEFAULTS[selectedProvider],
        ...Object.fromEntries(FIELDS.map(field => [
          field,
          stored[field] !== undefined ? stored[field] : DEFAULTS[selectedProvider][field]
        ]))
      };
      await chrome.storage.local.set({ providerSettings });
    }

    showProvider(selectedProvider);
    setStatus("Saved configuration loaded.");
  } catch (error) {
    setStatus("Could not load settings: " + (error.message || "Unknown storage error"), "error");
  }
}

provider.addEventListener("change", () => {
  showProvider(provider.value);
  setStatus("Provider changed. Test the API before saving this configuration.");
});
testButton.addEventListener("click", testOnly);
saveButton.addEventListener("click", saveConfiguration);

loadSettings();
