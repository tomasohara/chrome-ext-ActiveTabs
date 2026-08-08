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
- **Minimal permissions.** Only `tabs` and `storage` are requested. (`storage`
  holds nothing but the debug trace level — see "Debug tracing" below.)

Note on linting: `eslint.config.mjs` uses the `.mjs` extension purely so Node treats
that single config file as an ES module when ESLint runs. It is **not** part of the
shipped extension and does not change how Chrome loads any script; the extension's own
scripts remain classic scripts. Run the linter with `npm run lint`.

## Development

The popup interface is fully contained in `popup.htm`, with styles in `assets/popup.css` and logic in `assets/popup.js`.

### Debug tracing

Logging goes through `assets/debug.js`, which implements numeric trace levels
modelled on mezcla's `debug.py` (1=ERROR … 9=MOST_VERBOSE; see AGENTS.md). Each
statement declares a level and is emitted only when the current level is at
least that high:

```js
debug.trace(debug.DETAILED, "focusTab: tabId=" + tabId);
debug.trace(debug.QUITE_VERBOSE, () => JSON.stringify(tab));  // lazy: only built when active
```

Pass a **function** for anything expensive to build — it is invoked only when the
level is active, so the high-frequency tab dumps cost nothing when switched off.

The level defaults to `USUAL` (3) and is changed at runtime from the DevTools
console of *either* the page or the service worker — no reload, no code edit:

```js
debug.setLevel(7)   // show detailed I/O tracing
debug.getLevel()
```

It is stored in `chrome.storage.local`, so the change reaches both contexts at
once and survives a service-worker restart.

Two gates keep the console readable: the numeric level decides whether a message
is emitted, and the level also picks the console channel — levels 5+ go to
`console.debug()`, which DevTools hides unless the **Verbose** level filter is
enabled. That is why verbose traces can stay enabled in shipped code.

Useful level assignments already in place: `onUpdated`'s full tab dump at 7,
`countTabs`/`onRemoved`/keystroke traces at 6, the `drawTabs` markup dump at 5,
and flow-of-control traces (`focusTab`, `updateTab`, `tabs.create`) at 4.

For ad-hoc tracing with no code change at all, DevTools **logpoints**
(right-click a line number → "Add logpoint…") and `monitor(focusTab)` in the
page console work well alongside this.

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
