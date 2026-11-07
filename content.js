(() => {
  if (window.__websiteTTSLoaded) return;
  window.__websiteTTSLoaded = true;

  let blocks = [];
  let index = 0;
  let rate = 1;
  let speaking = false;
  let finished = false;
  let audio = null;
  let runId = 0;
  const highlightClass = "website-tts-current";

  const status = () => ({ speaking, finished, index, total: blocks.length });

  function clearHighlight() {
    document.querySelectorAll("." + highlightClass).forEach(el => el.classList.remove(highlightClass));
  }

  function collectTextBlocks() {
    const preferred = [...document.querySelectorAll(
      "main p, article p, main h1, main h2, main h3, article h1, article h2, article h3, main li, article li, main blockquote, article blockquote"
    )];
    const candidates = preferred.length
      ? preferred
      : [...document.querySelectorAll("p,h1,h2,h3,h4,li,blockquote,[role='listitem']")];

    const seen = new Set();
    return candidates.filter(el => {
      const text = el.innerText?.trim();
      const rect = el.getBoundingClientRect();
      if (!text || text.length < 2 || !rect.width || !rect.height ||
          el.closest("nav,header,footer,aside,[aria-hidden='true']") || seen.has(text)) return false;
      seen.add(text);
      return true;
    });
  }

  function splitText(text, maxLength = 2800) {
    const sentences = text.match(/[^.!?。！？]+[.!?。！？]?/g) || [text];
    const chunks = [];
    let chunk = "";
    for (const sentence of sentences) {
      if (chunk && (chunk.length + sentence.length > maxLength)) {
        chunks.push(chunk.trim());
        chunk = "";
      }
      if (sentence.length > maxLength) {
        for (let offset = 0; offset < sentence.length; offset += maxLength) {
          if (chunk) { chunks.push(chunk.trim()); chunk = ""; }
          chunks.push(sentence.slice(offset, offset + maxLength).trim());
        }
      } else {
        chunk += sentence;
      }
    }
    if (chunk.trim()) chunks.push(chunk.trim());
    return chunks.filter(Boolean);
  }

  function stop() {
    runId++;
    if (audio) {
      audio = null;
    }
    chrome.runtime.sendMessage({ type: "website-tts:stop" }).catch(() => {});
    speaking = false;
    clearHighlight();
  }

  function requestAudio(text, token) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: "website-tts:synthesize", text, rate },
        response => {
          const error = chrome.runtime.lastError;
          if (error) return reject(new Error(error.message));
          if (token !== runId) return reject(new Error("Playback stopped."));
          if (response?.error) return reject(new Error(response.error));
          if (!response?.audioBase64 || !response?.contentType) return reject(new Error("The TTS API returned an incomplete audio response."));
          resolve({ audioBase64: response.audioBase64, contentType: response.contentType });
        }
      );
    });
  }

  function playAudio(payload, token) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: "website-tts:play", audioBase64: payload.audioBase64, contentType: payload.contentType },
        response => {
          const error = chrome.runtime.lastError;
          if (error) return reject(new Error(error.message));
          if (token !== runId) return resolve();
          if (response?.error) return reject(new Error(response.error));
          resolve();
        }
      );
    });
  }

  async function speakParagraph(nextIndex) {
    if (!blocks.length) return { error: "No readable text found on this page.", status: status() };
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= blocks.length) {
      stop();
      finished = true;
      index = blocks.length - 1;
      return { status: status() };
    }

    stop();
    const token = runId;
    index = nextIndex;
    finished = false;
    speaking = true;
    const element = blocks[index];
    clearHighlight();
    element.classList.add(highlightClass);
    element.scrollIntoView({ behavior: "smooth", block: "center" });

    try {
      const chunks = splitText(element.innerText.trim());
      for (const chunk of chunks) {
        if (token !== runId) return { status: status() };
        const audioPayload = await requestAudio(chunk, token);
        if (token !== runId) return { status: status() };
        await playAudio(audioPayload, token);
      }
      if (token !== runId) return { status: status() };
      if (index + 1 < blocks.length) return speakParagraph(index + 1);
      speaking = false;
      finished = true;
      clearHighlight();
      return { status: status() };
    } catch (error) {
      if (token === runId) {
        speaking = false;
        clearHighlight();
        console.error("WebsiteTTS:", error);
        return { error: error.message, status: status() };
      }
      return { status: status() };
    }
  }

  const style = document.createElement("style");
  style.textContent = "." + highlightClass +
    "{outline:3px solid #f2c94c!important;outline-offset:4px!important;" +
    "background:rgba(255,230,120,.25)!important;border-radius:3px!important;" +
    "scroll-margin-top:100px!important}";
  (document.head || document.documentElement).appendChild(style);

  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message.rate) {
      rate = Math.min(2, Math.max(0.7, Number(message.rate) || rate));
      if (audio) audio.playbackRate = rate;
    }

    if (message.command === "start") {
      blocks = collectTextBlocks();
      speakParagraph(finished ? 0 : index).then(reply);
    } else if (message.command === "stop") {
      stop();
      finished = false;
      reply({ status: status() });
    } else if (message.command === "forward") {
      speakParagraph(index + 1).then(reply);
    } else if (message.command === "backward") {
      speakParagraph(Math.max(0, index - 1)).then(reply);
    } else if (message.command === "setRate" || message.command === "getStatus") {
      reply({ status: status() });
    }
    return true;
  });
})();