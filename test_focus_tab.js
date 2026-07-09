// Regression test for the focusTab "No matching signature" TypeError.
//
// Background: focusTab() used to guard with `if (el && el.data)`, which is
// always truthy for a jQuery object (`.data` is the jQuery method, present even
// on an empty selection). Calling focusTab() with no matching tab -- e.g.
// pressing Enter with nothing highlighted -- therefore reached
// chrome.tabs.update(NaN, {active:true}), which Chrome rejects with:
//   "Error in invocation of tabs.update(...): No matching signature."
//
// This test mocks chrome.tabs.update to mimic Chrome's real validation (throwing
// when tabId is not an integer) and verifies that:
//   1. focusTab() on a valid highlighted tab activates it with an integer id.
//   2. focusTab() on an empty selection does NOT throw and does NOT call
//      tabs.update with an invalid id.

const puppeteer = require('puppeteer');

(async () => {
    console.log('Starting puppeteer for focusTab regression test...');
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    const pageErrors = [];
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => { pageErrors.push(err.message); console.log('PAGE ERROR:', err.message); });

    await page.setViewport({ width: 550, height: 600 });

    // Mock the chrome API. tabs.update / windows.update mimic Chrome's real
    // signature validation: a non-integer id throws "No matching signature",
    // which is exactly the failure this test guards against.
    await page.evaluateOnNewDocument(() => {
        window.__tabsUpdateCalls = [];
        window.__windowsUpdateCalls = [];
        const requireInteger = (name, id) => {
            if (!Number.isInteger(id)) {
                throw new TypeError(
                    'Error in invocation of ' + name +
                    '(optional integer id, object updateProperties, optional function callback): No matching signature.'
                );
            }
        };
        window.chrome = {
            windows: {
                getAll: (opts, cb) => cb([{ id: 1, incognito: false, tabs: [
                    { id: 10, title: "Test Tab", url: "http://example.com", favIconUrl: "", audible: false, mutedInfo: {muted: false}, pinned: false, highlighted: true, incognito: false }
                ] }]),
                update: (id, props) => { requireInteger('windows.update', id); window.__windowsUpdateCalls.push({ id, props }); }
            },
            tabs: {
                update: (id, props) => { requireInteger('tabs.update', id); window.__tabsUpdateCalls.push({ id, props }); },
                get: () => {},
                remove: () => {}
            },
            runtime: { lastError: null }
        };
    });

    await page.goto('file://' + __dirname + '/popup.htm', { waitUntil: 'networkidle0' });

    let passed = true;
    const check = (cond, okMsg, failMsg) => {
        if (cond) { console.log('✅ ' + okMsg); } else { console.error('❌ ' + failMsg); passed = false; }
    };

    // Case 1: focus a real, existing tab -> tabs.update called with integer id 10.
    const case1 = await page.evaluate(() => {
        window.__tabsUpdateCalls.length = 0;
        window.__windowsUpdateCalls.length = 0;
        let threw = null;
        try { focusTab($('.tab[data-tab-id="10"]')); } catch (e) { threw = e.message; }
        return { threw, tabsCalls: window.__tabsUpdateCalls.slice(), winCalls: window.__windowsUpdateCalls.slice() };
    });
    check(case1.threw === null, 'focusTab on a valid tab did not throw', 'focusTab on a valid tab threw: ' + case1.threw);
    check(case1.tabsCalls.length === 1 && case1.tabsCalls[0].id === 10 && case1.tabsCalls[0].props.active === true,
        'tabs.update called with integer id 10 and {active:true}',
        'tabs.update not called correctly: ' + JSON.stringify(case1.tabsCalls));

    // Case 2 (regression): focusTab on an empty selection must NOT throw and must
    // NOT invoke tabs.update with an invalid id.
    const case2 = await page.evaluate(() => {
        window.__tabsUpdateCalls.length = 0;
        let threw = null;
        // $('.tab.highlight') is empty when nothing is highlighted -- the exact
        // scenario that produced the "No matching signature" TypeError.
        try { focusTab($('.no-such-tab')); } catch (e) { threw = e.message; }
        return { threw, tabsCalls: window.__tabsUpdateCalls.slice() };
    });
    check(case2.threw === null, 'focusTab on an empty selection did not throw', 'focusTab on an empty selection threw: ' + case2.threw);
    check(case2.tabsCalls.length === 0, 'tabs.update was not called for an empty selection', 'tabs.update was wrongly called: ' + JSON.stringify(case2.tabsCalls));

    check(pageErrors.length === 0, 'no uncaught page errors', 'uncaught page errors: ' + JSON.stringify(pageErrors));

    await browser.close();

    if (!passed) {
        console.error('focusTab regression tests failed.');
        process.exit(1);
    }
    console.log('All focusTab regression tests passed successfully!');
    process.exit(0);
})();
