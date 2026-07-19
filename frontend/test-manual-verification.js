import { firefox } from '@playwright/test';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('\n' + '='.repeat(70));
  console.log('MANUAL BROWSER VERIFICATION TEST');
  console.log('Testing: Exercise name display after mid-workout addition');
  console.log('='.repeat(70) + '\n');

  const browser = await firefox.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const username = `manual_${Date.now()}`;
    const password = 'testpass123';

    // Navigate to app
    console.log('Step 1: Opening application at http://localhost:5173\n');
    await page.goto('http://localhost:5173', { timeout: 30000 });
    await sleep(3000);

    // Interact with register
    console.log('Step 2: Registering user (watch the browser for the form)\n');
    const registerInputs = await page.locator('input').all();
    if (registerInputs.length >= 2) {
      await registerInputs[0].fill(username);
      await registerInputs[1].fill(password);
      await page.locator('button').first().click();
      await sleep(2000);
    }

    // Login
    console.log('Step 3: Logging in with registered account\n');
    const loginInputs = await page.locator('input').all();
    if (loginInputs.length >= 2) {
      await loginInputs[0].fill(username);
      await loginInputs[1].fill(password);
      await page.locator('button').first().click();
      await sleep(3000);
    }

    // Navigate to plans
    console.log('Step 4: Navigating to Workout Plans\n');
    const navButtons = await page.locator('button, a').all();
    for (const btn of navButtons) {
      const text = await btn.textContent();
      if (text && text.includes('Plans')) {
        await btn.click();
        break;
      }
    }
    await sleep(2000);

    // Click Log Today
    console.log('Step 5: Clicking "Log Today\'s Workout" button\n');
    const allButtons = await page.locator('button').all();
    for (const btn of allButtons) {
      const text = await btn.textContent();
      if (text && text.includes('Log Today')) {
        await btn.click();
        break;
      }
    }
    await sleep(3000);

    // Screenshot: Before adding exercise
    console.log('SCREENSHOT 1: Active Workout Page (before adding exercise)');
    await page.screenshot({ path: 'manual-1-active-workout.png', fullPage: true });
    console.log('Saved: manual-1-active-workout.png\n');

    // Add exercise
    console.log('Step 6: Clicking "+ Add Exercise" button\n');
    const exerciseButtons = await page.locator('button').all();
    for (const btn of exerciseButtons) {
      const text = await btn.textContent();
      if (text && text.includes('Add Exercise')) {
        await btn.click();
        break;
      }
    }
    await sleep(1500);

    // Fill form
    console.log('Step 7: Filling exercise form\n');
    const formInputs = await page.locator('input').all();
    if (formInputs.length > 0) {
      await formInputs[0].fill('Cable Row');
      if (formInputs.length >= 3) {
        await formInputs[formInputs.length - 3].fill('3');
        await formInputs[formInputs.length - 2].fill('8');
        await formInputs[formInputs.length - 1].fill('180');
      }
    }

    // Screenshot: Form filled
    console.log('SCREENSHOT 2: Exercise form filled with "Cable Row"\n');
    await page.screenshot({ path: 'manual-2-form-filled.png', fullPage: true });
    console.log('Saved: manual-2-form-filled.png\n');

    // Submit
    console.log('Step 8: Submitting exercise\n');
    const submitButtons = await page.locator('button').all();
    for (const btn of submitButtons) {
      const text = await btn.textContent();
      if (text && text.trim() === 'Add') {
        await btn.click();
        break;
      }
    }
    await sleep(4000);

    // Screenshot: After submission
    console.log('SCREENSHOT 3: After exercise added (CRITICAL - check if shows "Cable Row" not "Exercise 123")\n');
    await page.screenshot({ path: 'manual-3-after-submit.png', fullPage: true });
    console.log('Saved: manual-3-after-submit.png\n');

    // Verify text
    const bodyText = await page.textContent('body');
    console.log('Text Content Verification:\n');
    if (bodyText.includes('Cable Row')) {
      console.log('  [PASS] "Cable Row" is displayed on the page');
    } else {
      console.log('  [FAIL] "Cable Row" NOT found on page');
    }

    if (/Exercise \d{2,}/.test(bodyText)) {
      console.log('  [FAIL] Found generic "Exercise {id}" pattern - BUG STILL EXISTS');
    } else {
      console.log('  [PASS] No generic "Exercise {id}" pattern found');
    }

    console.log('\n' + '='.repeat(70));
    console.log('BROWSER TEST COMPLETE - Three screenshots saved');
    console.log('='.repeat(70));
    console.log('\nTo verify the fix worked:');
    console.log('1. Check manual-3-after-submit.png');
    console.log('2. Look for "Cable Row" in the exercise card');
    console.log('3. It should NOT show "Exercise 123" or similar generic text\n');

    console.log('Browser will close after 20 seconds...');
    await sleep(20000);

  } catch (error) {
    console.error('\nERROR:', error.message);
    console.error('This might be a timing issue. Check the screenshots manually.');
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

runTest();
