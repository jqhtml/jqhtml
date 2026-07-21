#!/usr/bin/env node

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Collect console messages
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    console.log(text);
  });

  // Collect errors
  page.on('pageerror', error => {
    console.error('❌ Page error:', error.message);
  });

  // Load test page
  const testFile = 'file://' + path.join(__dirname, 'test-dom-restriction.html');
  await page.goto(testFile);

  // Wait for tests to complete
  await page.waitForTimeout(2000);

  await browser.close();

  // Check results
  console.log('\n========================================');
  console.log('Test Summary');
  console.log('========================================');

  const tests = [
    { name: 'Test 1 (Valid Component)', pass: logs.some(l => l.includes('[Test 1] ✅ Component rendered successfully')) },
    { name: 'Test 2 (Block this.$)', pass: logs.some(l => l.includes('[Test 2] ✅ Correctly threw error')) },
    { name: 'Test 3 (Block this.$id)', pass: logs.some(l => l.includes('[Test 3] ✅ Correctly threw error')) },
    { name: 'Test 4 (Block this.id)', pass: logs.some(l => l.includes('[Test 4] ✅ Correctly threw error')) },
    { name: 'Test 5 (Block property set)', pass: logs.some(l => l.includes('[Test 5] ✅ Correctly threw error')) },
    { name: 'Test 6 (Allow this.args)', pass: logs.some(l => l.includes('[Test 6] this.args.user_id = 42')) },
    { name: 'Test 7 (Allow methods)', pass: logs.some(l => l.includes('[Test 7] Component name: Valid_Call_Methods')) }
  ];

  let passed = 0;
  tests.forEach(test => {
    console.log(`${test.pass ? '✅' : '❌'} ${test.name}`);
    if (test.pass) passed++;
  });

  console.log(`\n${passed}/${tests.length} tests passed`);

  if (passed === tests.length) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  }
})();
