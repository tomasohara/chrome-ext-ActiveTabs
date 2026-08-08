// Regression test for the trace-level logger in assets/debug.js.
//
// Background: the extension's logging was a mix of unconditional console.log
// calls (which flooded DevTools -- background.js dumped every tab object on
// every onUpdated event) and statements commented out to stop that flood.
// assets/debug.js replaces both with numeric trace levels modelled on mezcla's
// debug.py: each statement declares a level and is emitted only when the
// current level is at least that high, with levels 5+ routed to console.debug
// so DevTools' "Verbose" filter hides them even when enabled.
//
// This test loads popup.htm (which pulls in debug.js) and verifies that:
//   1. The default level (USUAL=3) emits levels 1-3 but suppresses 4+.
//   2. Raising the level with setLevel() lets higher-level traces through --
//      the runtime-adjustable behaviour that motivated the module.
//   3. Levels map to the intended console channel (warn / log / debug), which
//      is what keeps verbose traces out of the default DevTools view.
//   4. Function-valued messages are evaluated lazily: never called when the
//      level is inactive, so high-frequency dumps cost nothing when off.
//   5. setLevel() rejects out-of-range values rather than silently accepting.
//   6. The popup's own traces stay silent at the default level (i.e. the
//      re-enabled drawTabs/keyCode traces don't reintroduce the flood).

const puppeteer = require('puppeteer');

