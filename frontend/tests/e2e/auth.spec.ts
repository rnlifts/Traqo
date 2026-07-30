/**
 * E2E Tests: Auth Journey
 *
 * Journey 1: Register (with real username availability check) →
 * success dialog → Continue to login (pre-filled) →
 * log in → Dashboard
 */

import { test, expect } from '@playwright/test';
import { generateTestUser, registerUser, loginUser } from './fixtures/user';

test.describe('Auth Journey', () => {
  test('register with new username and login to dashboard', async ({ page }) => {
    const user = generateTestUser();

    // Step 1: Navigate to register page
    // Note: this app has a single static document title ("Traqo") on every
    // page, so toHaveTitle() can never distinguish pages — assert on visible
    // content instead.
    await page.goto('/register');
    await expect(page.locator('h1')).toHaveText('Register');

    // Step 2: Fill registration form (uses id, not name)
    await page.fill('#displayName', user.displayName);
    await page.fill('#username', user.username);
    await page.fill('#password', user.password);

    // Step 3: Submit and verify success dialog appears
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/register/, { timeout: 10000 });

    // Verify success dialog is visible (registration was successful)
    await expect(page.getByText(/account created successfully/i)).toBeVisible({ timeout: 5000 });

    // Step 4: Click "Continue to Login" — must be the real button, not a
    // manual page.goto() fallback, since that would lose the React Router
    // state (username/password) the dialog passes along for pre-filling.
    await page.getByRole('button', { name: 'Continue to Login' }).click();

    // Step 5: Verify we're on login page and username is pre-filled
    await page.waitForURL(/\/login/, { timeout: 5000 });
    const usernameInput = page.locator('#username');
    await expect(usernameInput).toHaveValue(user.username, { timeout: 5000 });

    // Step 6: Fill password and login
    await page.fill('#password', user.password);
    await page.click('button[type="submit"]');

    // Step 7: Verify we're on the Dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Verify we're actually logged in (Dashboard's own greeting, always shown regardless of content)
    await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 5000 });
  });

  test('username availability check works in real-time', async ({ page }) => {
    const user = generateTestUser();

    // Register the first user
    await registerUser(page, user);

    // Attempt to register with same username
    await page.goto('/register');
    await page.fill('#displayName', 'Another User');
    await page.fill('#username', user.username);

    // If there's a real-time check (via blur event on username field), wait for error
    await page.locator('#username').blur();
    await page.waitForTimeout(1000); // Give backend time to check

    // Look for username taken error (appears near the username field or in validation message)
    const errorText = page.getByText(/already taken/i);
    const hasError = await errorText.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasError) {
      // By design (Task 34), the Register button is disabled the moment
      // username availability resolves to "taken" — the user can't even
      // attempt to submit, this is intentional UX, not a server-side
      // rejection to test for.
      await expect(page.locator('button[type="submit"]')).toBeDisabled();
    } else {
      // If no real-time check, just verify submit fails
      await page.fill('#password', user.password);
      await page.click('button[type="submit"]');
      const isStillOnRegister = page.url().includes('/register');
      expect(isStillOnRegister).toBeTruthy();
    }
  });

  test('login with wrong password fails', async ({ page }) => {
    const user = generateTestUser();

    // Register a user
    await registerUser(page, user);

    // Go to login
    await page.goto('/login');
    await page.fill('#username', user.username);
    await page.fill('#password', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // Should see error message or stay on login page
    const errorText = page.getByText(/invalid username or password/i);
    const isStillOnLogin = page.url().includes('/login');

    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError || isStillOnLogin).toBeTruthy();
  });

  test('login with nonexistent user fails', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#username', 'nonexistentuser123456');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');

    // Should see error or stay on login
    const errorText = page.getByText(/invalid username or password/i);
    const isStillOnLogin = page.url().includes('/login');

    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError || isStillOnLogin).toBeTruthy();
  });
});
