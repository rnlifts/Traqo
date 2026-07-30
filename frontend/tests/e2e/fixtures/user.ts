/**
 * User creation and auth helpers for E2E tests.
 */

import { Page } from '@playwright/test';

export interface TestUser {
  displayName: string;
  username: string;
  password: string;
}

/**
 * Generate a unique test user with timestamp-based username to avoid collisions.
 */
export function generateTestUser(): TestUser {
  const timestamp = Date.now();
  // Username must fit the 3-20 char limit enforced by the register form
  // (Task 33/34) — "testuser" + a full 13-digit timestamp is 21 chars and
  // is permanently rejected by client-side format validation, which leaves
  // the submit button disabled forever, not just slow to enable.
  const shortSuffix = timestamp.toString().slice(-8);
  // Two calls in the same test can land in the same millisecond (e.g. two
  // `generateTestUser()` calls back-to-back with no `await` between them),
  // which would otherwise produce identical usernames and leave the second
  // user's Register button permanently disabled ("username already taken").
  const random = Math.random().toString(36).slice(2, 6);
  return {
    displayName: `Test User ${timestamp}`,
    username: `t${shortSuffix}${random}`,
    password: 'TestPassword123!',
  };
}

/**
 * Register a new user via the UI.
 * Navigates to /register, fills form, submits, and waits for success dialog.
 */
export async function registerUser(page: Page, user: TestUser): Promise<void> {
  await page.goto('/register');

  // Fill registration form (uses id, not name)
  await page.fill('#displayName', user.displayName);
  await page.fill('#username', user.username);
  await page.fill('#password', user.password);

  // Submit and wait for success (may stay on /register or show success dialog)
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/register/, { timeout: 10000 });
}

/**
 * Login via the UI.
 * Assumes user is on /login, fills credentials, submits, and waits for Dashboard.
 */
export async function loginUser(page: Page, user: TestUser): Promise<void> {
  await page.fill('#username', user.username);
  await page.fill('#password', user.password);

  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard', { timeout: 10000 });
}

/**
 * Register and login in one call.
 */
export async function registerAndLogin(page: Page, user: TestUser): Promise<void> {
  await registerUser(page, user);
  await page.goto('/login');
  await loginUser(page, user);
}

/**
 * Start a quick-start workout from the dashboard.
 * Assumes user is on /dashboard. Returns the session ID.
 */
export async function quickStartWorkout(page: Page): Promise<number> {
  // Click "Start Today" button
  await page.getByRole('button', { name: /start today/i }).click();

  // Wait for navigation to /workout-sessions/{id}
  await page.waitForURL(/\/workout-sessions\/\d+/, { timeout: 10000 });

  // Extract session ID from URL
  const url = page.url();
  const match = url.match(/\/workout-sessions\/(\d+)/);
  if (!match || !match[1]) {
    throw new Error(`Could not extract session ID from URL: ${url}`);
  }
  return parseInt(match[1], 10);
}

/**
 * Log a workout set in the active workout.
 * Assumes user is on an active workout page (/workout-sessions/{id}).
 * Clicks on the first exercise card to open the set logging panel.
 */
export async function logWorkoutSet(
  page: Page,
  options: {
    weight?: number;
    reps?: string;
    duration?: number; // in seconds
  } = {}
): Promise<void> {
  // Click on the first exercise card to open set logging
  const exerciseCards = page.locator('[class*="card"]');
  const firstCard = exerciseCards.first();

  // Find and click on a set button or the card itself
  // The cards have numbered set buttons like "Set 1", "Set 2", etc.
  const setButtons = firstCard.getByRole('button');
  const firstSetButton = setButtons.filter({ hasText: /^Set 1/ }).first();

  if (await firstSetButton.isVisible().catch(() => false)) {
    await firstSetButton.click();
  } else {
    // Fallback: click on the card to see if it opens the panel
    await firstCard.click();
  }

  // Wait for the set logging panel to appear
  await page.waitForTimeout(500);

  // Fill in weight if provided
  if (options.weight !== undefined) {
    const weightInputs = page.locator('input[type="number"]');
    for (let i = 0; i < await weightInputs.count(); i++) {
      const input = weightInputs.nth(i);
      const label = await input.evaluate(el => {
        // Look for nearby label text
        return el.previousElementSibling?.textContent || '';
      });
      if (label.toLowerCase().includes('weight')) {
        await input.fill(options.weight.toString());
        break;
      }
    }
  }

  // Fill in reps if provided
  if (options.reps !== undefined) {
    const repsInputs = page.locator('input[type="text"]');
    for (let i = 0; i < await repsInputs.count(); i++) {
      const input = repsInputs.nth(i);
      const placeholder = await input.getAttribute('placeholder');
      if (placeholder && placeholder.toLowerCase().includes('rep')) {
        await input.fill(options.reps);
        break;
      }
    }
  }

  // Click the save/log button
  const saveButton = page.getByRole('button', { name: /log|save|done/i }).first();
  await saveButton.click();

  // Wait for the panel to close and set to be logged
  await page.waitForTimeout(500);
}
