/* Numeric trace-level logging for the Active-Tabs chrome extension.
 *
 * Models the trace-level scheme used by the mezcla `debug.py` module (see
 * AGENTS.md "Debug level conventions"), which in turn resembles loguru's TRACE
 * tier for Python: https://loguru.readthedocs.io/en/stable/api/logger.html
 * Each trace statement declares how interesting it is (1=ERROR .. 9=MOST_VERBOSE)
 * and is emitted only when the current level is at least that high. Levels up to
 * DETAILED (4) are for normal execution; VERBOSE (5) and above are for debugging
 * proper, which is why the console is so noisy without this gate: the extension's
 * per-event tab dumps are inherently level-7 material.
 *
 * Two independent gates keep DevTools readable:
 * 1. The numeric level decides whether a message is emitted at all.
 * 2. The console method decides whether DevTools *shows* an emitted message:
 *    levels 5+ go to console.debug(), which the console hides unless the
 *    "Verbose" level filter is enabled. So trace statements can be left enabled
 *    in shipped code without flooding the default view.
 *
 * The level is runtime-adjustable and shared across contexts. It lives in
 * chrome.storage.local, so `debug.setLevel(5)` typed into *either* the page
 * console or the service-worker console takes effect in both immediately (via
 * the onChanged listener) and survives a service-worker restart -- no reload and
 * no code edit needed, which is the point of having this at all.
 *
 * Usage:
 *     debug.trace(debug.DETAILED, "focusTab: tabId=" + tabId);
 *     debug.trace(debug.QUITE_VERBOSE, () => JSON.stringify(tab));  // lazy
 *     debug.assertion(Number.isInteger(tabId), "tabId must be an integer");
 *
 * Pass a function for any message that is expensive to build: it is invoked
 * only if the level is active, so high-frequency dumps cost nothing when off.
 *
 * caveat: this defines a global named `debug`, which shadows the DevTools
 * console utility of the same name (`debug(fn)` to break on a function) inside
 * pages that load this file. The `monitor(fn)` utility is unaffected.
 *
 * Change facilitated by Claude Code using model Claude Opus 5 (July 2026).
 */

// JSHint options:
/* jshint esversion: 6, browser: true, devel: true */

// JSLint options:
/*jslint browser, devel, node, trace, beta, bitwise, convert, eval, fart, for, getset, indent2, nomen, single, subscript, long, this, unordered, variable, white */
// Note: workaround for jslint
/*global chrome, console, globalThis*/

const debug = (function () {
    // Trace levels, mirroring mezcla debug.py (see module header).
    const LEVELS = {
        ALWAYS: 0,          // no filtering; mainly for completeness
        ERROR: 1,           // definite errors; typically shown
        WARNING: 2,         // possible errors; typically shown
        USUAL: 3,           // usual in sense of debugging purposes
        DETAILED: 4,        // info useful for flow of control, etc.
        VERBOSE: 5,         // useful stuff for debugging
        QUITE_DETAILED: 6,  // detailed I/O
        QUITE_VERBOSE: 7,   // usually for I/O, etc. by helper functions
        MOST_DETAILED: 8,   // for high-frequency helpers
        MOST_VERBOSE: 9     // for internal debugging
    };
    const DEFAULT_LEVEL = LEVELS.USUAL;
    const STORAGE_KEY = "traceLevel";

    let level = DEFAULT_LEVEL;

    // Storage is optional: the Puppeteer tests mock a bare `chrome` object with
    // no storage API, and this module must stay usable there (and in any plain
    // page context), so every access is optional-chained rather than assumed.
    const storage = globalThis.chrome && chrome.storage && chrome.storage.local;

    function isValidLevel(value) {
        return Number.isInteger(value) && (value >= LEVELS.ALWAYS) && (value <= LEVELS.MOST_VERBOSE);
    }

    // Pick the console channel from the level so that DevTools' own level filter
    // acts as the second gate described in the module header.
    function consoleMethod(traceLevel) {
        let method = console.debug;
        if (traceLevel <= LEVELS.WARNING) {
            method = console.warn;
        } else if (traceLevel <= LEVELS.DETAILED) {
            method = console.log;
        }
        return method;
    }

    function getLevel() {
        return level;
    }

    function setLevel(newLevel) {
        let ok = false;
        if (isValidLevel(newLevel)) {
            level = newLevel;
            ok = true;
            // Propagate to the other context (page <-> service worker); ignore
            // failures so the level still applies locally when storage is absent.
            if (storage) {
                storage.set({[STORAGE_KEY]: newLevel}, function () {
                    if (chrome.runtime && chrome.runtime.lastError) {
                        console.warn("debug.setLevel: storage.set failed: " + chrome.runtime.lastError.message);
                    }
                });
            }
        } else {
            console.warn("debug.setLevel: ignoring invalid level: " + newLevel);
        }
        return ok;
    }

    function trace(traceLevel, message) {
        // Cheap early-out first: this runs on every traced event, so the level
        // check must precede any message construction.
        if (traceLevel <= level) {
            const text = (typeof message === "function") ? message() : message;
            consoleMethod(traceLevel)(text);
        }
    }

    // Convenience wrapper for the common "label plus value" case, keeping the
    // JSON.stringify cost inside the lazy callback.
    function traceObject(traceLevel, label, obj) {
        trace(traceLevel, function () {
            return label + "=" + JSON.stringify(obj);
        });
    }

    function assertion(condition, message) {
        // console.assert only reports failures, matching debug.assertion's
        // debug-only sanity-check role.
        console.assert(condition, message || "assertion failed");
    }

    // Adopt any previously stored level, then track later changes from either
    // context. Registered unconditionally at load time, as MV3 service workers
    // require listeners to be added synchronously during startup.
    if (storage) {
        storage.get(STORAGE_KEY, function (data) {
            if (chrome.runtime && chrome.runtime.lastError) {
                console.warn("debug: storage.get failed: " + chrome.runtime.lastError.message);
            } else if (data && isValidLevel(data[STORAGE_KEY])) {
                level = data[STORAGE_KEY];
            }
        });
        if (chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener(function (changes, areaName) {
                if ((areaName === "local") && changes[STORAGE_KEY] && isValidLevel(changes[STORAGE_KEY].newValue)) {
                    level = changes[STORAGE_KEY].newValue;
                }
            });
        }
    }

    return Object.assign({}, LEVELS, {
        DEFAULT: LEVELS.WARNING,
        trace,
        traceObject,
        assertion,
        setLevel,
        getLevel
    });
}());

// Exposed as a global so it is callable straight from the DevTools console
// (e.g. `debug.setLevel(7)`) and visible to the extension's classic <script>s.
globalThis.debug = debug;
