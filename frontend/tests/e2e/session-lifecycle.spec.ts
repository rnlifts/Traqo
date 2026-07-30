/**
 * E2E Tests: Session Lifecycle
 *
 * Journey 2: Quick-start -> add exercise -> log set -> save & exit ->
 * unresolved banner -> resume -> verify set persists -> exit/discard ->
 * banner gone.
 *
 * Ground truth used to write these selectors (verified against source,
 * not guessed):
 * - QuickStartWorkout (backend/src/modules/sessions/application/use_cases/
 *   quick_start_workout.py) creates a plan + a single empty "Day 1" with
 *   NO exercises. ActiveWorkout.tsx therefore renders only the empty state
 *   ("No exercises in this plan") until the "+ Add Exercise" mid-workout
 *   form (isQuickStart-only, ActiveWorkout.tsx:1313-1361) is used — there
 *   are no set pips to click before that. This was the actual root cause
 *   of the old test hanging on a set-pip click that could never appear.
 * - Set pips carry a real accessible name via aria-label, e.g.
 *   "Set 1, not logged" before logging and "Set 1, logged: ..., tap to
 *   edit" after (ActiveWorkout.tsx:882-900) — precise enough to assert on
 *   directly instead of guessing at visual/text indicators.
 * - Exit button has aria-label="Exit workout" (text is just "‹ Exit").
 * - Exit banner: "Save your progress and exit, or discard this workout?"
 *   with "Save & Exit" / "Discard" / "Keep going" buttons
 *   (ActiveWorkout.tsx:653-695).
 * - Discarding shows a second confirmation (ConfirmDialog, title "Discard
 *   Workout", confirm button also labeled "Discard") — two buttons named
 *   "Discard" exist on screen at once at that point, so the confirm click
 *   must be scoped to the dialog, not matched globally.
 * - Dashboard.tsx unresolved-session banner: "You have an unfinished
 *   workout" with "Resume" / "Mark as Finished" / "Discard" buttons.
 */

import { test, expect, Page } from '@playwright/test';
import { generateTestUser, registerAndLogin, quickStartWorkout } from './fixtures/user';

async function addExerciseMidWorkout(page: Page, exerciseName: string) {
  await page.getByRole('button', { name: '+ Add Exercise' }).click();
  await page.getByPlaceholder('Exercise name').fill(exerciseName);
  // exact:true — otherwise this substring-matches the "+ Add Exercise" toggle button too.
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('h3', { hasText: exerciseName })).toBeVisible({ timeout: 5000 });
}

async function logFirstSet(page: Page, reps: string) {
  await page.getByRole('button', { name: 'Set 1, not logged' }).click();
  await page.getByPlaceholder('e.g. 10 or 10-12').fill(reps);
  await page.getByRole('button', { name: '✓ Log set' }).click();
  await expect(page.getByRole('button', { name: /^Set 1, logged/ })).toBeVisible({ timeout: 5000 });
}

async function confirmDiscardDialog(page: Page) {
  const dialogHeading = page.locator('h2', { hasText: 'Discard Workout' });
  await expect(dialogHeading).toBeVisible({ timeout: 3000 });
  await dialogHeading.locator('..').getByRole('button', { name: 'Discard' }).click();
}

test.describe('Session Lifecycle', () => {
  test('quick-start, log set, save & exit, resume, and discard', async ({ page }) => {
    const user = generateTestUser();
    await registerAndLogin(page, user);

    const sessionId = await quickStartWorkout(page);
    expect(sessionId).toBeGreaterThan(0);

    await expect(page.getByRole('button', { name: 'Exit workout' })).toBeVisible({ timeout: 5000 });

    await addExerciseMidWorkout(page, 'Bench Press');
    await logFirstSet(page, '10');

    // Exit and save (not finish, not discard)
    await page.getByRole('button', { name: 'Exit workout' }).click();
    await expect(page.getByText('Save your progress and exit, or discard this workout?')).toBeVisible({ timeout: 3000 });
    await page.getByRole('button', { name: 'Save & Exit' }).click();
    await page.waitForURL('/dashboard', { timeout: 5000 });

    await expect(page.getByText('You have an unfinished workout')).toBeVisible({ timeout: 3000 });

    // Resume and verify the previously logged set is still there
    await page.getByRole('button', { name: 'Resume' }).click();
    await page.waitForURL(/\/workout-sessions\/\d+/, { timeout: 5000 });
    await expect(page.getByRole('button', { name: /^Set 1, logged/ })).toBeVisible({ timeout: 5000 });

    // Exit again and this time discard
    await page.getByRole('button', { name: 'Exit workout' }).click();
    await expect(page.getByText('Save your progress and exit, or discard this workout?')).toBeVisible({ timeout: 3000 });
    await page.getByRole('button', { name: 'Discard' }).click();
    await confirmDiscardDialog(page);

    await page.waitForURL('/dashboard', { timeout: 5000 });
    await expect(page.getByText('You have an unfinished workout')).not.toBeVisible();
    await expect(page.getByText('Welcome back')).toBeVisible({ timeout: 3000 });
  });

  test('409 error when attempting to start second session with unresolved session', async ({ page }) => {
    const user = generateTestUser();
    await registerAndLogin(page, user);

    const sessionId1 = await quickStartWorkout(page);
    expect(sessionId1).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Exit workout' }).click();
    await expect(page.getByText('Save your progress and exit, or discard this workout?')).toBeVisible({ timeout: 3000 });
    await page.getByRole('button', { name: 'Save & Exit' }).click();
    await page.waitForURL('/dashboard', { timeout: 5000 });

    await expect(page.getByText('You have an unfinished workout')).toBeVisible({ timeout: 3000 });

    // Attempting another quick-start must fail with 409 and show the real error toast text.
    await page.getByRole('button', { name: 'Start Today' }).click();
    await expect(page.getByText('Finish or discard your unresolved workout before starting a new one')).toBeVisible({ timeout: 3000 });

    expect(page.url()).toContain('/dashboard');
    await expect(page.getByText('You have an unfinished workout')).toBeVisible({ timeout: 2000 });
  });

  test('session sets persist across resume', async ({ page }) => {
    const user = generateTestUser();
    await registerAndLogin(page, user);

    await quickStartWorkout(page);
    await addExerciseMidWorkout(page, 'Squat');
    await logFirstSet(page, '12');

    await page.getByRole('button', { name: 'Exit workout' }).click();
    await expect(page.getByText('Save your progress and exit, or discard this workout?')).toBeVisible({ timeout: 3000 });
    await page.getByRole('button', { name: 'Save & Exit' }).click();
    await page.waitForURL('/dashboard', { timeout: 5000 });

    await page.getByRole('button', { name: 'Resume' }).click();
    await page.waitForURL(/\/workout-sessions\/\d+/, { timeout: 5000 });

    const loggedPip = page.getByRole('button', { name: /^Set 1, logged/ });
    await expect(loggedPip).toBeVisible({ timeout: 5000 });
    await expect(loggedPip).toHaveAccessibleName(/12 reps/);
  });
});
