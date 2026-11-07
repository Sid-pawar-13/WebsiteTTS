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

async function ensureAudioDocument() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Play generated speech audio outside the webpage context."
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message?.type === "website-tts:collect-frames") {
    (async () => {
      const tabId = sender.tab?.id;
      if (tabId == null) throw new Error("Could not identify the active tab.");
      const frames = await chrome.webNavigation.getAllFrames({ tabId }) || [];
      const collected = await Promise.all(frames.map(async frame => {
        try {
          const result = await chrome.tabs.sendMessage(
            tabId,
            { command: "websiteTTS:collectFrame" },
            { frameId: frame.frameId }
          );
          return { frameId: frame.frameId, count: result?.count || 0 };
        } catch {
          return null;
        }
      }));
      sendResponse({ frames: collected.filter(frame => frame && frame.count > 0) });
    })().catch(error => sendResponse({ error: error.message || "Could not inspect page frames." }));
    return true;
  }

  if (message?.type === "website-tts:frame-command") {
    (async () => {
      const tabId = sender.tab?.id;
      if (tabId == null) throw new Error("Could not identify the active tab.");
      const result = await chrome.tabs.sendMessage(
        tabId,
        { command: message.command, index: message.index, rate: message.rate },
        { frameId: message.frameId }
      );
      sendResponse(result || { ok: true });
    })().catch(error => sendResponse({ error: error.message || "Could not control the page frame." }));
    return true;
  }

  if (message?.type === "website-tts:stop-all-frames" || message?.type === "website-tts:set-frame-rate") {
    (async () => {
      const tabId = sender.tab?.id;
      if (tabId == null) return sendResponse({ ok: true });
      const frames = await chrome.webNavigation.getAllFrames({ tabId }) || [];
      await Promise.all(frames.map(frame =>
        chrome.tabs.sendMessage(
          tabId,
          { command: message.type === "website-tts:stop-all-frames" ? "websiteTTS:stopFrame" : "websiteTTS:setFrameRate", rate: message.rate },
          { frameId: frame.frameId }
        ).catch(() => {})
      ));
      sendResponse({ ok: true });
    })().catch(error => sendResponse({ error: error.message || "Could not update page frames." }));
    return true;
  }
  if (message?.type === "website-tts:play" || message?.type === "website-tts:stop") {
    (async () => {
      await ensureAudioDocument();
      const payload = message.type === "website-tts:stop"
        ? { target: "offscreen", type: "stop" }
        : { target: "offscreen", type: "play", audioBase64: message.audioBase64, contentType: message.contentType };
      const result = await chrome.runtime.sendMessage(payload);
      sendResponse(result || { ok: true });
    })().catch(error => sendResponse({ error: error.message || "Audio playback failed." }));
    return true;
  }
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

    // Phonon returns WAV. Some Ollama/proxy configurations report a generic
    // content type, which can prevent Chrome's Audio element from decoding it.
    let contentType = response.headers.get("content-type") || "";
    if (provider === "ollama") {
      const signature = new TextDecoder().decode(new Uint8Array(audioBuffer, 0, Math.min(4, audioBuffer.byteLength)));
      if (signature !== "RIFF") {
        throw new Error(`Ollama did not return a WAV file (received ${contentType || "unknown content type"}). Check that the selected model is Phonon and response_format is wav.`);
      }
      contentType = "audio/wav";
    } else {
      contentType = contentType || "audio/mpeg";
    }
    sendResponse({ audioBase64: toBase64(audioBuffer), contentType });
  })().catch(error => sendResponse({ error: error.message || "Unable to generate speech." }));
  return true;
});