/* Main code for Active-Tabs chrome extension:
 *      https://chromewebstore.google.com/detail/active-tabs/pbihheplocihoglaokfdcjadbjlhijgb?hl=en-US
 *
 * note:
 * - changes via POE Assistant (June 2026)
 * - linting tips:
 *   see https://stackoverflow.com/questions/54647294/const-is-available-in-es6-use-esversion-6
 */

// JSHint options:
/* jshint esversion: 6 */

// JSLint options:
/*jslint browser, devel, white, for, long, unordered */

//
// Note: workaround for jslint
/*global chrome*/
/*global console*/


var countTabs = function() {
    console.log("in countTabs");
    chrome.tabs.query({},function(tabs){
        chrome.action.setBadgeText( { text:tabs.length.toString() } );
    });
};

var listURLs = function() {
    console.log("in listURLs");
    chrome.windows.getAll({populate:true},function(windows){
        var tabData = [];
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
console.log(`listURLs=${listURLs}`);


chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab){
    console.log(`in onUpdated: tabId=${tabId}, changeInfo=${JSON.stringify(changeInfo)}, tab=${JSON.stringify(tab)}`);
    countTabs();
});

chrome.tabs.onRemoved.addListener(function(tabId){
    console.log(`in onRemoved: tabId=${tabId}`);
    countTabs();
});

chrome.action.onClicked.addListener(function() {
    chrome.tabs.create({
        url: chrome.runtime.getURL("popup.htm")
    });
});

countTabs();
