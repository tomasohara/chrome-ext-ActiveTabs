/* Main code for Active-Tabs chrome extension:
 *      https://chromewebstore.google.com/detail/active-tabs/pbihheplocihoglaokfdcjadbjlhijgb?hl=en-US
 *
 * note:
 * - changes via POE Assistant (June 2026)
 * - linting tips:
 *   see https://stackoverflow.com/questions/54647294/const-is-available-in-es6-use-esversion-6
 */

/* jshint esversion: 6 */

/*jslint for*/
/*jslint long*/
/*jslint unordered*/

/*global chrome*/
/*global console*/
var win = null;
var tab = null;

// via https://www.jslint.com:
// .... /*jslint browser*/ ....... Assume browser environment.
// .... /*jslint devel*/ ......... Allow console.log() and friends.
// .... /*jslint long*/ .......... Allow long lines.
// .... /*jslint unordered*/ ..... Allow unordered cases, params, properties,
//
// Optional directives.
// .... /*jslint beta*/ .......... Enable experimental warnings.
// .... /*jslint bitwise*/ ....... Allow bitwise operator.
// .... /*jslint browser*/ ....... Assume browser environment.
// .... /*jslint convert*/ ....... Allow conversion operator.
// .... /*jslint couch*/ ......... Assume CouchDb environment.
// .... /*jslint devel*/ ......... Allow console.log() and friends.
// .... /*jslint eval*/ .......... Allow eval().
// .... /*jslint fart*/ .......... Allow complex fat-arrow.
// .... /*jslint for*/ ........... Allow for-statement.
// .... /*jslint getset*/ ........ Allow get() and set().
// .... /*jslint indent2*/ ....... Use 2-space indent.
// .... /*jslint long*/ .......... Allow long lines.
// .... /*jslint node*/ .......... Assume Node.js environment.
// .... /*jslint nomen*/ ......... Allow weird property name.
// .... /*jslint single*/ ........ Allow single-quote strings.
// .... /*jslint subscript*/ ..... Allow identifier in subscript-notation.
// .... /*jslint this*/ .......... Allow 'this'.
// .... /*jslint trace*/ ......... Include jslint stack-trace in warnings.
// .... /*jslint unordered*/ ..... Allow unordered cases, params, properties,
// ................................... variables, and exports.
// .... /*jslint white*/ ......... Allow messy whitespace.


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
                console.log(tabData[win][tab]);
            });
        });
    });
};

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab){
    console.log(`in onUpdated: tabId=${tabId}, changeInfo=${JSON.stringify(changeInfo)}, tab=${JSON.stringify(tab)}`);
    countTabs();
});

chrome.tabs.onRemoved.addListener(function(tabId){
    console.log("in onRemoved");
    countTabs();
});

chrome.action.onClicked.addListener(function() {
    chrome.tabs.create({
        url: chrome.runtime.getURL("popup.htm")
    });
});

countTabs();
