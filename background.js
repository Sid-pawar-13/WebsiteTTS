const DEFAULTS = {
  endpoint: "https://api.openai.com/v1",
  model: "gpt-4o-mini-tts",
  voice: "alloy",
  apiKey: "",
  speed: 1
};

function speechUrl(endpoint) {
  const value = endpoint.trim().replace(/\\/+$/, "");
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
    const stored = await chrome.storage.local.get(DEFAULTS);
    const config = { ...DEFAULTS, ...stored };
    if (!config.apiKey) throw new Error("Add your API key in WebsiteTTS settings.");
    if (!config.endpoint.trim()) throw new Error("Add your OpenAI-compatible API endpoint.");
    if (!config.model.trim()) throw new Error("Add a TTS model name.");

    const response = await fetch(speechUrl(config.endpoint), {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model.trim(),
        input: String(message.text || ""),
        voice: config.voice.trim() || "alloy",
        response_format: "mp3",
        speed: Math.min(2, Math.max(0.7, Number(message.rate) || Number(config.speed) || 1))
      })
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 600);
      throw new Error(`TTS API error (${response.status}): ${detail || response.statusText}`);
    }

    const type = response.headers.get("content-type") || "audio/mpeg";
    const base64 = toBase64(await response.arrayBuffer());
    sendResponse({ audioUrl: `data:${type};base64,${base64}` });
  })().catch(error => sendResponse({ error: error.message || "Unable to generate speech." }));

  return true;
});