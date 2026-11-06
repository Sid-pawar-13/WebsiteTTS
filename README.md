# WebsiteTTS

Chrome Manifest V3 extension to read webpages aloud with paragraph highlighting and automatic scrolling.

## Features
- Start / stop reading
- Forward / backward by paragraph
- Auto-scroll to the current paragraph
- Highlight the paragraph being spoken
- Adjustable speech rate (0.7×–2.0×)
- Uses the built-in Web Speech API; no API key, server, or dependencies

## Install
1. Clone or download this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select this repository folder (the one containing `manifest.json`).
5. Open a normal webpage and click the extension icon.

## Package
No compilation step is required. To create a ZIP:
- macOS/Linux: `zip -r WebsiteTTS.zip manifest.json popup.html popup.css popup.js content.js README.md`
- Windows PowerShell: `Compress-Archive -Path manifest.json,popup.html,popup.css,popup.js,content.js,README.md -DestinationPath WebsiteTTS.zip`

Extract the ZIP before using **Load unpacked**. For Chrome Web Store distribution, upload the ZIP in the Developer Dashboard.

## Limitations
Chrome blocks extensions on internal pages (for example, `chrome://`), the Chrome Web Store, and some browser-owned viewers. Available voices depend on the OS/browser. Keep the webpage open during playback. Inaccessible cross-origin frames may not be readable.