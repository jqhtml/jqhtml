import { chromium } from 'playwright';

async function runTests() {
  console.log('Starting Playwright tests for JQHTML Core Runtime Bundle...\n');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Capture console messages
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });
  
  // Capture page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });
  
  try {
    console.log('Loading test page...');
    await page.goto('http://localhost:3000/test-bundle.html', { 
      waitUntil: 'networkidle' 
    });
    
    // Wait for tests to complete
    await page.waitForTimeout(1000);
    
    // Check for errors
    console.log('\n=== Page Errors ===');
    if (pageErrors.length > 0) {
      pageErrors.forEach(err => console.error('ERROR:', err));
    } else {
      console.log('No page errors ✓');
    }
    
    // Check if jQuery loaded
    const hasJQuery = await page.evaluate(() => typeof $ !== 'undefined');
    console.log('\njQuery loaded:', hasJQuery ? '✓' : '✗');
    
    // Check if JQHTML loaded
    const hasJQHTML = await page.evaluate(() => 
      typeof Component !== 'undefined' && 
      typeof LifecycleManager !== 'undefined' &&
      typeof register_component === 'function'
    );
    console.log('JQHTML loaded:', hasJQHTML ? '✓' : '✗');
    
    // Get test results
    const testResults = await page.$$eval('.test', elements => 
      elements.map(el => ({
        passed: el.classList.contains('pass'),
        failed: el.classList.contains('fail'),
        text: el.innerText.split('\n')[0] // First line only
      }))
    );
    
    console.log('\n=== Test Results ===');
    const totalTests = testResults.filter(r => r.passed || r.failed).length;
    const passedTests = testResults.filter(r => r.passed).length;
    
    testResults.forEach(result => {
      if (result.passed || result.failed) {
        const status = result.passed ? '✅' : '❌';
        console.log(`${status} ${result.text}`);
      }
    });
    
    console.log(`\nTotal: ${passedTests}/${totalTests} tests passed`);
    
    // Check component output
    const componentCount = await page.$$eval('.Component', els => els.length);
    console.log(`\nComponents rendered: ${componentCount}`);
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results.png', fullPage: true });
    console.log('\nScreenshot saved to test-results.png');
    
    // Return success/failure
    if (passedTests === totalTests && totalTests > 0) {
      console.log('\n✅ ALL TESTS PASSED!');
      process.exit(0);
    } else {
      console.log('\n❌ TESTS FAILED');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTests().catch(console.error);