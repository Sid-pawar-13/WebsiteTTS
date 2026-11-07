const PROVIDER_DEFAULTS = {
  openai: { endpoint: "https://api.openai.com/v1", model: "gpt-4o-mini-tts", voice: "alloy", apiKey: "" },
  ollama: { endpoint: "http://localhost:11434/v1", model: "phonon", voice: "default", apiKey: "ollama" }
};

function speechUrl(endpoint) {
  const value = endpoint.trim().replace(/\/+$/, "");
  return value.endsWith("/audio/speech") ? value : value + "/audio/speech";
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "website-tts:synthesize") return;
  (async () => {
    const saved = await chrome.storage.local.get({ provider: "openai", ...PROVIDER_DEFAULTS.openai });
    const provider = saved.provider === "ollama" ? "ollama" : "openai";
    const config = { ...PROVIDER_DEFAULTS[provider], ...saved };
    if (!config.endpoint?.trim()) throw new Error("Enter the TTS API base URL in settings.");
    if (!config.model?.trim()) throw new Error("Enter a TTS model name in settings.");
    if (provider === "openai" && !config.apiKey?.trim()) throw new Error("Enter your API key in TTS settings.");

    let url;
    try {
      url = new URL(speechUrl(config.endpoint));
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid protocol");
    } catch {
      throw new Error("Invalid API URL. Use a complete http:// or https:// URL.");
    }

    const body = {
      model: config.model.trim(),
      input: String(message.text || ""),
      voice: config.voice?.trim() || PROVIDER_DEFAULTS[provider].voice,
      response_format: provider === "ollama" ? "wav" : "mp3"
    };
    if (provider === "openai") body.speed = Math.min(2, Math.max(0.7, Number(message.rate) || 1));

    const headers = { "Content-Type": "application/json" };
    if (config.apiKey?.trim()) headers.Authorization = `Bearer ${config.apiKey.trim()}`;

    let response;
    try {
      response = await fetch(url.toString(), { method: "POST", headers, body: JSON.stringify(body) });
    } catch (error) {
      if (provider === "ollama") {
        throw new Error("Cannot reach Ollama. Ensure it is running and has allowed this Chrome extension in OLLAMA_ORIGINS. " + error.message);
      }
      throw new Error("Could not connect to the TTS API: " + error.message);
    }
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 600);
      if (provider === "ollama" && response.status === 404) {
        throw new Error("Ollama returned 404. Update Ollama and make sure Phonon is installed (ollama pull phonon).");
      }
      throw new Error(`TTS API error (${response.status}): ${detail || response.statusText}`);
    }
    const audioBuffer = await response.arrayBuffer();
    if (!audioBuffer.byteLength) throw new Error("The TTS API returned an empty audio file.");
    const contentType = response.headers.get("content-type") || (provider === "ollama" ? "audio/wav" : "audio/mpeg");
    sendResponse({ audioUrl: `data:${contentType};base64,${toBase64(audioBuffer)}` });
  })().catch(error => sendResponse({ error: error.message || "Unable to generate speech." }));
  return true;
});