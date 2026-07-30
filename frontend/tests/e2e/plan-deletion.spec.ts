/**
 * E2E Tests: Plan Deletion Cascade
 *
 * Journey 4: Create plan -> start session -> log a set -> finish ->
 * delete plan -> verify gone from plan list and dashboard history, and
 * that deletion is scoped to the owning user only.
 *
 * Ground truth used to write these selectors (verified against source,
 * not guessed):
 * - CreatePlanPage never navigates between step 1 and step 2 — see the
 *   note in plan-and-library.spec.ts. Wait for the builder's
 *   <h2>{planName}</h2>, not a URL change.
 * - PlanList.tsx: "Start" button -> `/workout-plans/:id/start`; delete is
 *   the "✕" button (aria-label="Delete plan") which opens a ConfirmDialog
 *   titled "Delete Workout Plan" with a "Delete" confirm button.
 * - SessionSetupPage.tsx: for a single-day, non-quick-start plan the day
 *   picker doesn't render (only shown for multi-day or quick-start plans)
 *   — the single day is auto-selected, so "Begin workout →" can be
 *   clicked directly.
 * - ActiveWorkout.tsx: "Finish Workout" opens a ConfirmDialog titled
 *   "Finish Workout" with a "Finish" confirm button, then shows a
 *   "Workout complete!" summary screen with a "Done" button that calls
 *   onFinish() -> navigates to /dashboard (ActiveWorkoutPage.handleFinish).
 */

import { test, expect, Page } from '@playwright/test';
import { generateTestUser, registerAndLogin } from './fixtures/user';

async function createPlanWithExercise(page: Page, planName: string, exerciseName: string) {
  await page.goto('/workout-plans/new');
  await page.fill('#planName', planName);
  await page.getByRole('button', { name: '1 Day' }).click();
  await page.getByRole('button', { name: 'Continue →' }).click();

  await expect(page.locator('h2', { hasText: planName })).toBeVisible({ timeout: 5000 });

  await page.getByPlaceholder('Search exercises...').fill(exerciseName);
  const resultCard = page.locator('div').filter({ hasText: exerciseName }).filter({ has: page.getByRole('button', { name: '+ Add' }) }).last();
  await expect(resultCard).toBeVisible({ timeout: 5000 });
  await resultCard.getByRole('button', { name: '+ Add' }).click();

  const exerciseRow = page.locator('.exercise-row').filter({ hasText: exerciseName });
  await expect(exerciseRow).toBeVisible({ timeout: 5000 });
  await exerciseRow.getByPlaceholder('Sets').fill('3');

  await page.getByRole('button', { name: 'Save Plan' }).click();
  // Create mode always confirms via a second dialog ("Save this plan?")
  // before actually persisting (PlanBuilder.tsx:1305-1317).
  await expect(page.locator('h2', { hasText: 'Save this plan?' })).toBeVisible({ timeout: 3000 });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL('/workout-plans', { timeout: 10000 });
  await expect(page.getByText(planName)).toBeVisible({ timeout: 5000 });
}

async function deletePlan(page: Page, planName: string) {
  const planCard = page.locator('.plan-card').filter({ hasText: planName });
  await planCard.getByRole('button', { name: 'Delete plan' }).click();

  const dialogHeading = page.locator('h2', { hasText: 'Delete Workout Plan' });
  await expect(dialogHeading).toBeVisible({ timeout: 3000 });
  await dialogHeading.locator('..').getByRole('button', { name: 'Delete' }).click();
}

test.describe('Plan Deletion Cascade', () => {
  test('delete plan removes it from plan list and workout history', async ({ page }) => {
    const user = generateTestUser();
    await registerAndLogin(page, user);

    const planName = `Delete Test ${Date.now()}`;
    await createPlanWithExercise(page, planName, 'Front Squat');

    // Start a real session from the plan and log a set, so there's
    // history to verify disappears along with the plan.
    const planCard = page.locator('.plan-card').filter({ hasText: planName });
    await planCard.getByRole('button', { name: '▶ Start' }).click();
    await page.waitForURL(/\/workout-plans\/\d+\/start/, { timeout: 5000 });

    await page.getByRole('button', { name: 'Begin workout →' }).click();
    await page.waitForURL(/\/workout-sessions\/\d+/, { timeout: 10000 });

    await page.getByRole('button', { name: 'Set 1, not logged' }).click();
    await page.getByPlaceholder('e.g. 10 or 10-12').fill('10');
    await page.getByRole('button', { name: '✓ Log set' }).click();
    await expect(page.getByRole('button', { name: /^Set 1, logged/ })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Finish Workout' }).click();
    const finishDialog = page.locator('h2', { hasText: 'Finish Workout' });
    await expect(finishDialog).toBeVisible({ timeout: 3000 });
    await finishDialog.locator('..').getByRole('button', { name: 'Finish' }).click();

    await expect(page.getByText('Workout complete!')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Done' }).click();
    await page.waitForURL('/dashboard', { timeout: 5000 });

    // Delete the plan
    await page.goto('/workout-plans');
    await expect(page.getByText(planName)).toBeVisible({ timeout: 5000 });
    await deletePlan(page, planName);
    await expect(page.getByText(planName)).not.toBeVisible({ timeout: 5000 });

    // Verify it's also gone from the dashboard's recent-workouts history
    await page.goto('/dashboard');
    await expect(page.getByText(planName)).not.toBeVisible();
  });

  test('plan deletion does not affect other users plans', async ({ page, context }) => {
    const user1 = generateTestUser();
    const user2 = generateTestUser();

    await registerAndLogin(page, user1);
    const user1PlanName = `Isolation Delete Test ${Date.now()}`;
    await createPlanWithExercise(page, user1PlanName, 'Front Squat');

    const page2 = await context.newPage();
    await registerAndLogin(page2, user2);
    const user2PlanName = `Isolation Control Test ${Date.now()}`;
    await createPlanWithExercise(page2, user2PlanName, 'Front Squat');

    // Delete user1's plan
    await deletePlan(page, user1PlanName);
    await expect(page.getByText(user1PlanName)).not.toBeVisible({ timeout: 5000 });

    // User2's own plan must be untouched by user1's deletion.
    await page2.goto('/workout-plans');
    await expect(page2.getByText(user2PlanName)).toBeVisible({ timeout: 5000 });

    // User2 must never have been able to see user1's plan at all (plans are user-scoped).
    await expect(page2.getByText(user1PlanName)).not.toBeVisible();

    await page2.close();
  });
});
