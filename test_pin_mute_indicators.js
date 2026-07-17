// Regression test for the pin (📌) / mute (🔇) indicators not updating live.
//
// Background: drawTabs() tags a pinned/muted row with '_pinned'/'_muted'
// classes (assets/popup.css keys the indicator icons off those classes), but
// updateTab() -- run when 'm'/'p' is pressed -- only updated jQuery's internal
// .data() cache and the data-search keyword text. The class list and
// data-<property> attribute stayed stale until the next drawTabs() redraw, so
// the icons didn't appear/disappear until the popup was reopened. updateTab()
// now also toggles the class and attribute immediately.
//
// This test presses 'p' then 'm' on a highlighted tab and verifies that:
//   1. The row starts with neither class/icon.
//   2. Pressing 'p' immediately adds _pinned, data-pinned, the _pinned
//      data-search keyword, and the pin icon -- no redraw needed.
//   3. Pressing 'm' stacks _muted alongside _pinned and shows both icons.
//   4. Pressing 'p' again removes _pinned/its icon while _muted/its icon stay.

const puppeteer = require('puppeteer');

(async () => {
    console.log('Starting puppeteer for pin/mute indicator regression test...');
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
                    { id: 10, title: "Regular Tab", url: "http://a.example.com", favIconUrl: "", audible: false, mutedInfo: {muted: false}, pinned: false, highlighted: false, incognito: false }
                ] }]),
                update: () => {}
            },
            tabs: {
                update: (id, props, cb) => { if (cb) cb(); },
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

    const rowState = () => page.evaluate(() => {
        const li = document.querySelector('#content .tab');
        return {
            classes: li.className,
            dataPinned: li.getAttribute('data-pinned'),
            dataMuted: li.getAttribute('data-muted'),
            dataSearch: li.getAttribute('data-search'),
            titleBefore: getComputedStyle(li.querySelector('.title'), '::before').content
        };
    });

    await page.evaluate(() => { $('.search').blur(); });
    await page.keyboard.press('ArrowDown');

    let s = await rowState();
    check(s.classes === 'tab highlight', 'starts unpinned/unmuted with no icon', 'unexpected initial state: ' + JSON.stringify(s));
    check(s.titleBefore === 'none', 'no pin/mute icon before toggling', 'icon present before toggling: ' + s.titleBefore);

    // Press 'p' -- pin should apply immediately, no popup reload needed.
    await page.keyboard.press('KeyP');
    s = await rowState();
    check(s.classes.indexOf('_pinned') !== -1, "'p' added the _pinned class immediately", 'class not updated: ' + s.classes);
    check(s.dataPinned === 'true', "'p' updated data-pinned attribute immediately", 'data-pinned stale: ' + s.dataPinned);
    check(s.dataSearch.indexOf('_pinned') !== -1, 'data-search keyword updated too', 'data-search missing _pinned: ' + s.dataSearch);
    check(s.titleBefore === '"📌 "', 'pin icon renders immediately after pressing p', 'pin icon wrong: ' + s.titleBefore);

    // Press 'm' -- mute should stack with the existing pin icon.
    await page.keyboard.press('KeyM');
    s = await rowState();
    check(s.classes.indexOf('_muted') !== -1 && s.classes.indexOf('_pinned') !== -1, "'m' added _muted while _pinned remains", 'classes wrong: ' + s.classes);
    check(s.titleBefore === '"📌 🔇 "', 'combined pin+mute icon renders', 'combined icon wrong: ' + s.titleBefore);

    // Press 'p' again -- unpin, mute icon alone should remain.
    await page.keyboard.press('KeyP');
    s = await rowState();
    check(s.classes.indexOf('_pinned') === -1 && s.classes.indexOf('_muted') !== -1, 'unpinning removes _pinned but keeps _muted', 'classes wrong: ' + s.classes);
    check(s.titleBefore === '"🔇 "', 'mute-only icon renders after unpinning', 'mute-only icon wrong: ' + s.titleBefore);

    await browser.close();

    if (!passed) {
        console.error('Pin/mute indicator regression tests failed.');
        process.exit(1);
    }
    console.log('All pin/mute indicator regression tests passed successfully!');
    process.exit(0);
})();
