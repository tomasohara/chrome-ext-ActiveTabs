// ESLint configuration (post ESLint 9)
//
// Via Claude Opus 4.8

import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly",
        // OLD: chrome: "readonly",
        clearInterval: "readonly",
        // OLD: console: "readonly",
        setInterval: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly"
      }
    },
    rules: {
      "eqeqeq": "error",
      "no-var": "error",
      "prefer-const": "warn",
      "no-unused-vars": "warn",
      "no-shadow": "warn",
      "no-implicit-globals": "warn"
    }
  }
];
