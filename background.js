/* Main code for Active-Tabs chrome extension:
 *      https://chromewebstore.google.com/detail/active-tabs/pbihheplocihoglaokfdcjadbjlhijgb?hl=en-US
 *
 * note:
 * - changes via POE Assistant (June 2026)
 * - ESLint lint-clean pass (var->const, globals via eslint.config.mjs) via Claude Opus 4.8 (July 2026)
 * - linting tips:
 *   see https://stackoverflow.com/questions/54647294/const-is-available-in-es6-use-esversion-6
 */

// JSHint options:
/* jshint esversion: 6, browser: true, devel: true */

// JSLint options:
/*jslint browser, devel, node, trace, beta, bitwise, convert, eval, fart, for, getset, indent2, nomen, single, subscript, long, this, unordered, variable, white */
// Note: workaround for jslint
/*global chrome, console*/

const countTabs = function() {
    console.log("in countTabs");
    chrome.tabs.query({},function(tabs){
        chrome.action.setBadgeText( { text:tabs.length.toString() } );
    });
};

const listURLs = function() {
    console.log("in listURLs");
    chrome.windows.getAll({populate:true},function(windows){
        const tabData = [];
        windows.forEach(function(window){
            tabData[window.id] = [];
            window.tabs.forEach(function(tab){
                console.debug(`url=${tab.url}`);
                tabData[tab.windowId].push({
                    id: tab.id,
                    title: tab.title,
                    incognito: tab.incognito,
                    url: tab.url,
                    icon: tab.favIconUrl
                });
            });
        });
        Object.keys(tabData).forEach(function (winId) {
            tabData[winId].forEach(function (tab) {
                console.log(tabData[winId][tab]);
            });
        });
    });
};
// TODO2: reference_var(listURLs);
// DEBUG: console.log(`listURLs=${listURLs()}`);


chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab){
    console.log(`in onUpdated: tabId=${tabId}, changeInfo=${JSON.stringify(changeInfo)}, tab=${JSON.stringify(tab)}`);
    countTabs();
});

chrome.tabs.onRemoved.addListener(function(tabId){
    console.log(`in onRemoved: tabId=${tabId}`);
    countTabs();
});

chrome.action.onClicked.addListener(function() {
    // TRACE (added via Claude Opus 4.8, July 2026): diagnose ERR_FILE_NOT_FOUND
    //   when opening the tab page. Log the resolved chrome-extension URL, probe it
    //   with fetch (a 404 / rejection means popup.htm is missing, mis-named, or not
    //   at the manifest root), and surface any tabs.create failure via lastError.
    const popupURL = chrome.runtime.getURL("popup.htm");
    console.log(`action.onClicked: popupURL=${popupURL}`);
    fetch(popupURL).then(function(resp) {
        console.log(`popup.htm probe: status=${resp.status} ok=${resp.ok} url=${resp.url}`);
    }).catch(function(err) {
        console.error(`popup.htm probe failed (file not found?): ${err}`);
    });
    chrome.tabs.create({ url: popupURL }, function(tab) {
        if (chrome.runtime.lastError) {
            console.error(`tabs.create failed: ${chrome.runtime.lastError.message} (url=${popupURL})`);
        } else {
            console.log(`tabs.create ok: tabId=${tab && tab.id} url=${tab && tab.url}`);
        }
    });
});

// TRACE (added via Claude Opus 4.8): confirm at service-worker startup which page
//   files the extension resolves to, so a load problem is visible without clicking.
const startupManifest = chrome.runtime.getManifest();
console.log(`background.js loaded: ${startupManifest.name} v${startupManifest.version}`);
console.log(`extension base URL=${chrome.runtime.getURL("")}, popup=${chrome.runtime.getURL("popup.htm")}`);

countTabs();
