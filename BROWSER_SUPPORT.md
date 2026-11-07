<div align="center">

# Browser compatibility

**WebsiteTTS · Supported browsers, installation, and distribution**

WebsiteTTS is currently built as a **Chromium Manifest V3 extension**. This guide describes the browsers targeted by the current package, how to install it, and where support is not yet claimed.

[![Chromium](https://img.shields.io/badge/Chromium-based-browsers-blue?logo=googlechrome&logoColor=white)](README.md)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)](manifest.json)

</div>

---

## At a glance

| Browser | Current package | Installation / distribution | Support status |
| --- | --- | --- | --- |
| **Google Chrome** | Chromium ZIP | Chrome Web Store when published, or Load unpacked | Primary target |
| **Microsoft Edge** | Same Chromium ZIP | Edge Add-ons when published, or Load unpacked | Primary target |
| **Brave** | Same Chromium ZIP | Load unpacked; store availability depends on publisher submission and store policy | Chromium-compatible; not separately validated |
| **Opera** | Same Chromium ZIP | Load unpacked; Opera add-on listing requires a separate submission | Chromium-compatible; not separately validated |
| **Mozilla Firefox** | No package | No supported installation path | Not supported |
| **Apple Safari** | No package | No supported installation path | Not supported |

> **Important:** Chromium compatibility does not mean that every browser version or store listing has been tested or approved. Chrome and Edge are the primary target browsers. Brave and Opera may run the Chromium package, but are not separately validated by this project.

A GitHub Release is a downloadable project package. It does **not** automatically publish WebsiteTTS to any browser extension store.

## Why Chromium browsers?

The current implementation uses Chromium extension APIs, including:

- **Manifest V3 service worker** for background processing.
- **chrome.offscreen** to play generated audio outside the webpage context.
- **chrome.webNavigation** to discover page frames.
- **chrome.storage.local** for persistent extension preferences.
- Content scripts injected into matching pages and frames to collect readable text and control highlighting.

Firefox has a different extension API and Manifest V3 implementation. Safari uses Apple's Web Extension packaging, signing, and distribution workflow. These browsers need dedicated compatibility work and testing before support can be claimed.

## Install the Chromium package

The following instructions apply to Chrome, Edge, Brave, and Opera.

### 1. Download and extract

1. Open [WebsiteTTS Releases](https://github.com/Sid-pawar-13/WebsiteTTS/releases).
2. Download the asset named WebsiteTTS-vX.Y.Z-chromium.zip from the release you want.
3. Extract the ZIP into a permanent folder.
4. Keep the extracted folder in place. The browser loads the extension from this folder.

Do not select the ZIP file itself. The folder you choose must contain manifest.json at its top level.

### 2. Open the extensions page

| Browser | Extensions page |
| --- | --- |
| Chrome | chrome://extensions |
| Edge | edge://extensions |
| Brave | brave://extensions |
| Opera | opera://extensions |

You can paste the browser-specific address directly into the address bar.

### 3. Enable Developer mode and load the extension

1. Turn on **Developer mode** (or the equivalent developer toggle).
2. Select **Load unpacked**.
3. Browse to the extracted WebsiteTTS folder.
4. Select the folder containing manifest.json.
5. Confirm that WebsiteTTS appears in the installed extensions list.
6. Pin WebsiteTTS to the browser toolbar if you want quick access.

### 4. Configure speech

1. Open the WebsiteTTS toolbar popup.
2. Select **Ollama (local / Phonon)** or **OpenAI-compatible API**.
3. Open **Configure TTS provider and API**.
4. Enter the endpoint, model, voice, and API key if required.
5. Run **Test API** and confirm that the test audio plays.
6. Save the configuration, then start reading a webpage.

For complete provider setup, including the Ollama macOS origin configuration, see the [README configuration guide](README.md#configure-a-speech-provider).

## Update a manually installed extension

When a new release is available:

1. Download and extract the new Chromium ZIP into a new folder, or replace the existing source folder.
2. Open the browser's extensions page.
3. Find WebsiteTTS and select **Reload** after replacing its files.
4. If the extension was loaded from a different folder, remove the old unpacked entry and load the new folder using **Load unpacked**.
5. Open WebsiteTTS and verify that the popup and provider settings load correctly.

Saved settings are stored in the browser's extension storage. They are associated with the installed extension identity; removing/reinstalling the extension or changing its ID can affect whether the browser retains access to previous storage.

## Browser-store distribution

The project can build one Chromium package, but each store has its own publisher account, submission process, policy checks, and review.

| Store | What the publisher must do |
| --- | --- |
| **Chrome Web Store** | Submit the extension package and listing through the Chrome Web Store developer dashboard; complete required declarations and review. |
| **Microsoft Edge Add-ons** | Submit the package and listing through Partner Center; complete the store's review process. |
| **Brave** | Chromium extensions can generally be installed from the Chrome Web Store or loaded unpacked. A separate Brave store listing is not produced by this repository's release workflow. |
| **Opera** | Submit a listing to Opera's add-ons platform separately, or use Load unpacked for local testing. |

Store policies and submission requirements can change. Check the current publisher documentation before submitting.

### What the GitHub release workflow does

When a version tag matching v* is pushed, GitHub Actions:

1. Checks that the manifest is valid and declares Manifest V3.
2. Checks that required runtime and documentation files exist.
3. Runs Node.js syntax checks on the JavaScript files.
4. Creates a clean WebsiteTTS-vX.Y.Z-chromium.zip package.
5. Generates SHA256SUMS.txt for the ZIP.
6. Publishes a GitHub Release with the ZIP and checksum attached.

The workflow also uploads a ready-to-load unpacked folder and the ZIP/checksum as workflow artifacts. A successful GitHub Release does not imply that a browser store has approved or published the extension.

## Unsupported browsers

### Mozilla Firefox

Firefox is not supported by the current package. The extension depends on Chromium-specific APIs and behavior, particularly the offscreen audio document and frame navigation flow. A Firefox port would require compatibility changes and testing against Firefox's extension APIs.

### Apple Safari

Safari is not supported by the current package. A Safari version would need Apple's Web Extension conversion, packaging, signing, and distribution process, followed by dedicated testing on supported macOS and iOS versions.

Do not install the Chromium ZIP in Firefox or Safari expecting it to work.

## Compatibility and issue reports

If WebsiteTTS does not work in a Chromium browser:

1. Confirm that the browser is up to date.
2. Confirm that the extension is loaded from a folder containing manifest.json.
3. Reload the extension from the browser's extensions page.
4. Verify the TTS provider independently using the Settings page's **Test API** action.
5. Reproduce the issue on a primary target browser (Chrome or Edge), if possible.
6. When reporting an issue, include the browser name and version, operating system, WebsiteTTS version, provider type, and relevant error message. **Do not include API keys, access tokens, or private webpage content.**

For general setup and troubleshooting, see the [README](README.md).
