const statusEl = document.getElementById("status");
const rate = document.getElementById("rate");
const settingsStatus = document.getElementById("settingsStatus");
const fields = ["endpoint", "model", "voice", "apiKey"];

async function loadSettings() {
  const values = await chrome.storage.local.get({
    endpoint: "https://api.openai.com/v1",
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    apiKey: "",
    speed: 1
  });
  for (const field of fields) document.getElementById(field).value = values[field] || "";
  rate.value = values.speed || 1;
  document.getElementById("rateValue").value = Number(rate.value).toFixed(1) + "×";
  settingsStatus.textContent = values.apiKey ? "TTS settings loaded." : "Add your API details, then save.";
}

async function send(command) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    const result = await chrome.tabs.sendMessage(tab.id, { command, rate: Number(rate.value) });
    if (result?.status) {
      const s = result.status;
      statusEl.textContent = s.speaking
        ? "Reading paragraph " + (s.index + 1) + " of " + s.total
        : s.finished ? "Finished reading" : "Ready to read";
    }
    if (result?.error) statusEl.textContent = result.error;
  } catch (error) {
    statusEl.textContent = "This page cannot be read. Refresh the page and try again.";
  }
}

document.getElementById("save").addEventListener("click", async () => {
  const values = {};
  for (const field of fields) values[field] = document.getElementById(field).value.trim();
  values.speed = Number(rate.value);
  if (!values.endpoint || !values.model || !values.voice || !values.apiKey) {
    settingsStatus.textContent = "Please complete all four settings.";
    return;
  }
  await chrome.storage.local.set(values);
  settingsStatus.textContent = "Settings saved. Ready to use.";
});

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