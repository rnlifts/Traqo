/**
 * E2E Tests: Plan Builder + Exercise Library
 *
 * Journey 3: Create a plan, add exercises from the shared library
 * (searched by fuzzy word match), configure per-exercise and per-set
 * targets, save, and verify persistence.
 *
 * Ground truth used to write these selectors (verified against source,
 * not guessed):
 * - CreatePlanPage (src/pages/CreatePlanPage.tsx) never navigates between
 *   step 1 and step 2 — it's the same component swapping local state, so
 *   there is no URL change to wait for between "Continue" and the builder
 *   appearing. Wait for the builder's <h2>{planName}</h2> instead.
 * - PlanBuilder.handleSavePlan navigates to exactly '/workout-plans' on
 *   success (src/features/workoutPlans/PlanBuilder.tsx:293) — there is no
 *   '/build' or '/create' segment in this app's routing at all (confirmed
 *   via App.tsx's route list), so the old regex
 *   /\/workout-plans.*build|create/ could never correctly describe any
 *   real navigation here (and `|` has the lowest regex precedence, so it
 *   didn't even mean what it looked like it meant).
 * - The exercise library table is seeded (idempotently) from
 *   backend/scripts/seed_exercise_library.py + the `exercise library/`
 *   JSON files — global-setup.ts now runs this after migrations so the
 *   sidebar has real, known exercise names to search for.
 */

import { test, expect, Page } from '@playwright/test';
import { generateTestUser, registerAndLogin } from './fixtures/user';

async function createPlanUpToBuilder(page: Page, planName: string) {
  await page.goto('/workout-plans/new');
  await expect(page.locator('h1')).toHaveText('Set it up');

  await page.fill('#planName', planName);
  await page.getByRole('button', { name: '1 Day' }).click();
  await page.getByRole('button', { name: 'Continue →' }).click();

  // Step 2 (the builder) renders in place — no URL change. Its plan-name
  // heading appearing is the real signal step 2 is up.
  await expect(page.locator('h2', { hasText: planName })).toBeVisible({ timeout: 5000 });
}

async function savePlan(page: Page) {
  await page.getByRole('button', { name: 'Save Plan' }).click();
  // Create mode always confirms via a second dialog ("Save this plan?")
  // before actually persisting (PlanBuilder.tsx:1305-1317).
  await expect(page.locator('h2', { hasText: 'Save this plan?' })).toBeVisible({ timeout: 3000 });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL('/workout-plans', { timeout: 10000 });
}

async function addExerciseFromLibrary(page: Page, exerciseName: string) {
  await page.getByPlaceholder('Search exercises...').fill(exerciseName);
  // Search is debounced 350ms (ExerciseLibrarySidebar.tsx) plus a real network round trip.
  const resultCard = page.locator('div').filter({ hasText: exerciseName }).filter({ has: page.getByRole('button', { name: '+ Add' }) }).last();
  await expect(resultCard).toBeVisible({ timeout: 5000 });
  await resultCard.getByRole('button', { name: '+ Add' }).click();
}

test.describe('Plan Builder + Exercise Library', () => {
  test('create plan, add exercise from library, configure targets, save, and verify persistence', async ({ page }) => {
    const user = generateTestUser();
    await registerAndLogin(page, user);

    const planName = `E2E Plan ${Date.now()}`;
    await createPlanUpToBuilder(page, planName);

    await addExerciseFromLibrary(page, 'Wide Grip Pulldown');

    const exerciseRow = page.locator('.exercise-row').filter({ hasText: 'Wide Grip Pulldown' });
    await expect(exerciseRow).toBeVisible({ timeout: 5000 });

    await exerciseRow.getByPlaceholder('Sets').fill('4');
    await exerciseRow.getByPlaceholder('e.g. 10 or 10-12').fill('8-10');
    await exerciseRow.getByPlaceholder('Weight').fill('135');

    await savePlan(page);

    await expect(page.getByText(planName)).toBeVisible({ timeout: 5000 });

    // Verify persistence: reopen the plan and confirm the configured targets round-tripped.
    await page.getByText(planName).click();
    await page.waitForURL(/\/workout-plans\/\d+\/edit/, { timeout: 5000 });

    const savedRow = page.locator('.exercise-row').filter({ hasText: 'Wide Grip Pulldown' });
    await expect(savedRow).toBeVisible({ timeout: 5000 });
    await expect(savedRow.getByPlaceholder('Sets')).toHaveValue('4');
    await expect(savedRow.getByPlaceholder('e.g. 10 or 10-12')).toHaveValue('8-10');
    await expect(savedRow.getByPlaceholder('Weight')).toHaveValue('135');
  });

  test('fuzzy search finds exercises with partial, word-based match', async ({ page }) => {
    const user = generateTestUser();
    await registerAndLogin(page, user);

    await createPlanUpToBuilder(page, `E2E Search Plan ${Date.now()}`);

    // SearchExercises (search_exercises.py) does token-overlap matching:
    // "pulldown" is one query word that must appear inside (or equal) a
    // word in the exercise's name — not a substring-of-the-whole-name.
    await page.getByPlaceholder('Search exercises...').fill('pulldown');
    await expect(page.getByText('Wide Grip Pulldown')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Underhand Pulldown')).toBeVisible({ timeout: 5000 });

    // An unrelated exercise (zero word overlap) must be filtered out.
    await expect(page.getByText('Hanging Knee Raise')).not.toBeVisible();
  });

  test('can use "Vary by Set" to configure per-set overrides', async ({ page }) => {
    const user = generateTestUser();
    await registerAndLogin(page, user);

    const planName = `E2E Vary Plan ${Date.now()}`;
    await createPlanUpToBuilder(page, planName);

    await addExerciseFromLibrary(page, 'Barbell Bent Over Row');
    const exerciseRow = page.locator('.exercise-row').filter({ hasText: 'Barbell Bent Over Row' });
    await expect(exerciseRow).toBeVisible({ timeout: 5000 });

    await exerciseRow.getByPlaceholder('Sets').fill('3');
    await exerciseRow.getByPlaceholder('e.g. 10 or 10-12').fill('10');
    await exerciseRow.getByPlaceholder('Weight').fill('95');

    await exerciseRow.getByRole('button', { name: 'Vary by set' }).click();

    // The per-set panel renders as the row's own next sibling — scope to
    // the shared parent so this doesn't accidentally match another
    // exercise's panel if more than one is expanded.
    const rowContainer = exerciseRow.locator('..');
    const setPanel = rowContainer.locator('.set-detail-panel');
    await expect(setPanel).toBeVisible({ timeout: 5000 });

    const set2Line = setPanel.locator('.set-line').filter({ hasText: 'Set 2' });
    await set2Line.getByPlaceholder('Reps (e.g. 10-12)').fill('12');
    await set2Line.getByPlaceholder('Weight').fill('85');

    await setPanel.getByRole('button', { name: /Save set targets|Saved/ }).click();

    // Draft-mode save has a brief "Saving..." -> "✓ Saved" animation before
    // the panel auto-collapses (PlanBuilder.tsx: 300ms + 700ms delays).
    await expect(setPanel).not.toBeVisible({ timeout: 3000 });

    await savePlan(page);
    await expect(page.getByText(planName)).toBeVisible({ timeout: 5000 });
  });
});
