// Regression test for the "Uncaught (in promise) Error: No tab with id: ..."
// class of bugs.
//
// Background: chrome.tabs.update()/chrome.tabs.remove()/chrome.windows.remove()
// return a Promise when called with no callback (MV3). updateTab() (used by
// the m/p mute/pin shortcuts) and close_type() (used by the close-tab/window
// confirm flow) called them without one, so a stale id -- the tab/window was
// closed elsewhere since the list was rendered, or in the narrow gap between
// close_type()'s get() check and its remove() call -- surfaced as an unhandled
// promise rejection instead of the lastError-based handling used elsewhere
// (e.g. focusTab()). All three call sites now pass a callback and check
// chrome.runtime.lastError.
//
// This test mocks tabs.update/tabs.remove/windows.remove to simulate Chrome's
// real behavior for a missing id (set lastError, invoke the callback, clear
// lastError) and verifies that:
//   1. Pressing 'm'/'p' on a highlighted-but-now-stale tab does not throw or
//      produce an uncaught page error.
//   2. Calling close_type() for a stale tab/window id (simulating the id
//      disappearing between the get() check and the remove() call) does not
//      throw or produce an uncaught page error either.

const puppeteer = require('puppeteer');

(async () => {
    console.log('Starting puppeteer for stale-tab lastError regression test...');
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    const pageErrors = [];
    const warnings = [];
    page.on('pageerror', err => { pageErrors.push(err.message); console.log('PAGE ERROR:', err.message); });
    page.on('console', msg => { if (msg.type() === 'warn') warnings.push(msg.text()); });

    await page.setViewport({ width: 550, height: 600 });

    await page.evaluateOnNewDocument(() => {
        window.chrome = {
            windows: {
                getAll: (opts, cb) => cb([{ id: 1, incognito: false, tabs: [
                    { id: 10, title: "Stale Tab", url: "http://example.com", favIconUrl: "", audible: false, mutedInfo: {muted: false}, pinned: false, highlighted: false, incognito: false }
                ] }]),
                // Simulates the tab having already closed by the time remove() runs.
                get: (id, cb) => { chrome.runtime.lastError = null; cb({ id }); },
                remove: (id, cb) => {
                    chrome.runtime.lastError = { message: 'No window with id: ' + id };
                    if (cb) cb();
                    chrome.runtime.lastError = null;
                }
            },
            tabs: {
                // Simulates the highlighted row's tab having closed elsewhere.
                update: (id, props, cb) => {
                    chrome.runtime.lastError = { message: 'No tab with id: ' + id };
                    if (cb) cb();
                    chrome.runtime.lastError = null;
                },
                get: (id, cb) => { chrome.runtime.lastError = null; cb({ id }); },
                remove: (id, cb) => {
                    chrome.runtime.lastError = { message: 'No tab with id: ' + id };
                    if (cb) cb();
                    chrome.runtime.lastError = null;
                }
            },
            runtime: { lastError: null }
        };
    });

    await page.goto('file://' + __dirname + '/popup.htm', { waitUntil: 'networkidle0' });

    let passed = true;
    const check = (cond, okMsg, failMsg) => {
        if (cond) { console.log('✅ ' + okMsg); } else { console.error('❌ ' + failMsg); passed = false; }
    };

    // Case 1: 'm' (mute) on a stale highlighted tab.
    await page.evaluate(() => { $('.search').blur(); });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('KeyM');
    await new Promise(r => setTimeout(r, 100));

    // Case 2: 'p' (pin) on the same stale tab.
    await page.keyboard.press('KeyP');
    await new Promise(r => setTimeout(r, 100));

    check(pageErrors.length === 0, "no uncaught page error from 'm'/'p' on a stale tab", 'uncaught page error(s): ' + JSON.stringify(pageErrors));
    check(warnings.some(w => w.includes('updateTab: tabs.update failed')), 'updateTab logged the stale-tab lastError instead of throwing', 'expected updateTab warning not found: ' + JSON.stringify(warnings));

    // Case 3: close_type() for a tab id that vanished between get() and remove().
    await page.evaluate(() => { close_type({ type: 'tab', id: 10 }); });
    await new Promise(r => setTimeout(r, 100));

    // Case 4: close_type() for a window id that vanished the same way.
    await page.evaluate(() => { close_type({ type: 'window', id: 1 }); });
    await new Promise(r => setTimeout(r, 100));

    check(pageErrors.length === 0, 'no uncaught page error from close_type() on a stale tab/window', 'uncaught page error(s): ' + JSON.stringify(pageErrors));
    check(warnings.some(w => w.includes('close_type: tabs.remove failed')), 'close_type logged the stale-tab remove lastError instead of throwing', 'expected tabs.remove warning not found: ' + JSON.stringify(warnings));
    check(warnings.some(w => w.includes('close_type: windows.remove failed')), 'close_type logged the stale-window remove lastError instead of throwing', 'expected windows.remove warning not found: ' + JSON.stringify(warnings));

    await browser.close();

    if (!passed) {
        console.error('Stale-tab lastError regression tests failed.');
        process.exit(1);
    }
    console.log('All stale-tab lastError regression tests passed successfully!');
    process.exit(0);
})();
