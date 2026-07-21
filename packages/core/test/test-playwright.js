import { chromium } from 'playwright';

async function runTests() {
  console.log('Starting Playwright tests for JQHTML Core Runtime...\n');
  
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
    await page.goto('http://localhost:3000/test-core.html', { 
      waitUntil: 'networkidle' 
    });
    
    // Wait a bit for tests to run
    await page.waitForTimeout(1000);
    
    // Check for module loading errors
    console.log('\n=== Page Errors ===');
    if (pageErrors.length > 0) {
      pageErrors.forEach(err => console.error('ERROR:', err));
    } else {
      console.log('No page errors');
    }
    
    console.log('\n=== Console Logs ===');
    consoleLogs.forEach(log => {
      console.log(`[${log.type.toUpperCase()}]`, log.text);
    });
    
    // Check if jQuery loaded
    const hasJQuery = await page.evaluate(() => typeof $ !== 'undefined');
    console.log('\njQuery loaded:', hasJQuery);
    
    // Check if any test results were rendered
    const testResults = await page.$$eval('.test', elements => 
      elements.map(el => ({
        passed: el.classList.contains('pass'),
        failed: el.classList.contains('fail'),
        text: el.innerText
      }))
    );
    
    console.log('\n=== Test Results ===');
    if (testResults.length === 0) {
      console.log('No tests were executed - likely due to module loading errors');
    } else {
      testResults.forEach(result => {
        const status = result.passed ? '✅ PASS' : '❌ FAIL';
        console.log(`${status}: ${result.text}`);
      });
    }
    
    // Check the actual error in the page
    const moduleError = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[type="module"]'));
      return scripts.length > 0 ? 'Has module scripts' : 'No module scripts';
    });
    console.log('\nModule script status:', moduleError);
    
  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    await browser.close();
  }
}

runTests().catch(console.error);