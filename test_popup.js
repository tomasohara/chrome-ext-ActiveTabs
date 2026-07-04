const puppeteer = require('puppeteer');
const Tesseract = require('tesseract.js');
const fs = require('fs');

(async () => {
    console.log('Starting puppeteer to capture screenshot...');
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    
    // Set viewport to the extension's size
    await page.setViewport({ width: 550, height: 600 });
    
    // Mock the chrome API
    await page.evaluateOnNewDocument(() => {
        window.chrome = {
            windows: {
                getAll: (opts, cb) => cb([{ id: 1, incognito: false, tabs: [{ id: 10, title: "Test Tab", url: "http://example.com", favIconUrl: "", audible: false, mutedInfo: {muted: false}, pinned: false, highlighted: false, incognito: false }] }]),
                update: () => {}
            },
            tabs: { update: () => {}, get: () => {}, remove: () => {} },
            runtime: { lastError: null }
        };
    });

    await page.goto('file://' + __dirname + '/popup.htm', { waitUntil: 'networkidle0' });
    
    // Press '?'
    await page.evaluate(() => {
        $('.search').blur();
    });
    await page.keyboard.type('?');

    // Wait a bit for the animation
    await new Promise(r => setTimeout(r, 1000));
    
    const screenshotPath = 'test_screenshot.png';
    await page.screenshot({ path: screenshotPath });
    await browser.close();
    console.log(`Screenshot saved to ${screenshotPath}`);

    console.log('Running OCR on the screenshot using Tesseract.js...');
    const { data: { text } } = await Tesseract.recognize(screenshotPath, 'eng');
    
    console.log('--- OCR EXTRACTED TEXT ---');
    console.log(text);
    console.log('--------------------------');

    // Assertions
    const lowercaseText = text.toLowerCase();
    let passed = true;

    if (lowercaseText.includes('keyboard shortcuts')) {
        console.log('✅ OCR found "Keyboard Shortcuts"!');
    } else {
        console.error('❌ OCR did NOT find "Keyboard Shortcuts"!');
        passed = false;
    }

    if (lowercaseText.includes('close')) {
        console.log('✅ OCR found "Close" button text!');
    } else {
        console.error('❌ OCR did NOT find "Close" button text!');
        passed = false;
    }

    if (!passed) {
        console.error('Tests failed.');
        process.exit(1);
    } else {
        console.log('All tests passed successfully!');
        process.exit(0);
    }
})();
