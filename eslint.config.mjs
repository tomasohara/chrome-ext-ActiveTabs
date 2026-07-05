// ESLint configuration (post ESLint 9 "flat config")
//
// This lints the extension's own scripts (background.js and assets/popup.js).
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

import js from "@eslint/js";

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
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
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
      }
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
  }
];
