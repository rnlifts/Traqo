/**
 * Global setup for E2E tests.
 * Runs once before all tests to set up database and migrations.
 */

import { chromium, FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost/traqo_test';

// __dirname here is frontend/tests/e2e — the real backend/ lives three
// levels up (e2e -> tests -> frontend -> repo root), not two.
const backendRoot = path.resolve(__dirname, '../../../backend');

/**
 * Run Alembic migrations against the test database.
 */
function runMigrations(): void {
  try {
    const migrationsDir = path.join(backendRoot, 'migrations');

    console.log('Running Alembic migrations...');
    execSync('python -m alembic upgrade head', {
      cwd: migrationsDir,
      env: {
        ...process.env,
        DATABASE_URL: TEST_DATABASE_URL,
      },
      stdio: 'inherit',
    });

    console.log('✓ Alembic migrations completed');
  } catch (error) {
    console.error('✗ Alembic migrations failed:', error);
    throw new Error(`Migrations failed: ${error}`);
  }
}

/**
 * Seed the shared exercise library (idempotent upsert by name+muscle_group)
 * so E2E tests have real, known exercise names to search for in the
 * ExerciseLibrarySidebar. Without this the table is empty in a freshly
 * migrated test DB and every library-search test has nothing to find.
 */
function seedExerciseLibrary(): void {
  try {
    console.log('Seeding exercise library...');
    execSync('python scripts/seed_exercise_library.py', {
      cwd: backendRoot,
      env: {
        ...process.env,
        DATABASE_URL: TEST_DATABASE_URL,
      },
      stdio: 'inherit',
    });
    console.log('✓ Exercise library seeded');
  } catch (error) {
    console.error('✗ Exercise library seeding failed:', error);
    throw new Error(`Exercise library seeding failed: ${error}`);
  }
}

/**
 * Global setup hook: runs once before all tests.
 */
async function globalSetup(config: FullConfig): Promise<void> {
  console.log('\n=== Playwright E2E Global Setup ===');
  console.log(`Test Database: ${TEST_DATABASE_URL}`);

  // Run migrations
  runMigrations();

  // Seed the shared exercise library (depends on the migration above having
  // created the exercise_library_items table)
  seedExerciseLibrary();

  console.log('✓ Global setup complete\n');
}

export default globalSetup;
