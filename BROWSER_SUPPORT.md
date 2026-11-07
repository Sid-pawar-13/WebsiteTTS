# WebsiteTTS browser support

## Supported by the current release package

WebsiteTTS currently uses a Chromium Manifest V3 extension package. The same ZIP can be used as the source package for these Chromium-based browsers:

| Browser | Distribution path | Status |
|---|---|---|
| Google Chrome | Chrome Web Store | Target |
| Microsoft Edge | Microsoft Edge Add-ons | Target |
| Brave | Chrome Web Store or Load unpacked | Chromium-compatible; store listing is not automatic |
| Opera | Opera add-ons or Load unpacked | Chromium-compatible; store listing is not automatic |

Store submissions are separate publisher actions. A GitHub Release does not automatically publish to any browser store.

## Not included in this release

Firefox and Safari are not claimed as supported. They need browser-specific compatibility work and testing before being advertised as supported.

The current implementation depends on Chrome extension APIs including `chrome.offscreen` and `chrome.webNavigation`. Firefox has different Manifest V3 background/offscreen support, and Safari uses Apple's Web Extension packaging and distribution process. Do not install the Chromium ZIP in those browsers and assume it will work.

## Install from a GitHub Release (Chromium browsers)

1. Download `WebsiteTTS-vX.Y.Z-chromium.zip` from the GitHub Release.
2. Extract the ZIP into a permanent folder.
3. Open the browser's extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
   - Opera: `opera://extensions`
4. Enable Developer mode (or the equivalent developer toggle).
5. Choose **Load unpacked** and select the extracted folder containing `manifest.json`.

This is a developer/sideload installation. For ordinary public users, install from the browser's official extension store once the store listing is approved.

## Release process

1. Update `version` in `manifest.json`.
2. Merge the tested changes into `main`.
3. Create and push a matching version tag, for example `v1.4.0`.
4. GitHub Actions validates the Manifest V3 package, checks JavaScript syntax, creates the ZIP and SHA-256 checksum, and publishes a GitHub Release.
5. Upload the same tested source package to each store as a separate submission. Follow each store's current policies and review process.

The release ZIP contains only the extension runtime files and user-facing documentation. It does not include Git metadata, development tooling, or repository history.
