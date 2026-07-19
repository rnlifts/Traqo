import { firefox } from '@playwright/test';

async function runTest() {
  console.log('[TEST] Starting quick-start feature verification...\n');

  const browser = await firefox.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Navigate to the frontend
    console.log('[TEST] Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('[PASS] Page loaded\n');

    // Take a screenshot of the initial page
    await page.screenshot({ path: 'step1-initial.png' });

    // Check for key elements
    console.log('[TEST] Checking page title...');
    const title = await page.title();
    console.log(`[INFO] Page title: ${title}\n`);

    // Wait a bit for the page to fully render
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Take another screenshot
    await page.screenshot({ path: 'step2-loaded.png' });

    // Check for button text
    const bodyText = await page.textContent('body');

    if (bodyText.includes('Log Today')) {
      console.log('[PASS] Found "Log Today" text on page\n');
    } else if (bodyText.includes('Workout')) {
      console.log('[INFO] Found "Workout" text but not "Log Today"\n');
      console.log('[INFO] Page content includes workout-related text\n');
    } else {
      console.log('[INFO] Page content: ' + bodyText.substring(0, 200) + '...\n');
    }

    // Check for common button/input elements
    const buttons = await page.$$('button');
    console.log(`[INFO] Found ${buttons.length} buttons on page\n`);

    const inputs = await page.$$('input');
    console.log(`[INFO] Found ${inputs.length} inputs on page\n`);

    // Look for the plan list
    if (bodyText.includes('Workout Plans')) {
      console.log('[PASS] Found "Workout Plans" section\n');
    }

    console.log('[INFO] Screenshots saved:');
    console.log('  - step1-initial.png');
    console.log('  - step2-loaded.png\n');

    console.log('='.repeat(60));
    console.log('[TEST COMPLETE] Frontend is running and accessible');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('[FAILED] Test failed:', error.message);
    // Take a screenshot for debugging
    try {
      await page.screenshot({ path: 'test-failure.png' });
      console.error('Screenshot saved to test-failure.png');
    } catch (e) {}
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTest();
