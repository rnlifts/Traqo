import { test, expect, chromium } from '@playwright/test';

test.describe('Color Redesign Verification', () => {
  let browser: any;

  test.beforeAll(async () => {
    browser = await chromium.launch();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('CSS tokens are correctly defined', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:5181/', { waitUntil: 'load' });

    // Check CSS custom properties
    const cssVars = await page.evaluate(() => {
      const root = document.documentElement;
      const styles = getComputedStyle(root);
      return {
        bg: styles.getPropertyValue('--bg').trim(),
        text: styles.getPropertyValue('--text').trim(),
        textH: styles.getPropertyValue('--text-h').trim(),
        accent: styles.getPropertyValue('--accent').trim(),
        border: styles.getPropertyValue('--border').trim(),
        danger: styles.getPropertyValue('--danger').trim(),
      };
    });

    console.log('CSS Variables:', cssVars);

    // Verify new colors
    expect(cssVars.bg).toBe('#ffffff');
    expect(cssVars.text).toBe('#52525b');
    expect(cssVars.textH).toBe('#18181b');
    expect(cssVars.accent).toBe('#4f46e5');
    expect(cssVars.border).toBe('#e5e4e7');
    expect(cssVars.danger).toBe('#dc3545');

    await context.close();
  });

  test('No dark mode media query is active', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set to dark color scheme
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('http://localhost:5181/', { waitUntil: 'load' });

    // CSS should still show light values
    const bgColor = await page.evaluate(() => {
      const root = document.documentElement;
      const styles = getComputedStyle(root);
      return styles.backgroundColor;
    });

    console.log('Background Color (dark mode pref):', bgColor);
    // Should still be white, not a dark color
    expect(bgColor).toBe('rgb(255, 255, 255)');

    await context.close();
  });

  test('Old purple accent color is not present', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:5181/', { waitUntil: 'load' });

    const hasOldPurple = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      for (const elem of allElements) {
        const computedStyle = getComputedStyle(elem);
        const bgColor = computedStyle.backgroundColor;
        const color = computedStyle.color;
        // Old purple was #aa3bff or rgb(170, 59, 255)
        if (bgColor.includes('170') || color.includes('170')) {
          return { element: elem.tagName, style: { bgColor, color } };
        }
      }
      return null;
    });

    console.log('Old purple found:', hasOldPurple);
    expect(hasOldPurple).toBeNull();

    await context.close();
  });
});