(async () => {
    console.log('Starting puppeteer for debug trace-level test...');
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    await page.setViewport({ width: 550, height: 300 });

    // Mock chrome without a storage API on purpose: debug.js must degrade to a
    // process-local level rather than throwing (the same situation as any page
    // that loads it outside the packaged extension).
    await page.evaluateOnNewDocument(() => {
        window.chrome = {
            windows: {
                getAll: (opts, cb) => cb([{ id: 1, incognito: false, tabs: [
                    { id: 10, title: "Test Tab", url: "http://example.com", favIconUrl: "", audible: false, mutedInfo: {muted: false}, pinned: false, highlighted: false, incognito: false }
                ] }]),
                update: () => {},
                get: () => {}
            },
            tabs: {
                update: (id, props, cb) => { if (cb) cb(); },
                get: () => {},
                remove: () => {}
            },
            runtime: { lastError: null }
        };
        // Capture console output by channel so the level->channel mapping can be
        // asserted. Installed before any script runs so nothing is missed.
        window.__logs = { warn: [], log: [], debug: [] };
        ['warn', 'log', 'debug'].forEach(name => {
            const original = console[name].bind(console);
            console[name] = (...args) => { window.__logs[name].push(args.join(' ')); original(...args); };
        });
    });

    await page.goto('file://' + __dirname + '/popup.htm', { waitUntil: 'networkidle0' });

    let passed = true;
    const check = (cond, okMsg, failMsg) => {
        if (cond) { console.log('✅ ' + okMsg); } else { console.error('❌ ' + failMsg); passed = false; }
    };

    // The popup's own load-time traces (drawTabs) must not appear by default.
    const atLoad = await page.evaluate(() => ({
        level: debug.getLevel(),
        logs: JSON.parse(JSON.stringify(window.__logs))
    }));
    check(atLoad.level === 3, 'default level is USUAL (3)', 'unexpected default level: ' + atLoad.level);
    check(atLoad.logs.log.filter(m => m.indexOf('drawTabs:') !== -1).length === 0,
        "drawTabs' DETAILED trace is suppressed at the default level",
        'drawTabs trace leaked into the default view: ' + JSON.stringify(atLoad.logs.log));
    check(atLoad.logs.debug.filter(m => m.indexOf('html:') !== -1).length === 0,
        "drawTabs' VERBOSE html dump is suppressed at the default level",
        'html dump leaked: ' + JSON.stringify(atLoad.logs.debug));

    // Case 1 + 3: default level emits 1-3 only, on the expected channels.
    const case1 = await page.evaluate(() => {
        window.__logs.warn.length = 0;
        window.__logs.log.length = 0;
        window.__logs.debug.length = 0;
        debug.trace(debug.ERROR, 'msg-error');
        debug.trace(debug.WARNING, 'msg-warning');
        debug.trace(debug.USUAL, 'msg-usual');
        debug.trace(debug.DETAILED, 'msg-detailed');
        debug.trace(debug.VERBOSE, 'msg-verbose');
        debug.trace(debug.MOST_VERBOSE, 'msg-most-verbose');
        return JSON.parse(JSON.stringify(window.__logs));
    });
    check(case1.warn.indexOf('msg-error') !== -1 && case1.warn.indexOf('msg-warning') !== -1,
        'ERROR/WARNING emit via console.warn', 'ERROR/WARNING not on warn channel: ' + JSON.stringify(case1.warn));
    check(case1.log.indexOf('msg-usual') !== -1,
        'USUAL emits via console.log', 'USUAL not on log channel: ' + JSON.stringify(case1.log));
    check(case1.log.indexOf('msg-detailed') === -1,
        'DETAILED (4) suppressed at default level 3', 'DETAILED wrongly emitted');
    check(case1.debug.length === 0,
        'VERBOSE and above suppressed at default level 3', 'verbose traces wrongly emitted: ' + JSON.stringify(case1.debug));

    // Case 2 + 3: raising the level lets higher traces through, on console.debug.
    const case2 = await page.evaluate(() => {
        debug.setLevel(7);
        window.__logs.log.length = 0;
        window.__logs.debug.length = 0;
        debug.trace(debug.DETAILED, 'msg-detailed');
        debug.trace(debug.VERBOSE, 'msg-verbose');
        debug.trace(debug.QUITE_VERBOSE, 'msg-quite-verbose');
        debug.trace(debug.MOST_VERBOSE, 'msg-most-verbose');
        return { level: debug.getLevel(), logs: JSON.parse(JSON.stringify(window.__logs)) };
    });
    check(case2.level === 7, 'setLevel(7) took effect at runtime', 'level not updated: ' + case2.level);
    check(case2.logs.log.indexOf('msg-detailed') !== -1,
        'DETAILED emitted once the level is raised', 'DETAILED still suppressed: ' + JSON.stringify(case2.logs.log));
    check(case2.logs.debug.indexOf('msg-verbose') !== -1 && case2.logs.debug.indexOf('msg-quite-verbose') !== -1,
        'VERBOSE/QUITE_VERBOSE emit via console.debug (hidden behind the Verbose filter)',
        'verbose traces not on debug channel: ' + JSON.stringify(case2.logs.debug));
    check(case2.logs.debug.indexOf('msg-most-verbose') === -1,
        'MOST_VERBOSE (9) still suppressed at level 7', 'MOST_VERBOSE wrongly emitted');

    // Case 4: lazy message construction -- the costly callback must not run when
    // the level is inactive. This is what makes the per-event tab dumps free.
    const case4 = await page.evaluate(() => {
        debug.setLevel(3);
        let calls = 0;
        debug.trace(debug.QUITE_VERBOSE, () => { calls += 1; return 'expensive'; });
        const whenInactive = calls;
        debug.setLevel(7);
        debug.trace(debug.QUITE_VERBOSE, () => { calls += 1; return 'expensive'; });
        return { whenInactive, whenActive: calls };
    });
    check(case4.whenInactive === 0, 'lazy message callback not invoked when the level is inactive',
        'callback ran despite inactive level: ' + case4.whenInactive);
    check(case4.whenActive === 1, 'lazy message callback invoked when the level is active',
        'callback not invoked when active: ' + case4.whenActive);

    // Case 5: invalid levels are rejected, leaving the current level intact.
    const case5 = await page.evaluate(() => {
        debug.setLevel(4);
        const results = [debug.setLevel(99), debug.setLevel(-1), debug.setLevel('5')];
        return { results, level: debug.getLevel() };
    });
    check(case5.results.every(r => r === false), 'setLevel rejects out-of-range/non-integer levels',
        'invalid level accepted: ' + JSON.stringify(case5.results));
    check(case5.level === 4, 'level unchanged after a rejected setLevel', 'level was corrupted: ' + case5.level);

    await browser.close();

    if (!passed) {
        console.error('debug trace-level tests failed.');
        process.exit(1);
    }
    console.log('All debug trace-level tests passed successfully!');
    process.exit(0);
})();
