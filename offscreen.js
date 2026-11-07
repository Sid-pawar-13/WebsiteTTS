let currentAudio = null;
let currentUrl = null;
let currentSendResponse = null;
let playbackId = 0;

function stopPlayback() {
  playbackId++;

  // Resolve the previous play request when playback is interrupted. Without
  // this, the content script can remain awaiting a response forever.
  if (currentSendResponse) {
    currentSendResponse({ ok: true, stopped: true });
    currentSendResponse = null;
  }

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.removeAttribute("src");
    currentAudio.load();
    currentAudio = null;
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== "offscreen") return;
  if (message.type === "stop") {
    stopPlayback();
    sendResponse({ ok: true });
    return;
  }
  if (message.type !== "play") return;

  stopPlayback();
  const id = playbackId;
  currentSendResponse = sendResponse;

  (async () => {
    try {
      const binary = atob(message.audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: message.contentType || "audio/wav" });
      currentUrl = URL.createObjectURL(blob);
      const player = new Audio(currentUrl);
      currentAudio = player;
      await new Promise((resolve, reject) => {
        player.onended = resolve;
        player.onerror = () => reject(new Error(
          "Audio decode failed (MediaError " + (player.error?.code ?? "unknown") + ")."
        ));
        player.play().catch(reject);
      });

      if (id === playbackId && currentSendResponse === sendResponse) {
        currentSendResponse = null;
        sendResponse({ ok: true });
      }
    } catch (error) {
      if (id === playbackId && currentSendResponse === sendResponse) {
        currentSendResponse = null;
        sendResponse({ error: error.message || "Audio playback failed." });
      }
    } finally {
      if (id === playbackId) stopPlayback();
    }
  })();
  return true;
});
