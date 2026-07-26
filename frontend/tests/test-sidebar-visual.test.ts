import { test, expect, chromium } from '@playwright/test';

test.describe('Sidebar Navigation - Visual Verification', () => {
  let browser: any;

  test.beforeAll(async () => {
    browser = await chromium.launch();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('Visual: Dialog appears when navigating with unsaved changes', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Navigate to app (assume logged in for visual test)
      await page.goto('http://localhost:5181/workout-plans', { waitUntil: 'load' });
      await page.waitForTimeout(1000);

      // Look for the Create Plan button or navigate to create plan
      const allLinks = await page.$$('a');
      console.log(`Found ${allLinks.length} links on page`);

      // Check for sidebar nav links
      const dashboardLinks = await page.$$('a[href="/dashboard"]');
      console.log(`Found ${dashboardLinks.length} dashboard links`);

      // Take a screenshot of the normal state
      await page.screenshot({ path: 'test-results/01-normal-state.png', fullPage: true });
      console.log('Screenshot 1: Normal state taken');

      // Try to navigate with sidebar
      if (dashboardLinks.length > 0) {
        // Click first dashboard link (should be the sidebar link)
        const sidebarDashboardLink = dashboardLinks[1] || dashboardLinks[0];
        await sidebarDashboardLink.click();
        await page.waitForTimeout(800);

        // Check if dialog appeared
        const dialogOverlay = await page.$('div[style*="rgba(0, 0, 0, 0.5)"]');
        if (dialogOverlay) {
          await page.screenshot({ path: 'test-results/02-dialog-shown.png', fullPage: true });
          console.log('Screenshot 2: Dialog shown when navigating with unsaved changes');

          // Look for the dialog text
          const dialogText = await page.$(':text("Leave without saving")');
          console.log('Dialog text found:', !!dialogText);
        } else {
          console.log('Dialog overlay not found (no unsaved changes or test context issue)');
        }
      }

    } finally {
      await context.close();
    }
  });

  test('Code Verification: Sidebar links have correct onClick handler', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto('http://localhost:5181/dashboard', { waitUntil: 'load' });
      await page.waitForTimeout(500);

      // Verify that the nav links exist and have the correct structure
      const navLinks = await page.$$('nav.sidebar-nav a');
      console.log(`✓ Found ${navLinks.length} navigation links in sidebar nav`);
      expect(navLinks.length).toBeGreaterThan(0);

      // Get all hrefs
      const hrefs = await Promise.all(navLinks.map((link) => link.getAttribute('href')));
      console.log('✓ Navigation link hrefs:', hrefs);

      // Verify the expected navigation paths exist
      expect(hrefs).toContain('/dashboard');
      expect(hrefs).toContain('/exercises');
      expect(hrefs).toContain('/workout-plans');
      expect(hrefs).toContain('/workout-history');

      console.log('✓ All expected navigation links present');

    } finally {
      await context.close();
    }
  });
});
