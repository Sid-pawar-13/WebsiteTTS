# WebsiteTTS

A Chrome Manifest V3 extension that reads webpage content aloud using either local Ollama Phonon or an OpenAI-compatible TTS API. It highlights the current paragraph and automatically scrolls as it reads.

## Features
- Start / stop reading; forward / backward by paragraph
- Automatic scrolling and paragraph highlighting
- Adjustable playback speed (0.7×–2.0×)
- Dedicated settings page for Ollama and OpenAI-compatible providers
- Test API with a short "Hi! This is a test." prompt before saving
- Persistent light/dark theme across the popup and settings page
- Ollama Phonon WAV playback and OpenAI-compatible MP3 playback

## Configure TTS

1. Click the WebsiteTTS extension icon.
2. Click the gear icon or **Configure TTS provider and API**.
3. Choose **Ollama (local / Phonon)** or **OpenAI-compatible API**.
4. Enter the API URL, model and voice. Enter an API key for OpenAI-compatible providers.
5. Click **Test API** to check the configuration, or **Save configuration** to test and save in one step. A configuration is saved only after the test succeeds.

Each provider's configuration is stored separately, so switching providers does not overwrite the other provider's settings.

## Use local Ollama Phonon

1. Install Ollama 0.40.9 or later.
2. On macOS, open Terminal and run this command **before launching Ollama**:
   ```bash
   launchctl setenv OLLAMA_ORIGINS "chrome-extension://*"
   ```
3. If Ollama is already running, fully quit it and launch it again so it inherits the environment variable. You may need to repeat the command after logging in again.
4. Start Ollama and pull Phonon:
   ```bash
   ollama pull phonon
   ```
5. In WebsiteTTS settings, select **Ollama (local / Phonon)**.
6. Defaults: URL `http://localhost:11434/v1`, model `phonon`, voice `default`. No API key is required.

Ollama's `POST /v1/audio/speech` returns WAV audio by default (24 kHz, mono). The extension explicitly requests WAV. Phonon currently supports API speed `1` only, so the extension applies the speed slider during browser playback instead.

The `chrome-extension://*` origin pattern allows Chrome extensions to connect to Ollama. For tighter security, allow only this extension's specific `chrome-extension://<extension-id>` origin. See the [Ollama CORS FAQ](https://github.com/ollama/ollama/blob/main/docs/faq.mdx#how-do-i-allow-additional-web-origins-to-access-ollama).

**Platform note:** The command above is for macOS. The current Phonon model page specifies Apple Silicon and Ollama 0.40.9 or later. Check the [Phonon library page](https://ollama.com/library/phonon) for current OS support.

## Use an OpenAI-compatible provider

Select **OpenAI-compatible API**, then enter API base URL, model, voice and API key. The extension appends `/audio/speech` unless you provide the full endpoint. It requests MP3 and sends the speed parameter.

## Audio file lifecycle

Generated speech is kept in memory; WebsiteTTS does not save section audio as a file on disk. The background worker converts the API response to base64 and passes it to the offscreen audio document. The offscreen document reconstructs a Blob, creates a temporary object URL, and plays it.

After playback ends, or when playback is stopped/replaced or fails, the audio element is cleared and the object URL is revoked. The API test player follows the same cleanup pattern, including when a new test replaces a clip that is still playing or the settings page is closed.

Each section is synthesized when it is about to be read. A newer section does not overwrite a persistent audio file because no persistent audio file is created.

## UI theme

Use the moon/sun control in the popup or settings page to switch between light and dark themes. The selected theme is stored in Chrome extension storage and shared by both pages.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the folder containing `manifest.json`.
3. After updating files, click **Reload** on the extension card.

No build step is required.

## Package

- macOS/Linux: `zip -r WebsiteTTS.zip manifest.json background.js offscreen.html offscreen.js popup.html popup.css popup.js options.html options.css options.js content.js README.md`
- Windows PowerShell: `Compress-Archive -Path manifest.json,background.js,offscreen.html,offscreen.js,popup.html,popup.css,popup.js,options.html,options.css,options.js,content.js,README.md -DestinationPath WebsiteTTS.zip`

## API key security

OpenAI-compatible API keys are stored in `chrome.storage.local`. This is not a secure secret vault; someone with access to your browser profile or extension developer tools may retrieve the key. For shared or production use, put the key behind a private backend/proxy.

## Review notes

- Speech-generation requests now time out rather than waiting indefinitely (120 seconds during reading; 60 seconds for the settings test).
- Successful HTTP responses are checked for an audio content type for OpenAI-compatible providers, reducing confusing decode failures when a proxy returns an HTML page with status 200.
- Navigation checks the playback generation after asynchronous frame discovery, so a Stop command issued during discovery is not followed by a stale Start/Next operation.
- The extension still requests access to all URLs and injects a content script into matching frames because its core feature is reading arbitrary webpages, including embedded lesson content. This is broad access; users should install it only if they trust the extension source.
- The popup currently waits for a reading/navigation command to finish before its status text is refreshed. A future improvement would be to move playback status to push updates so the popup can remain responsive and show live progress.
- Text extraction is heuristic. Repeated identical paragraphs may be deduplicated, and complex pages can contain navigation or duplicated nested text; page-specific extraction rules may be needed for some sites.

## Limitations

Chrome blocks extensions on internal pages and some browser-owned viewers. The extension reads text rendered in the page DOM; inaccessible cross-origin frames and browser PDF viewer content may not be available.
