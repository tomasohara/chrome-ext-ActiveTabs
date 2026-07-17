// ESLint configuration (post ESLint 9 "flat config")
//
// `npm run lint` now runs `eslint .`, so every .js file in the repo is linted
// by default -- not just an explicit allowlist -- to catch new modules that
// nobody remembered to wire in. Coverage works in layers:
// - js.configs.recommended (below) applies repo-wide with no `files` filter,
//   so it also catches any brand-new file that doesn't match either of the
//   more specific blocks below.
// - The "browser extension scripts" block below is scoped via `files` to
//   background.js and assets/popup.js: the extension's classic <script>s,
//   with chrome/jQuery/browser globals declared.
// - The "Node test scripts" block is scoped to test_*.js: the Puppeteer
//   regression scripts, which run under plain Node CommonJS.
// A new .js file that isn't added to either `files` list still gets linted
// via js.configs.recommended alone -- so if it references chrome, $, window,
// require, etc., "no-undef" errors will flag it as unbucketed. That's the
// signal to add it to the right `files` glob here (or a new one).
//
// Third-party and generated assets (jQuery, node_modules, backups) are ignored.
//
// Why the ".mjs" extension (for readers coming from Python):
// - ESLint 9 "flat" configs are authored with ES-module syntax (the `import`
//   above / `export default` below). Node picks a plain ".js" file's module
//   system from the nearest package.json: with no "type": "module" it assumes
//   the older CommonJS style (require / module.exports) and prints a warning
//   when it instead finds import/export here.
// - The ".mjs" extension unconditionally marks *this one file* as an ES module,
//   so we avoid setting "type": "module" package-wide (which would break the
//   CommonJS test harness, test_popup.js, that uses require()). ESLint auto-
//   discovers eslint.config.{js,mjs,cjs}, so the rename needs no other change.
// - This is purely a Node/tooling detail for *running the linter*. It does NOT
//   affect the shipped extension -- Chrome never loads this file. The extension's
//   own scripts stay classic scripts (see sourceType "script" below and the
//   "Chrome Manifest V3" notes in README.md).
//
// note:
// - The extension runs as classic <script> globals (sourceType "script"), not modules.
// - jQuery is exposed as the global $ / jQuery; the Chrome extension API as chrome.
//
// Via Claude Opus 4.8
// Reworked for whole-tree lint coverage (files-scoped blocks, commonjs test
// globals, self-lint block) via Claude Sonnet 5 (July 2026)

import js from "@eslint/js";

// Shared with the Puppeteer test scripts below: they embed page.evaluate()
// callbacks that run inside the extension's own page, referencing the same
// browser/jQuery/chrome globals background.js and assets/popup.js use.
const browserGlobals = {
  // Browser environment
  window: "readonly",
  document: "readonly",
  clearInterval: "readonly",
  setInterval: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  console: "readonly",
  fetch: "readonly",
  RegExp: "readonly",
  JSON: "readonly",
  // Chrome extension API
  chrome: "readonly",
  // jQuery (vendored separately, referenced as $ / jQuery)
  $: "readonly",
  jQuery: "readonly"
};

export default [
  // Files ESLint should never touch (vendored / generated / archived).
  {
    ignores: [
      "node_modules/**",
      "backup/**",
      "assets/backup/**",
      "old/**",
      "assets/jquery.min.2.2.0.js"
    ]
  },
  js.configs.recommended,
  // The extension's own scripts: classic <script>s with chrome/jQuery globals.
  {
    files: ["background.js", "assets/popup.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: browserGlobals
    },
    rules: {
      "eqeqeq": "error",
      "no-var": "error",
      "prefer-const": "warn",
      // Ignore unused event-handler args (e.g. jQuery's `e`); they document intent.
      "no-unused-vars": ["warn", { "args": "none" }],
      "no-shadow": "warn",
      // The extension loads as classic <script>s, so top-level function/const
      // declarations are intentional globals rather than leaks.
      "no-implicit-globals": "off",
      // The inline /*global chrome, console*/ JSLint/JSHint directives are kept
      // for reference and overlap the globals above; allow the redeclaration.
      "no-redeclare": "off"
    }
  },
  // Puppeteer regression scripts (test_*.js): plain Node CommonJS. `sourceType:
  // "commonjs"` covers require()/module.exports; the rest of the Node globals
  // (process, __dirname, console) plus the browser globals above are declared
  // by hand since these scripts also contain inline page.evaluate() callbacks
  // that run inside popup.htm and reference window/document/$/focusTab.
  {
    files: ["test_*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...browserGlobals,
        process: "readonly",
        __dirname: "readonly",
        // Standard browser global, used inside page.evaluate() callbacks.
        getComputedStyle: "readonly",
        // Declared by assets/popup.js, invoked from inside page.evaluate().
        focusTab: "readonly",
        close_type: "readonly"
      }
    }
  },
  // This config file itself: a real ES module (see the ".mjs" note above),
  // so it needs its own sourceType rather than inheriting "script" above.
  {
    files: ["eslint.config.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module"
    }
  }
];
