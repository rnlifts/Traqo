/**
 * Database setup and teardown for E2E tests.
 * Uses TEST_DATABASE_URL (separate from dev DB) and runs Alembic migrations.
 */

import { test as base, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as path from 'path';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost/traqo_test';

/**
 * Run Alembic migrations against the test database.
 * Ensures schema is up-to-date before running tests.
 */
function runMigrations() {
  try {
    const backendRoot = path.resolve(__dirname, '../../../backend');
    const migrationsDir = path.join(backendRoot, 'migrations');

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
    throw error;
  }
}

/**
 * Clean up test database (truncate tables).
 * Runs after all tests to leave a clean state.
 */
function cleanupDatabase() {
  try {
    const backendRoot = path.resolve(__dirname, '../../../backend');

    // Run a simple Python script to truncate tables in dependency order
    const cleanupScript = `
import os
from sqlalchemy import create_engine, text
from src.infrastructure.database import Base

db_url = os.getenv('DATABASE_URL', '${TEST_DATABASE_URL}')
engine = create_engine(db_url)

# Disable foreign key constraints temporarily, truncate all tables, re-enable
with engine.begin() as conn:
    conn.execute(text('SET CONSTRAINTS ALL DEFERRED'))
    for table in Base.metadata.sorted_tables:
        conn.execute(text(f'TRUNCATE TABLE {table.name} CASCADE'))

print('✓ Database cleaned')
`;

    execSync(`python -c "${cleanupScript.replace(/"/g, '\\"')}"`, {
      cwd: backendRoot,
      env: {
        ...process.env,
        DATABASE_URL: TEST_DATABASE_URL,
      },
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('✗ Database cleanup failed:', error);
    // Don't throw - cleanup failure shouldn't fail the test
  }
}

/**
 * Test fixture with database setup/teardown.
 * Run migrations before all tests, clean after all tests.
 */
export const test = base.extend({});

// Global setup: run migrations once before all tests
test.beforeAll(() => {
  console.log('Setting up test database...');
  runMigrations();
});

// Global teardown: clean database after all tests
test.afterAll(() => {
  console.log('Cleaning up test database...');
  cleanupDatabase();
});
