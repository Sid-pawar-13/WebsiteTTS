# WebsiteTTS

A Chrome Manifest V3 extension that reads webpage content aloud using either local Ollama Phonon or an OpenAI-compatible TTS API. It highlights the current paragraph and automatically scrolls as it reads.

## Features
- Start / stop reading; forward / backward by paragraph
- Automatic scrolling and paragraph highlighting
- Adjustable playback speed (0.7×–2.0×)
- Provider selector: Ollama (local) or OpenAI-compatible API
- Ollama Phonon WAV playback and OpenAI-compatible MP3 playback

## Use local Ollama Phonon
1. Install Ollama 0.40.9 or later and start it.
2. Pull Phonon:
   ```bash
   ollama pull phonon
   ```
3. In the extension, select **Ollama (local / Phonon)**.
4. Defaults: URL `http://localhost:11434/v1`, model `phonon`, voice `default`. No API key is required.
5. Click **Save settings**, then Start on a webpage.

Ollama's `POST /v1/audio/speech` returns WAV audio by default (24 kHz, mono). The extension explicitly requests WAV. Phonon currently supports API speed `1` only, so the extension applies the speed slider during browser playback instead.

### Allow Chrome extension access to Ollama (CORS)
Ollama must allow the extension origin. On macOS, one way to set the variable before restarting the Ollama app is:

```bash
launchctl setenv OLLAMA_ORIGINS "chrome-extension://*"
```

Quit and restart Ollama after setting it. For tighter security, allow only this extension's specific `chrome-extension://<extension-id>` origin. See the [Ollama CORS FAQ](https://github.com/ollama/ollama/blob/main/docs/faq.mdx#how-do-i-allow-additional-web-origins-to-access-ollama).

**Platform note:** The current Phonon model page specifies Apple Silicon and Ollama 0.40.9 or later. Check the [Phonon library page](https://ollama.com/library/phonon) for current OS support.

## Use an OpenAI-compatible provider
Select **OpenAI-compatible API**, then enter API base URL, model, voice and API key. The extension appends `/audio/speech` unless you provide the full endpoint. It requests MP3 and sends the speed parameter.

## Install
1. Download or clone this repository.
2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the folder containing `manifest.json`.
3. After updating files, click **Reload** on the extension card.

No build step is required.

## Package
- macOS/Linux: `zip -r WebsiteTTS.zip manifest.json background.js popup.html popup.css popup.js content.js README.md`
- Windows PowerShell: `Compress-Archive -Path manifest.json,background.js,popup.html,popup.css,popup.js,content.js,README.md -DestinationPath WebsiteTTS.zip`

## API key security
OpenAI-compatible API keys are stored in `chrome.storage.local`. This is not a secure secret vault; someone with access to your browser profile or extension developer tools may retrieve the key. For shared or production use, put the key behind a private backend/proxy.

## Limitations
Chrome blocks extensions on internal pages and some browser-owned viewers. The extension reads text rendered in the page DOM; inaccessible cross-origin frames and browser PDF viewer content may not be available.