import { test, expect, chromium } from '@playwright/test';

test.describe('UI Color Verification', () => {
  let browser: any;

  test.beforeAll(async () => {
    browser = await chromium.launch();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('Login page has correct text colors', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:5181/login', { waitUntil: 'load' });

    // Check that text is dark gray (#52525b), not purple
    const textColor = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      if (h1) {
        return getComputedStyle(h1).color;
      }
      return 'not found';
    });

    console.log('Login page H1 text color:', textColor);

    // Dark gray or the heading color (dark)
    expect(textColor).toMatch(/rgb\(82, 82, 91\)|rgb\(24, 24, 27\)/);

    await context.close();
  });

  test('Button colors are preserved correctly', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:5181/', { waitUntil: 'load' });

    // Check .btn-primary is still blue
    const primaryButtonStyle = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        (b: any) => b.className?.includes('btn-primary')
      );
      if (btn) {
        const style = getComputedStyle(btn);
        return {
          backgroundColor: style.backgroundColor,
          className: btn.className
        };
      }
      return null;
    });

    console.log('Primary button style:', primaryButtonStyle);

    // If a primary button exists, verify it's still blue
    if (primaryButtonStyle) {
      expect(primaryButtonStyle.backgroundColor).toBe('rgb(0, 123, 255)');
    }

    await context.close();
  });

  test('Nav links use accent color when active', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:5181/dashboard', { waitUntil: 'load' });

    // Check nav active link uses indigo accent
    const navLinkStyle = await page.evaluate(() => {
      const navLink = Array.from(document.querySelectorAll('a[aria-current="page"]')).find(
        (link: any) => link.textContent?.includes('Dashboard')
      );

      if (navLink) {
        const style = getComputedStyle(navLink);
        return {
          backgroundColor: style.backgroundColor,
          color: style.color
        };
      }
      return null;
    });

    console.log('Active nav link style:', navLinkStyle);

    // Should have indigo background
    if (navLinkStyle && navLinkStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      // Check for indigo (79, 70, 229) or similar
      expect(navLinkStyle.backgroundColor).toMatch(/rgb\(79, 70, 229\)|rgba\(79, 70, 229/);
    }

    await context.close();
  });

  test('Card backgrounds are light neutral', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:5181/dashboard', { waitUntil: 'load' });

    const cardColor = await page.evaluate(() => {
      const card = document.querySelector('.card');
      if (card) {
        return getComputedStyle(card).backgroundColor;
      }
      return 'not found';
    });

    console.log('Card background color:', cardColor);

    // Should be light neutral (#fafafa or similar)
    if (cardColor !== 'not found' && cardColor !== 'rgba(0, 0, 0, 0)') {
      expect(cardColor).toMatch(/rgb\(250, 250, 250\)|#fafafa/);
    }

    await context.close();
  });

  test('No dark mode is applied', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Try dark mode preference
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('http://localhost:5181/login', { waitUntil: 'load' });

    // Check root background is still white
    const rootBg = await page.evaluate(() => {
      const root = document.documentElement;
      return getComputedStyle(root).backgroundColor;
    });

    console.log('Root background (dark mode preference):', rootBg);
    expect(rootBg).toBe('rgb(255, 255, 255)');

    // Check body text is still light gray (not light)
    const bodyText = await page.evaluate(() => {
      const root = document.documentElement;
      return getComputedStyle(root).color;
    });

    console.log('Root text color (dark mode preference):', bodyText);
    expect(bodyText).toBe('rgb(82, 82, 91)'); // Should be light gray, not white

    await context.close();
  });
});
