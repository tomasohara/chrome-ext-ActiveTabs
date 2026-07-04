# Active Tabs (Chrome Extension)

Active Tabs is a Chrome extension that helps you search, filter, and manage your open tabs across all windows. It provides an efficient way to switch tabs, mute audio, pin tabs, and quickly close cluttered windows directly from a central interface.

## Features
- Search and filter across all tabs instantly.
- Keyboard shortcuts for rapid management (close, mute, pin).
- Highlight specific tab states like audible, pinned, and incognito.
- Beautiful, intuitive interface for massive tab hoarders.

## Development

The popup interface is fully contained in `popup.htm`, with styles in `assets/popup.css` and logic in `assets/popup.js`.

### Testing
To verify the popup works correctly and does not have clipping issues, you can run the automated Puppeteer test provided in `test_popup.js`.

```bash
# Install dependencies
npm install puppeteer

# Run the test
node test_popup.js
```

This script will:
1. Mock the `chrome` Extension API so the page doesn't crash outside of the extension environment.
2. Load the `popup.htm` page in a headless browser.
3. Simulate pressing the `?` key to open the help modal.
4. Wait for the fade-in animation.
5. Take a screenshot saved as `test_screenshot.png`. 

You can review `test_screenshot.png` to ensure the "Keyboard Shortcuts" modal is perfectly centered and visible without any clipping issues.
