# Active Tabs (Chrome Extension)

Active Tabs is a Chrome extension that helps you search, filter, and manage your open tabs across all windows. It provides an efficient way to switch tabs, mute audio, pin tabs, and quickly close cluttered windows directly from a central interface.

## Features
- Search and filter across all tabs instantly.
- Keyboard shortcuts for rapid management (close, mute, pin).
- Highlight specific tab states like audible, pinned, and incognito.
- Beautiful, intuitive interface for massive tab hoarders.

## Chrome Manifest V3 considerations

This extension targets **Manifest V3** (`"manifest_version": 3` in `manifest.json`). A few MV3-specific constraints shape how the code is written:

- **Background is a service worker, not a page.** `background.js` is registered as
  `"background": { "service_worker": "background.js" }`. Unlike the old MV2
  persistent background page, a service worker is event-driven and is *terminated
  when idle*, so it must not rely on long-lived in-memory state and has **no access
  to the DOM / `window`** — only the `chrome.*` APIs. That is why `background.js`
  only calls `chrome.tabs`, `chrome.action`, etc.
- **The service worker is a classic script.** Because the manifest does not set
  `"type": "module"` on the background entry, `background.js` cannot use top-level
  `import`. To switch it to an ES module you would add
  `"background": { "service_worker": "background.js", "type": "module" }`.
  *(This is unrelated to the `eslint.config.mjs` extension, which is only a Node
  tooling detail — see below.)*
- **Strict Content Security Policy.** The manifest sets
  `"script-src 'self'; object-src 'self'"`, which forbids inline `<script>`,
  `eval`, and **remotely hosted code**. All JavaScript must be bundled inside the
  extension — this is why jQuery is vendored locally as
  `assets/jquery.min.2.2.0.js` rather than pulled from a CDN.
- **MV3 action API.** The toolbar button uses `chrome.action` (MV3), not the MV2
  `chrome.browserAction` / `chrome.pageAction`.
- **Minimal permissions.** Only `tabs` and `favicon` are requested.

Note on linting: `eslint.config.mjs` uses the `.mjs` extension purely so Node treats
that single config file as an ES module when ESLint runs. It is **not** part of the
shipped extension and does not change how Chrome loads any script; the extension's own
scripts remain classic scripts. Run the linter with `npm run lint`.

## Development

The popup interface is fully contained in `popup.htm`, with styles in `assets/popup.css` and logic in `assets/popup.js`.

### Testing
To verify the popup works correctly and does not have clipping issues, you can run the automated Puppeteer test provided in `test_popup.js`.

```bash
# Install dependencies
npm install puppeteer

# Run the test
node test_popup.js
```

This script will:
1. Mock the `chrome` Extension API so the page doesn't crash outside of the extension environment.
2. Load the `popup.htm` page in a headless browser.
3. Simulate pressing the `?` key to open the help modal.
4. Wait for the fade-in animation.
5. Take a screenshot saved as `test_screenshot.png`. 

You can review `test_screenshot.png` to ensure the "Keyboard Shortcuts" modal is perfectly centered and visible without any clipping issues.
