import { firefox } from '@playwright/test';

async function runTest() {
  console.log('\n' + '='.repeat(70));
  console.log('FINAL BROWSER TEST: Exercise Name Display Verification');
  console.log('='.repeat(70) + '\n');

  const browser = await firefox.launch({ headless: false });
  const page = await browser.newPage();
  const username = `test_${Date.now()}`;
  const password = 'testpass123';

  try {
    console.log('[1] Navigating to frontend...');
    await page.goto('http://localhost:5173', { waitUntil: 'load', timeout: 30000 });

    // Wait for React app to render
    console.log('[2] Waiting for React app to load...');
    await page.waitForFunction(
      () => document.body.textContent.includes('Traqo') || document.body.textContent.includes('Login'),
      { timeout: 15000 }
    );
    console.log('    App loaded\n');

    // Wait more for full render
    await page.waitForTimeout(2000);

    let content = await page.textContent('body');
    console.log(`[3] Page content check:`);
    console.log(`    Contains "Login": ${content.includes('Login')}`);
    console.log(`    Contains "Register": ${content.includes('Register')}\n`);

    // Get all inputs and buttons
    const inputs = await page.$$('input');
    const buttons = await page.$$('button');
    console.log(`[4] Page elements:`);
    console.log(`    Inputs found: ${inputs.length}`);
    console.log(`    Buttons found: ${buttons.length}\n`);

    if (inputs.length < 2) {
      console.log('[ERROR] Not enough inputs on page');
      process.exit(1);
    }

    // Register
    console.log('[5] Registering user...');
    await inputs[0].fill(username);
    await inputs[1].fill(password);
    await buttons[0].click();
    console.log('    Submitted\n');

    await page.waitForTimeout(3000);

    // Login
    console.log('[6] Logging in...');
    const loginInputs = await page.$$('input');
    if (loginInputs.length >= 2) {
      await loginInputs[0].fill(username);
      await loginInputs[1].fill(password);

      const loginButtons = await page.$$('button');
      if (loginButtons.length > 0) {
        await loginButtons[0].click();
      }
    }
    console.log('    Submitted\n');

    // Wait for navigation
    await page.waitForFunction(
      () => document.body.textContent.includes('Plans') || document.body.textContent.includes('Dashboard'),
      { timeout: 15000 }
    );

    content = await page.textContent('body');
    console.log(`[7] Logged in, checking for Plans...\n`);

    // Navigate to Plans if needed
    if (!content.includes('Log Today')) {
      console.log('[8] Clicking Plans navigation...');
      const allButtons = await page.$$('button, a');
      for (const btn of allButtons) {
        const text = await btn.textContent();
        if (text && text.includes('Plans')) {
          await btn.click();
          break;
        }
      }
      await page.waitForTimeout(2000);
    }

    // Click "Log Today's Workout"
    console.log('[9] Clicking "Log Today\'s Workout"...');
    const planButtons = await page.$$('button');
    for (const btn of planButtons) {
      const text = await btn.textContent();
      if (text && text.includes('Log Today')) {
        await btn.click();
        console.log('    Clicked\n');
        break;
      }
    }

    // Wait for active workout page
    await page.waitForFunction(
      () => document.body.textContent.includes('Active Workout') || document.body.textContent.includes('Quick Workout'),
      { timeout: 15000 }
    );

    console.log('[10] On Active Workout page\n');

    await page.waitForTimeout(2000);

    // Take screenshot of initial state
    await page.screenshot({ path: 'step1-before-exercise.png', fullPage: true });
    console.log('[11] Screenshot 1 taken: step1-before-exercise.png\n');

    // Click "+ Add Exercise"
    console.log('[12] Clicking "+ Add Exercise"...');
    const workoutButtons = await page.$$('button');
    let foundAddButton = false;
    for (const btn of workoutButtons) {
      const text = await btn.textContent();
      if (text && text.includes('Add Exercise')) {
        await btn.click();
        foundAddButton = true;
        console.log('    Clicked\n');
        break;
      }
    }

    if (!foundAddButton) {
      console.log('[ERROR] Could not find "+ Add Exercise" button');
    }

    await page.waitForTimeout(1500);

    // Fill in exercise
    console.log('[13] Filling exercise form...');
    const formInputs = await page.$$('input');
    if (formInputs.length > 0) {
      // Find the exercise name input
      const exerciseInput = formInputs.find(async (inp) => {
        const ph = await inp.getAttribute('placeholder');
        return ph && ph.toLowerCase().includes('exercise');
      });

      if (exerciseInput) {
        await exerciseInput.fill('Cable Row');
      } else if (formInputs.length > 0) {
        // Just use the first visible input
        await formInputs[0].fill('Cable Row');
      }

      console.log('    Entered: "Cable Row"');

      // Fill targets if present
      if (formInputs.length >= 3) {
        // Assume last 3 inputs are Sets, Reps, Weight
        const targetInputs = formInputs.slice(-3);
        await targetInputs[0].fill('3');
        await targetInputs[1].fill('8');
        await targetInputs[2].fill('180');
        console.log('    Entered targets: 3 sets, 8 reps, 180 lbs\n');
      }
    }

    // Submit
    console.log('[14] Submitting exercise...');
    const allBtns = await page.$$('button');
    let submitted = false;
    for (const btn of allBtns) {
      const text = await btn.textContent();
      if (text && (text.includes('Add') && !text.includes('Add Exercise'))) {
        await btn.click();
        submitted = true;
        console.log('    Clicked Add button\n');
        break;
      }
    }

    await page.waitForTimeout(3000);

    // Verify result
    console.log('[15] CRITICAL CHECK: Verifying exercise name display...');
    const finalContent = await page.textContent('body');

    let passed = false;
    if (finalContent.includes('Cable Row')) {
      console.log('    [PASS] "Cable Row" IS displayed on page');
      passed = true;
    } else {
      console.log('    [FAIL] "Cable Row" NOT found');
    }

    // Check for generic pattern
    const genericPattern = /Exercise \d{2,}/;
    if (genericPattern.test(finalContent)) {
      console.log('    [WARNING] Found generic "Exercise {id}" pattern');
    } else {
      console.log('    [OK] No generic "Exercise {id}" pattern found');
    }

    console.log('\n');

    // Take final screenshot
    await page.screenshot({ path: 'step2-after-exercise.png', fullPage: true });
    console.log('[16] Screenshot 2 taken: step2-after-exercise.png\n');

    console.log('='.repeat(70));
    console.log('BROWSER TEST COMPLETE');
    console.log('='.repeat(70));
    console.log('\nWhat was tested:');
    console.log('1. Registered new user');
    console.log('2. Logged in successfully');
    console.log('3. Clicked "Log Today\'s Workout"');
    console.log('4. Viewed Active Workout with auto-generated plan name');
    console.log('5. Clicked "+ Add Exercise"');
    console.log('6. Filled form with exercise "Cable Row"');
    console.log('7. Submitted exercise');
    console.log('8. Verified correct name displays\n');

    if (passed) {
      console.log('Result: BUG FIX VERIFIED - Exercise name displays correctly!\n');
    } else {
      console.log('Result: ISSUE FOUND - Exercise name not displaying correctly\n');
    }

    console.log('Browser will remain open for 90 seconds for manual verification...');
    await page.waitForTimeout(90000);

  } catch (error) {
    console.error('\n[ERROR] Test failed:', error.message);
    try {
      await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
      console.log('[INFO] Error screenshot saved');
    } catch (e) {}
  } finally {
    await browser.close();
  }
}

runTest();
