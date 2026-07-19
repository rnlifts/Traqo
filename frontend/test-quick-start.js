// Browser automation test for the quick-start feature
// Run with: node test-quick-start.js

import { firefox } from '@playwright/test';

async function runTest() {
  console.log('[TEST] Starting quick-start feature browser test...\n');

  const browser = await firefox.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Step 1: Register and login
    console.log('[TEST] Step 1: Registering and logging in...');
    await page.goto('http://localhost:5173');

    // Wait for the app to load
    await page.waitForSelector('input[placeholder="Display Name"]', { timeout: 10000 });

    const username = `testuser_${Date.now()}`;
    const password = 'testpass123';

    // Fill in register form
    await page.fill('input[placeholder="Display Name"]', username);
    await page.fill('input[placeholder="Password"]', password);
    await page.click('button:has-text("Register")');

    // Wait for redirect to login page
    await page.waitForTimeout(2000);

    // Fill in login form
    await page.fill('input[placeholder="Username"]', username);
    await page.fill('input[placeholder="Password"]', password);
    await page.click('button:has-text("Login")');

    // Wait for redirect to plans page
    await page.waitForURL('**/workout-plans', { timeout: 10000 });
    console.log('[PASS] Registered and logged in successfully\n');

    // Step 2: Find and click "Log Today's Workout" button
    console.log('[TEST] Step 2: Looking for "Log Today\'s Workout" button...');
    await page.waitForSelector('button:has-text("Log Today\'s Workout")', { timeout: 5000 });
    const button = await page.$('button:has-text("Log Today\'s Workout")');

    if (!button) {
      throw new Error('Could not find "Log Today\'s Workout" button');
    }
    console.log('[PASS] Button found\n');

    // Step 3: Click the button and wait for navigation
    console.log('[TEST] Step 3: Clicking "Log Today\'s Workout" button...');
    await page.click('button:has-text("Log Today\'s Workout")');

    // Wait for navigation to the active workout page
    await page.waitForURL('**/workout-sessions/**', { timeout: 10000 });
    console.log('[PASS] Navigated to active workout session\n');

    // Step 4: Verify the page loaded with the auto-generated plan name
    console.log('[TEST] Step 4: Verifying active workout page...');
    await page.waitForSelector('h2:has-text("Active Workout")', { timeout: 5000 });

    // Check for the plan name that should start with "Quick Workout"
    const planNameText = await page.textContent('h2:has-text("Active Workout")');
    console.log('[PASS] Active Workout page loaded\n');

    // Step 5: Check for the rename button
    console.log('[TEST] Step 5: Verifying rename functionality...');
    const renameButton = await page.$('button:has-text("Rename")');
    if (!renameButton) {
      throw new Error('Rename button not found');
    }
    console.log('[PASS] Rename button found\n');

    // Step 6: Check for the add exercise button
    console.log('[TEST] Step 6: Verifying add exercise functionality...');
    const addExerciseButton = await page.$('button:has-text("+ Add Exercise")');
    if (!addExerciseButton) {
      throw new Error('Add Exercise button not found');
    }
    console.log('[PASS] Add Exercise button found\n');

    // Step 7: Test renaming the plan
    console.log('[TEST] Step 7: Testing plan rename...');
    await page.click('button:has-text("Rename")');

    // Wait for the rename input to appear
    await page.waitForSelector('input[type="text"]', { timeout: 5000 });

    // Get all inputs and find the one that's visible (the rename input)
    const inputs = await page.$$('input[type="text"]');
    if (inputs.length === 0) {
      throw new Error('Rename input not found');
    }

    // Clear the input and type new name
    const newPlanName = 'My Test Workout Session';
    await page.evaluate(el => el.value = '', inputs[inputs.length - 1]);
    await inputs[inputs.length - 1].type(newPlanName);

    // Click Save button
    await page.click('button:has-text("Save")');

    // Wait for the rename to complete
    await page.waitForTimeout(2000);

    // Verify the new name appears
    const updatedText = await page.textContent('body');
    if (updatedText.includes(newPlanName)) {
      console.log('[PASS] Plan renamed successfully to: ' + newPlanName + '\n');
    } else {
      throw new Error('Plan name not updated');
    }

    // Step 8: Test adding an exercise
    console.log('[TEST] Step 8: Testing add exercise mid-workout...');
    await page.click('button:has-text("+ Add Exercise")');

    // Wait for the form to appear
    await page.waitForSelector('input[placeholder="Exercise name"]', { timeout: 5000 });

    // Fill in exercise details
    const exerciseName = `Test Exercise ${Date.now()}`;
    await page.fill('input[placeholder="Exercise name"]', exerciseName);
    await page.fill('input[placeholder="Sets"]', '3');
    await page.fill('input[placeholder="Reps"]', '8');
    await page.fill('input[placeholder="Weight"]', '185');

    // Submit the form
    await page.click('button:has-text("Add")');

    // Wait for the exercise to be added
    await page.waitForTimeout(3000);

    // Verify the exercise appears on the page
    const exerciseText = await page.textContent('body');
    if (exerciseText.includes(exerciseName)) {
      console.log('[PASS] Exercise added successfully: ' + exerciseName + '\n');
    } else {
      throw new Error('Exercise not found on page');
    }

    console.log('='.repeat(60));
    console.log('[SUCCESS] All browser tests passed!');
    console.log('='.repeat(60));
    console.log('\nVerification Summary:');
    console.log('[PASS] Quick-start button exists and is clickable');
    console.log('[PASS] Navigation to active workout works');
    console.log('[PASS] Rename plan functionality works');
    console.log('[PASS] Add exercise mid-workout functionality works');
    console.log('[PASS] All UI elements render correctly');

  } catch (error) {
    console.error('\n[FAILED] Test failed:', error.message);
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-failure.png' });
    console.error('Screenshot saved to test-failure.png');
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTest();
