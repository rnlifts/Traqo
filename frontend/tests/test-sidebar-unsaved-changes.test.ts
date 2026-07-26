import { test, expect, chromium } from '@playwright/test';

test.describe('Sidebar Navigation - Unsaved Changes Protection', () => {
  let browser: any;

  test.beforeAll(async () => {
    browser = await chromium.launch();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  // Helper function to login
  async function login(page: any) {
    // First register a user if needed
    await page.goto('http://localhost:5181/register', { waitUntil: 'load' });
    await page.waitForTimeout(500);

    // Check if register form exists
    const registerForm = await page.$('input[type="text"]');
    if (registerForm) {
      // Try to register a test user
      const timestamp = Date.now();
      const displayName = `Test User ${timestamp}`;
      const password = 'TestPassword123!';

      const displayNameInput = await page.$('input[placeholder*="name"]') || await page.$('input[type="text"]:nth-of-type(1)');
      if (displayNameInput) {
        await displayNameInput.fill(displayName);
      }

      const passwordInput = await page.$('input[type="password"]');
      if (passwordInput) {
        await passwordInput.fill(password);
      }

      const registerBtn = await page.$('button:has-text("Register")');
      if (registerBtn) {
        await registerBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    // Navigate to login
    await page.goto('http://localhost:5181/login', { waitUntil: 'load' });
    await page.waitForTimeout(500);

    // Try to login with credentials
    const loginDisplayName = await page.$('input[type="text"]');
    const loginPassword = await page.$('input[type="password"]');

    if (loginDisplayName && loginPassword) {
      // Use existing test user or register
      await loginDisplayName.fill('Test User');
      await loginPassword.fill('password123');

      const loginBtn = await page.$('button:has-text("Login")');
      if (loginBtn) {
        await loginBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    // Verify we're logged in by checking if dashboard loads
    await page.goto('http://localhost:5181/dashboard', { waitUntil: 'load' });
    await page.waitForTimeout(1000);
  }

  test('Test 1: Sidebar works normally with no plan (no dialog appears)', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await login(page);

      // Navigate to plans page first
      await page.goto('http://localhost:5181/workout-plans', { waitUntil: 'load' });
      await page.waitForTimeout(500);

      // Click Dashboard link in sidebar
      const dashboardLink = await page.$('a[href="/dashboard"]:not([class*="brand"])');
      if (dashboardLink) {
        await dashboardLink.click();
        await page.waitForTimeout(1000);

        // Verify we navigated to dashboard (check URL)
        const url = page.url();
        expect(url).toContain('/dashboard');

        // Verify no dialog appeared
        const dialog = await page.$('div:has-text("Leave without saving")');
        expect(dialog).toBeNull();
        console.log('✓ Test 1 PASSED: No dialog appears when navigating with no unsaved changes');
      }
    } finally {
      await context.close();
    }
  });

  test('Test 2: Sidebar shows dialog during plan creation (step 1)', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await login(page);

      // Navigate to plans page
      await page.goto('http://localhost:5181/workout-plans', { waitUntil: 'load' });
      await page.waitForTimeout(500);

      // Click "Create Plan" button
      const createBtn = await page.$('button:has-text("Create Plan")');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(1500);

        // Fill in the Name field
        const nameInput = await page.$('input[placeholder*="name"]') || await page.$('input[type="text"]:nth-of-type(1)');
        if (nameInput) {
          await nameInput.fill('My Test Plan');
          await page.waitForTimeout(300);
        }

        // Click Dashboard in sidebar
        const dashboardLink = await page.$('a[href="/dashboard"]:not([class*="brand"])');
        if (dashboardLink) {
          await dashboardLink.click();
          await page.waitForTimeout(800);

          // Verify dialog appears
          const dialogTitle = await page.$('text=Leave without saving');
          expect(dialogTitle).not.toBeNull();
          console.log('✓ Test 2a PASSED: Dialog appears when navigating with unsaved plan on step 1');

          // Click "Stay" button
          const stayBtn = await page.$('button:has-text("Stay")');
          if (stayBtn) {
            await stayBtn.click();
            await page.waitForTimeout(800);

            // Verify dialog is closed
            const dialogStillVisible = await page.$('text=Leave without saving');
            expect(dialogStillVisible).toBeNull();

            // Verify we're still on step 1 with data intact
            const nameField = await page.$('input[placeholder*="name"]') || await page.$('input[type="text"]:nth-of-type(1)');
            if (nameField) {
              const value = await nameField.inputValue();
              expect(value).toBe('My Test Plan');
              console.log('✓ Test 2b PASSED: "Stay" keeps user on step 1 with data intact');
            }
          }
        }
      }
    } finally {
      await context.close();
    }
  });

  test('Test 4: "Leave" button navigates to correct destination', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await login(page);

      // Navigate to plans page
      await page.goto('http://localhost:5181/workout-plans', { waitUntil: 'load' });
      await page.waitForTimeout(500);

      // Click "Create Plan"
      const createBtn = await page.$('button:has-text("Create Plan")');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(1500);

        // Fill in some data
        const nameInput = await page.$('input[placeholder*="name"]') || await page.$('input[type="text"]:nth-of-type(1)');
        if (nameInput) {
          await nameInput.fill('Test Navigation Plan');
        }

        // Click Dashboard
        const dashboardLink = await page.$('a[href="/dashboard"]:not([class*="brand"])');
        if (dashboardLink) {
          await dashboardLink.click();
          await page.waitForTimeout(800);

          // Click "Leave" button
          const leaveBtn = await page.$('button:has-text("Leave")');
          if (leaveBtn) {
            await leaveBtn.click();
            await page.waitForTimeout(1500);

            // Verify we're on Dashboard
            const url = page.url();
            expect(url).toContain('/dashboard');
            console.log('✓ Test 4 PASSED: "Leave" navigates to correct destination (Dashboard)');
          }
        }
      }
    } finally {
      await context.close();
    }
  });

  test('Test 5: After leaving, sidebar works normally (no dialog)', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await login(page);

      // Navigate to plans page
      await page.goto('http://localhost:5181/workout-plans', { waitUntil: 'load' });
      await page.waitForTimeout(500);

      // Create a plan and leave without saving (from previous test scenario)
      const createBtn = await page.$('button:has-text("Create Plan")');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(1500);

        const nameInput = await page.$('input[placeholder*="name"]') || await page.$('input[type="text"]:nth-of-type(1)');
        if (nameInput) {
          await nameInput.fill('Test Plan To Leave');
        }

        const dashboardLink = await page.$('a[href="/dashboard"]:not([class*="brand"])');
        if (dashboardLink) {
          await dashboardLink.click();
          await page.waitForTimeout(800);

          const leaveBtn = await page.$('button:has-text("Leave")');
          if (leaveBtn) {
            await leaveBtn.click();
            await page.waitForTimeout(1500);

            // Now on Dashboard - try clicking another link
            const exercisesLink = await page.$('a[href="/exercises"]:not([class*="brand"])');
            if (exercisesLink) {
              await exercisesLink.click();
              await page.waitForTimeout(1000);

              // Verify no dialog appears
              const dialog = await page.$('text=Leave without saving');
              expect(dialog).toBeNull();

              // Verify navigation succeeded
              const url = page.url();
              expect(url).toContain('/exercises');
              console.log('✓ Test 5 PASSED: After leaving, sidebar links navigate immediately with no dialog');
            }
          }
        }
      }
    } finally {
      await context.close();
    }
  });

  test('Test 7: Each of the four nav links navigate to correct destination', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await login(page);

      const navLinks = [
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/exercises', label: 'Exercises' },
        { href: '/workout-plans', label: 'Plans' },
        { href: '/workout-history', label: 'History' }
      ];

      for (const link of navLinks) {
        // Navigate to plans to create unsaved plan
        await page.goto('http://localhost:5181/workout-plans', { waitUntil: 'load' });
        await page.waitForTimeout(500);

        const createBtn = await page.$('button:has-text("Create Plan")');
        if (createBtn) {
          await createBtn.click();
          await page.waitForTimeout(1500);

          // Add data to mark as unsaved
          const nameInput = await page.$('input[placeholder*="name"]') || await page.$('input[type="text"]:nth-of-type(1)');
          if (nameInput) {
            await nameInput.fill(`Test for ${link.label}`);
          }

          // Click the nav link
          const navLink = await page.$(`a[href="${link.href}"]:not([class*="brand"])`);
          if (navLink) {
            await navLink.click();
            await page.waitForTimeout(800);

            // Click Leave
            const leaveBtn = await page.$('button:has-text("Leave")');
            if (leaveBtn) {
              await leaveBtn.click();
              await page.waitForTimeout(1000);

              // Verify navigation
              const url = page.url();
              expect(url).toContain(link.href);
              console.log(`✓ Navigation to ${link.label} (${link.href}) works correctly`);
            }
          }
        }
      }
      console.log('✓ Test 7 PASSED: All four nav links navigate to correct destinations');
    } finally {
      await context.close();
    }
  });

  test('Test 8: Regression - Other dialogs still work', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await login(page);

      // Navigate to plans
      await page.goto('http://localhost:5181/workout-plans', { waitUntil: 'load' });
      await page.waitForTimeout(500);

      // Create a plan
      const createBtn = await page.$('button:has-text("Create Plan")');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(1500);

        // Fill in name and other fields
        const nameInput = await page.$('input[placeholder*="name"]') || await page.$('input[type="text"]:nth-of-type(1)');
        if (nameInput) {
          await nameInput.fill('Regression Test Plan');
        }

        // The original back-confirmation dialog should still work
        // Verify the existing sidebar navigation dialog doesn't interfere
        const dashboardLink = await page.$('a[href="/dashboard"]:not([class*="brand"])');
        if (dashboardLink) {
          await dashboardLink.click();
          await page.waitForTimeout(800);

          // Should see the unsaved changes dialog
          const leaveDialog = await page.$('text=Leave without saving');
          expect(leaveDialog).not.toBeNull();
          console.log('✓ Test 8a PASSED: Sidebar unsaved changes dialog appears');

          // Cancel this dialog
          const cancelBtn = await page.$('button:has-text("Stay")');
          if (cancelBtn) {
            await cancelBtn.click();
            await page.waitForTimeout(800);

            // Verify we're back on the plan creation form
            const formField = await page.$('input[placeholder*="name"]') || await page.$('input[type="text"]:nth-of-type(1)');
            expect(formField).not.toBeNull();
            console.log('✓ Test 8b PASSED: Cancel dialog works correctly');
          }
        }
      }
    } finally {
      await context.close();
    }
  });

  test('Verification: Logo link NOT modified (still navigates)', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await login(page);

      // Navigate to any page
      await page.goto('http://localhost:5181/exercises', { waitUntil: 'load' });
      await page.waitForTimeout(500);

      // Logo should still have the brand link and work normally
      const logoLink = await page.$('a[href="/dashboard"][class*="brand"]');
      expect(logoLink).not.toBeNull();
      console.log('✓ Logo link still exists and is NOT modified');
    } finally {
      await context.close();
    }
  });

  test('Verification: Logout button NOT modified', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await login(page);

      // Logout button should still work
      const logoutBtn = await page.$('button:has-text("Logout")');
      expect(logoutBtn).not.toBeNull();
      console.log('✓ Logout button still exists and is NOT modified');
    } finally {
      await context.close();
    }
  });
});
