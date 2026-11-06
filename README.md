# WebsiteTTS

A Chrome Manifest V3 extension that reads webpage content aloud using an OpenAI-compatible text-to-speech API. It highlights the current paragraph and automatically scrolls as it reads.

## Features
- Start / stop reading
- Forward / backward by paragraph
- Automatic scrolling and paragraph highlighting
- Adjustable playback speed (0.7×–2.0×)
- Configurable OpenAI-compatible `/audio/speech` endpoint, model, voice and API key
- Uses generated MP3 audio; does not use the browser's built-in speech voice

## Configure
1. Load the extension in Chrome (steps below).
2. Open the extension popup and expand **OpenAI-compatible TTS settings**.
3. Enter your API base URL, model, voice and API key.
   - OpenAI example base URL: `https://api.openai.com/v1`
   - The extension appends `/audio/speech`. You may also enter the full endpoint ending in `/audio/speech`.
4. Click **Save settings**.
5. Open a webpage, then use Start, Stop, Forward or Backward.

The request uses the common OpenAI speech schema: `model`, `input`, `voice`, `response_format: "mp3"` and `speed`. Compatibility depends on the provider implementing this schema. Some providers may require a different endpoint, voice name, or request format.

## Install
1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the repository folder containing `manifest.json`.
5. After updating files, click **Reload** on the extension's card.

## Package
No compilation step is required. To create a ZIP:
- macOS/Linux: `zip -r WebsiteTTS.zip manifest.json background.js popup.html popup.css popup.js content.js README.md`
- Windows PowerShell: `Compress-Archive -Path manifest.json,background.js,popup.html,popup.css,popup.js,content.js,README.md -DestinationPath WebsiteTTS.zip`

Extract the ZIP before using **Load unpacked**.

## API key security
The API key is stored in `chrome.storage.local` in your browser profile. It is not included in the source code or sent to the webpage, but it is **not a secure secret vault**: someone with access to your browser profile or extension developer tools may be able to retrieve it. For shared or production use, put the API key behind a private backend/proxy instead of storing it in the extension.

## Limitations
Chrome blocks extensions on internal pages (for example, `chrome://`), the Chrome Web Store, and some browser-owned viewers. The extension reads text rendered in the page DOM; inaccessible cross-origin frames and browser PDF viewer content may not be available. Keep the webpage open during playback.