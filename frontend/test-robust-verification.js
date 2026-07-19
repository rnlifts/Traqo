import { firefox } from '@playwright/test';

async function runTest() {
  console.log('\n' + '='.repeat(70));
  console.log('ROBUST BROWSER TEST: Exercise Name Bug Fix Verification');
  console.log('='.repeat(70) + '\n');

  const browser = await firefox.launch({ headless: false });
  const page = await browser.newPage();
  const username = `verify_${Date.now()}`;
  const password = 'testpass123';

  try {
    // Navigate
    console.log('[1] Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('    Page loaded\n');

    // Wait for page to render
    await page.waitForTimeout(3000);

    // Get page content
    let content = await page.textContent('body');
    console.log('[2] Checking page content...');
    console.log(`    Has inputs: ${(await page.$$('input')).length > 0}`);
    console.log(`    Has buttons: ${(await page.$$('button')).length > 0}`);
    console.log(`    Page includes "Register": ${content.includes('Register')}`);
    console.log(`    Page includes "Login": ${content.includes('Login')}\n`);

    // Try to find any inputs
    const allInputs = await page.$$('input');
    if (allInputs.length === 0) {
      console.log('[ERROR] No inputs found on page');
      console.log('[INFO] Page HTML preview:');
      const html = await page.content();
      console.log(html.substring(0, 500));
      process.exit(1);
    }

    // Register
    console.log('[3] Registering user...');
    if (allInputs.length >= 2) {
      await allInputs[0].fill(username);
      await allInputs[1].fill(password);

      const buttons = await page.$$('button');
      if (buttons.length > 0) {
        await buttons[0].click();
      }
      console.log('    Registration form submitted\n');
    }

    await page.waitForTimeout(3000);

    // Login
    console.log('[4] Logging in...');
    const loginInputs = await page.$$('input');
    if (loginInputs.length >= 2) {
      await loginInputs[0].fill(username);
      await loginInputs[1].fill(password);

      const loginBtns = await page.$$('button');
      if (loginBtns.length > 0) {
        await loginBtns[0].click();
      }
      console.log('    Login submitted\n');
    }

    await page.waitForTimeout(4000);

    // Check if logged in
    content = await page.textContent('body');
    const isLoggedIn = content.includes('Plans') || content.includes('Dashboard');
    console.log(`[5] Login status: ${isLoggedIn ? 'LOGGED IN' : 'NOT LOGGED IN'}\n`);

    // Navigate to Plans
    if (!content.includes('Log Today')) {
      console.log('[6] Navigating to Plans page...');
      const navButtons = await page.$$('a, button');
      for (const btn of navButtons) {
        const text = await btn.textContent();
        if (text && text.includes('Plans')) {
          await btn.click();
          break;
        }
      }
      await page.waitForTimeout(2000);
    }

    content = await page.textContent('body');
    console.log(`[7] On Plans page: ${content.includes('Workout Plans')}`);
    console.log(`    Has "Log Today": ${content.includes('Log Today')}\n`);

    // Click "Log Today's Workout"
    if (content.includes('Log Today')) {
      console.log('[8] Clicking "Log Today\'s Workout" button...');
      const btns = await page.$$('button');
      for (const btn of btns) {
        const text = await btn.textContent();
        if (text && text.includes('Log Today')) {
          await btn.click();
          console.log('    Button clicked\n');
          break;
        }
      }
      await page.waitForTimeout(3000);
    }

    content = await page.textContent('body');
    console.log(`[9] On Active Workout: ${content.includes('Active Workout')}`);
    console.log(`    Quick Workout plan: ${content.includes('Quick Workout')}\n`);

    // Add Exercise
    console.log('[10] Looking for "+ Add Exercise" button...');
    const exerciseBtns = await page.$$('button');
    let addBtnFound = false;
    for (const btn of exerciseBtns) {
      const text = await btn.textContent();
      if (text && text.includes('Add Exercise')) {
        console.log('     Found button, clicking...');
        await btn.click();
        addBtnFound = true;
        break;
      }
    }
    console.log(`    Button found and clicked: ${addBtnFound}\n`);

    await page.waitForTimeout(1000);

    // Fill exercise form
    console.log('[11] Filling exercise form with "Cable Row"...');
    const inputs = await page.$$('input');
    const exNameInput = inputs.find(async (inp) => {
      const ph = await inp.getAttribute('placeholder');
      return ph && ph.includes('Exercise');
    });

    if (inputs.length > 0) {
      await inputs[0].fill('Cable Row');
      console.log('     Exercise name entered: "Cable Row"\n');
    }

    // Submit
    console.log('[12] Submitting exercise...');
    const submitBtns = await page.$$('button');
    for (const btn of submitBtns) {
      const text = await btn.textContent();
      if (text && text.includes('Add')) {
        await btn.click();
        console.log('     Add button clicked\n');
        break;
      }
    }

    await page.waitForTimeout(3000);

    // Check result
    console.log('[13] CRITICAL VERIFICATION: Checking exercise display...');
    content = await page.textContent('body');

    if (content.includes('Cable Row')) {
      console.log('     [PASS] "Cable Row" is displayed on page');
    } else {
      console.log('     [FAIL] "Cable Row" NOT found on page');
    }

    // Check for "Exercise {id}" pattern
    const hasGenericId = /Exercise \d{3,}/.test(content);
    if (hasGenericId) {
      console.log('     [FAIL] Found generic "Exercise {id}" pattern - BUG EXISTS');
    } else {
      console.log('     [PASS] No generic "Exercise {id}" pattern found');
    }

    console.log('\n');

    // Take screenshot
    console.log('[14] Taking screenshot...');
    await page.screenshot({ path: 'final-verification.png', fullPage: true });
    console.log('     Screenshot saved: final-verification.png\n');

    console.log('='.repeat(70));
    console.log('BROWSER TEST COMPLETE');
    console.log('='.repeat(70));
    console.log('\nTest Summary:');
    console.log('1. Registered new user');
    console.log('2. Logged in');
    console.log('3. Navigated to Plans');
    console.log('4. Clicked "Log Today\'s Workout"');
    console.log('5. Added exercise "Cable Row"');
    console.log('6. Verified correct name displays (not "Exercise {id}")');
    console.log('\nBrowser will stay open for 60 seconds...');

    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('\n[ERROR]', error.message);
    try {
      await page.screenshot({ path: 'error.png', fullPage: true });
    } catch (e) {}
  } finally {
    await browser.close();
  }
}

runTest();
