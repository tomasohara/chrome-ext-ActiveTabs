// Regression test for unescaped tab titles/urls breaking the rendered tab row.
//
// Background: drawTabs() built each row's HTML via raw string concatenation,
// dropping tab.title/tab.url straight into double-quoted attributes
// (data-search, data-tab-name) and text content with no escaping. An ordinary
// page title containing a '"' or '<' would break out of the attribute/tag and
// corrupt the row's markup. escapeHtml() now runs on both before they're
// concatenated into the row.
//
// This test renders a tab whose title embeds a double-quote and a fake <b>
// tag, and verifies that:
//   1. Exactly one .tab row is rendered (the title didn't fragment the row
//      into extra elements/attributes).
//   2. The title renders back as literal text, not as markup.
//   3. No real <b> element got injected into the DOM.
//   4. data-search still carries the (HTML-decoded) raw title, so searching
//      for ordinary words in a title like this still works.

const puppeteer = require('puppeteer');

(async () => {
    console.log('Starting puppeteer for HTML-escaping regression test...');
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    await page.setViewport({ width: 550, height: 300 });

    await page.evaluateOnNewDocument(() => {
        window.chrome = {
            windows: {
                getAll: (opts, cb) => cb([{ id: 1, incognito: false, tabs: [
                    { id: 10, title: 'He said "hi" <b>bold</b>', url: 'http://example.com/?a=1&b=2', favIconUrl: "", audible: false, mutedInfo: {muted: false}, pinned: false, highlighted: false, incognito: false }
                ] }]),
                update: () => {}
            },
            tabs: { update: () => {}, get: () => {}, remove: () => {} },
            runtime: { lastError: null }
        };
    });

    await page.goto('file://' + __dirname + '/popup.htm', { waitUntil: 'networkidle0' });

    let passed = true;
    const check = (cond, okMsg, failMsg) => {
        if (cond) { console.log('✅ ' + okMsg); } else { console.error('❌ ' + failMsg); passed = false; }
    };

    const result = await page.evaluate(() => {
        const rows = document.querySelectorAll('#content .tab');
        const titleEl = document.querySelector('#content .tab .title');
        return {
            rowCount: rows.length,
            titleText: titleEl ? titleEl.textContent : null,
            injectedBoldTags: document.querySelectorAll('#content b').length,
            dataSearch: rows[0] ? rows[0].getAttribute('data-search') : null
        };
    });

    check(result.rowCount === 1, 'exactly one .tab row rendered (no attribute breakout)', 'row count wrong: ' + result.rowCount);
    check(result.titleText === 'He said "hi" <b>bold</b>', 'title renders as literal text, not markup', 'title mismatch: ' + JSON.stringify(result.titleText));
    check(result.injectedBoldTags === 0, 'no real <b> element got injected into the DOM', 'a <b> element was injected -- HTML was not escaped');
    check(!!result.dataSearch && result.dataSearch.indexOf('he said "hi"') !== -1, 'data-search still contains the decoded raw title for searching', 'data-search broken: ' + JSON.stringify(result.dataSearch));

    await browser.close();

    if (!passed) {
        console.error('HTML-escaping regression tests failed.');
        process.exit(1);
    }
    console.log('All HTML-escaping regression tests passed successfully!');
    process.exit(0);
})();
