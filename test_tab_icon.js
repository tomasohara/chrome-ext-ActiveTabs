// Regression test for the tab-icon "net::ERR_FILE_NOT_FOUND" (undefined:1) error.
//
// Background: drawTabs() rendered each tab's icon as
//   background-image:url(<tab.icon>)
// When a tab had no favIconUrl (property absent), tab.icon was undefined and the
// markup became `background-image:url(undefined)`, so the browser tried to fetch
// a file literally named "undefined" and logged:
//   Failed to load resource: net::ERR_FILE_NOT_FOUND   (undefined:1)
//
// This test renders a window whose tabs cover the three cases -- a real icon, an
// absent favIconUrl, and an empty-string favIconUrl -- and verifies that:
//   1. The generated HTML never contains "url(undefined)".
//   2. No request is made for a resource named "undefined".
//   3. The tab that does have an icon still renders its background-image.

const puppeteer = require('puppeteer');

(async () => {
    console.log('Starting puppeteer for tab-icon regression test...');
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    const badRequests = [];
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    page.on('requestfailed', req => {
        const url = req.url();
        if (/\/undefined$/.test(url) || url.endsWith('undefined')) { badRequests.push(url); }
    });

    await page.setViewport({ width: 550, height: 600 });

    // Mock chrome. The three tabs exercise: a real icon, an ABSENT favIconUrl
    // (the regression trigger), and an empty-string favIconUrl.
    await page.evaluateOnNewDocument(() => {
        window.chrome = {
            windows: {
                getAll: (opts, cb) => cb([{ id: 1, incognito: false, tabs: [
                    { id: 10, title: "Has Icon",    url: "http://a.example.com", favIconUrl: "assets/close.png", audible: false, mutedInfo: {muted: false}, pinned: false, highlighted: true,  incognito: false },
                    { id: 11, title: "No Icon Prop", url: "http://b.example.com", /* favIconUrl absent */          audible: false, mutedInfo: {muted: false}, pinned: false, highlighted: false, incognito: false },
                    { id: 12, title: "Empty Icon",  url: "http://c.example.com", favIconUrl: "",                  audible: false, mutedInfo: {muted: false}, pinned: false, highlighted: false, incognito: false }
                ] }]),
                update: () => {}
            },
            tabs: { update: () => {}, get: () => {}, remove: () => {} },
            runtime: { lastError: null }
        };
    });

    await page.goto('file://' + __dirname + '/popup.htm', { waitUntil: 'networkidle0' });

    // Give drawTabs() a moment to render.
    await new Promise(r => setTimeout(r, 300));

    let passed = true;
    const check = (cond, okMsg, failMsg) => {
        if (cond) { console.log('✅ ' + okMsg); } else { console.error('❌ ' + failMsg); passed = false; }
    };

    const result = await page.evaluate(() => {
        const contentHtml = document.getElementById('content').innerHTML;
        const iconSpan = document.querySelector('.tab[data-tab-id="10"] .icon span');
        return {
            hasUndefinedUrl: contentHtml.indexOf('url(undefined)') !== -1,
            tabCount: document.querySelectorAll('#content .tab').length,
            iconBg: iconSpan ? iconSpan.getAttribute('style') : null
        };
    });

    check(!result.hasUndefinedUrl, 'rendered HTML contains no url(undefined)', 'rendered HTML still contains url(undefined)');
    check(badRequests.length === 0, 'no request for a resource named "undefined"', 'requested bogus resource(s): ' + JSON.stringify(badRequests));
    check(result.tabCount === 3, 'all 3 tabs rendered', 'expected 3 tabs, got ' + result.tabCount);
    check(!!result.iconBg && result.iconBg.indexOf('background-image') !== -1,
        'tab with a real icon still sets background-image',
        'tab with a real icon lost its background-image: ' + result.iconBg);

    await browser.close();

    if (!passed) {
        console.error('tab-icon regression tests failed.');
        process.exit(1);
    }
    console.log('All tab-icon regression tests passed successfully!');
    process.exit(0);
})();
