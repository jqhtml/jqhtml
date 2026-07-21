#!/usr/bin/env node

/**
 * Test sourcemap in actual browser with visual output
 */

import { chromium } from 'playwright';
import path from 'path';

const jsFile = process.argv[2] || 'test-components/counter-widget-baseline.js';
const htmlFile = process.argv[3] || 'test-components/counter-widget-baseline_test.html';

console.log('Opening browser to test sourcemap...');
console.log(`JS File: ${jsFile}`);
console.log(`HTML File: ${htmlFile}`);

const browser = await chromium.launch({
  headless: true  // Run in headless mode for server environments
});

const context = await browser.newContext();
const page = await context.newPage();

// Listen for console errors
page.on('console', msg => {
  if (msg.type() === 'error') {
    console.log('Browser error:', msg.text());
    console.log('Location:', msg.location());
  }
});

page.on('pageerror', error => {
  console.log('Page error:', error.message);
  console.log('Stack:', error.stack);
});

// Navigate to the test page
const fullPath = `file://${path.resolve(htmlFile)}`;
console.log(`Navigating to: ${fullPath}`);

await page.goto(fullPath);

console.log('\nCheck the browser DevTools:');
console.log('1. Open the Console tab');
console.log('2. Look for the error from foobar3()');
console.log('3. Check if it shows .jqhtml:28 or .js:35');
console.log('4. Click on the error location to see if it opens the source');
console.log('\nPress Ctrl+C to close the browser...');

// Keep browser open
await new Promise(() => {});