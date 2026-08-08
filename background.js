/* Main code for Active-Tabs chrome extension:
 *      https://chromewebstore.google.com/detail/active-tabs/pbihheplocihoglaokfdcjadbjlhijgb?hl=en-US
 *
 * note:
 * - changes via POE Assistant (June 2026)
 * - ESLint lint-clean pass (var->const, globals via eslint.config.mjs) via Claude Opus 4.8 (July 2026)
 * - Disabled dead/buggy listURLs (unused, flagged by eslint) via Claude Sonnet 5 (July 2026)
 * - Trace-level logging pass via Claude Code / Claude Opus 5 (July 2026): the
 *   unconditional console.log calls here fired on every tab event (a single page
 *   load emits several onUpdated events, and background tabs keep emitting them),
 *   which buried everything else in the service-worker console. They now route
 *   through assets/debug.js at levels matched to their frequency; see that
 *   module's header for the scheme and for how to change the level at runtime.
 * - linting tips:
 *   see https://stackoverflow.com/questions/54647294/const-is-available-in-es6-use-esversion-6
 */

// JSHint options:
/* jshint esversion: 6, browser: true, devel: true */

// JSLint options:
/*jslint browser, devel, node, trace, beta, bitwise, convert, eval, fart, for, getset, indent2, nomen, single, subscript, long, this, unordered, variable, white */
// Note: workaround for jslint
// OLD: /*global chrome, console*/
// 'console' dropped: see the matching note in assets/popup.js -- debug.trace
// (assets/debug.js) now owns the console calls.
/*global chrome, debug, importScripts*/

// Trace-level logger (defines the global `debug`); must precede any debug.trace
// call below. Service workers pull in classic scripts via importScripts().
importScripts("assets/debug.js");

const countTabs = function() {
    // OLD: console.log("in countTabs");
    // Rides along on every tab event, so it is detailed-I/O material.
    debug.trace(debug.QUITE_DETAILED, "in countTabs");
    chrome.tabs.query({},function(tabs){
        chrome.action.setBadgeText( { text:tabs.length.toString() } );
    });
};

// Dead code: never invoked (drawTabs() in assets/popup.js covers listing tab
// data instead), flagged by eslint's no-unused-vars, and buggy internally
// (the last forEach logs tabData[winId][tab] instead of just tab). Kept
// commented out for reference rather than deleted, per AGENTS.md.
// OLD
// const listURLs = function() {
//     console.log("in listURLs");
//     chrome.windows.getAll({populate:true},function(windows){
//         const tabData = [];
//         windows.forEach(function(window){
//             tabData[window.id] = [];
//             window.tabs.forEach(function(tab){
//                 console.debug(`url=${tab.url}`);
//                 tabData[tab.windowId].push({
//                     id: tab.id,
//                     title: tab.title,
//                     incognito: tab.incognito,
//                     url: tab.url,
//                     icon: tab.favIconUrl
//                 });
//             });
//         });
//         Object.keys(tabData).forEach(function (winId) {
//             tabData[winId].forEach(function (tab) {
//                 console.log(tabData[winId][tab]);
//             });
//         });
//     });
// };
// TODO2: reference_var(listURLs);
// DEBUG: console.log(`listURLs=${listURLs()}`);


chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab){
    // OLD: console.log(`in onUpdated: tabId=${tabId}, changeInfo=${JSON.stringify(changeInfo)}, tab=${JSON.stringify(tab)}`);
    // The highest-volume trace in the extension: fires repeatedly per page load
    // and continuously for background tabs (title/audio/favicon changes). The
    // full-object dump is deferred into the callback so the JSON.stringify cost
    // is only paid when the level is actually active.
    debug.trace(debug.QUITE_VERBOSE, () => `in onUpdated: tabId=${tabId}, changeInfo=${JSON.stringify(changeInfo)}, tab=${JSON.stringify(tab)}`);
    countTabs();
});

chrome.tabs.onRemoved.addListener(function(tabId){
    // OLD: console.log(`in onRemoved: tabId=${tabId}`);
    debug.trace(debug.QUITE_DETAILED, `in onRemoved: tabId=${tabId}`);
    countTabs();
});

chrome.action.onClicked.addListener(function() {
    // TRACE (added via Claude Opus 4.8, July 2026): diagnose ERR_FILE_NOT_FOUND
    //   when opening the tab page. Log the resolved chrome-extension URL, probe it
    //   with fetch (a 404 / rejection means popup.htm is missing, mis-named, or not
    //   at the manifest root), and surface any tabs.create failure via lastError.
    const popupURL = chrome.runtime.getURL("popup.htm");
    debug.trace(debug.DETAILED, `action.onClicked: popupURL=${popupURL}`);
    // Unlike a plain trace, this probe has a side effect (an extra request per
    // click), so gate the call itself on the level rather than just its output.
    if (debug.getLevel() >= debug.VERBOSE) {
        fetch(popupURL).then(function(resp) {
            debug.trace(debug.VERBOSE, `popup.htm probe: status=${resp.status} ok=${resp.ok} url=${resp.url}`);
        }).catch(function(err) {
            debug.trace(debug.ERROR, `popup.htm probe failed (file not found?): ${err}`);
        });
    }
    chrome.tabs.create({ url: popupURL }, function(tab) {
        if (chrome.runtime.lastError) {
            debug.trace(debug.ERROR, `tabs.create failed: ${chrome.runtime.lastError.message} (url=${popupURL})`);
        } else {
            debug.trace(debug.DETAILED, `tabs.create ok: tabId=${tab && tab.id} url=${tab && tab.url}`);
        }
    });
});

// TRACE (added via Claude Opus 4.8): confirm at service-worker startup which page
//   files the extension resolves to, so a load problem is visible without clicking.
// note: once-per-startup, so USUAL keeps it visible at the default level; the
//   URL detail is only of interest when actually chasing a load problem.
const startupManifest = chrome.runtime.getManifest();
debug.trace(debug.USUAL, `background.js loaded: ${startupManifest.name} v${startupManifest.version} (trace level ${debug.getLevel()})`);
debug.trace(debug.DETAILED, `extension base URL=${chrome.runtime.getURL("")}, popup=${chrome.runtime.getURL("popup.htm")}`);

countTabs();
