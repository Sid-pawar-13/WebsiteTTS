const statusEl = document.getElementById("status");
const rate = document.getElementById("rate");
const provider = document.getElementById("provider");

async function loadSettings() {
  try {
    const stored = await chrome.storage.local.get(["speed", "provider"]);
    rate.value = String(stored.speed ?? 1);
    provider.value = stored.provider === "ollama" ? "ollama" : "openai";
    updateRateLabel();
  } catch (error) {
    statusEl.textContent = "Could not load settings: " + error.message;
  }
}

function updateRateLabel() {
  document.getElementById("rateValue").value = Number(rate.value).toFixed(1) + "×";
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

function openSettings() {
  chrome.runtime.openOptionsPage();
}

provider.addEventListener("change", async () => {
  try {
    await chrome.storage.local.set({ provider: provider.value });
    statusEl.textContent = "Active provider: " +
      (provider.value === "ollama" ? "Ollama" : "OpenAI-compatible API");
  } catch (error) {
    statusEl.textContent = "Could not change provider: " + error.message;
  }
});

document.getElementById("openSettings").addEventListener("click", openSettings);
document.getElementById("settingsLink").addEventListener("click", openSettings);
document.getElementById("start").addEventListener("click", () => send("start"));
document.getElementById("stop").addEventListener("click", () => send("stop"));
document.getElementById("forward").addEventListener("click", () => send("forward"));
document.getElementById("backward").addEventListener("click", () => send("backward"));

rate.addEventListener("input", () => {
  updateRateLabel();
  send("setRate");
});
rate.addEventListener("change", async () => {
  await chrome.storage.local.set({ speed: Number(rate.value) });
});

loadSettings();
send("getStatus");
