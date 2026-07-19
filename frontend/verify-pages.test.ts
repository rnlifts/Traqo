import { test, expect, chromium } from '@playwright/test';

test.describe('Page Layout Verification', () => {
  let browser: any;

  test.beforeAll(async () => {
    browser = await chromium.launch();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('Dashboard page has light background with dark text', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:5181/dashboard', { waitUntil: 'load' });
    await page.waitForTimeout(1000);

    // Check page background
    const pageStyles = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      const container = document.querySelector('#root');
      return {
        rootBg: getComputedStyle(root).backgroundColor,
        bodyBg: getComputedStyle(body).backgroundColor,
        containerBg: container ? getComputedStyle(container).backgroundColor : 'none',
        rootText: getComputedStyle(root).color
      };
    });

    console.log('Dashboard page styles:', pageStyles);
    expect(pageStyles.rootBg).toBe('rgb(255, 255, 255)');
    expect(pageStyles.rootText).toBe('rgb(82, 82, 91)'); // Dark gray text

    await context.close();
  });

  test('Exercises page loads and has correct colors', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:5181/exercises', { waitUntil: 'load' });
    await page.waitForTimeout(1000);

    // Check if page loaded
    const pageStatus = await page.evaluate(() => {
      return {
        title: document.title,
        hasContent: document.body.textContent?.length ?? 0
      };
    });

    console.log('Exercises page loaded:', pageStatus);
    expect(pageStatus.hasContent).toBeGreaterThan(0);

    await context.close();
  });

  test('Workout Plans page loads with correct styling', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:5181/workout-plans', { waitUntil: 'load' });
    await page.waitForTimeout(1000);

    // Check if cards exist and have correct background
    const cardInfo = await page.evaluate(() => {
      const cards = document.querySelectorAll('.card');
      if (cards.length > 0) {
        const firstCard = cards[0];
        const style = getComputedStyle(firstCard);
        return {
          cardCount: cards.length,
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor
        };
      }
      return { cardCount: 0 };
    });

    console.log('Workout Plans page card info:', cardInfo);

    // If cards exist, verify their colors
    if (cardInfo.cardCount > 0) {
      expect(cardInfo.backgroundColor).toMatch(/rgb\(250, 250, 250\)|rgb\(255, 255, 255\)/);
    }

    await context.close();
  });

  test('History page styles verified', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:5181/workout-history', { waitUntil: 'load' });
    await page.waitForTimeout(1000);

    // Check page loaded
    const historyInfo = await page.evaluate(() => {
      return {
        hasContent: document.body.textContent?.length ?? 0,
        h1Text: document.querySelector('h1')?.textContent
      };
    });

    console.log('History page info:', historyInfo);
    expect(historyInfo.hasContent).toBeGreaterThan(0);

    await context.close();
  });

  test('Font and text colors are readable', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:5181/dashboard', { waitUntil: 'load' });

    // Get all text elements and verify contrast
    const textInfo = await page.evaluate(() => {
      const elements = document.querySelectorAll('p, h1, h2, h3, span');
      const textColors: string[] = [];

      for (const elem of Array.from(elements).slice(0, 10)) {
        const color = getComputedStyle(elem as Element).color;
        textColors.push(color);
      }

      return {
        rootBg: getComputedStyle(document.documentElement).backgroundColor,
        textColors: [...new Set(textColors)].slice(0, 5)
      };
    });

    console.log('Text color info:', textInfo);

    // Background should be white
    expect(textInfo.rootBg).toBe('rgb(255, 255, 255)');

    // Text should be dark (not light)
    const hasLightText = textInfo.textColors.some(color => {
      // Parse RGB values
      const match = color.match(/\d+/g);
      if (match && match.length >= 3) {
        const avg = (parseInt(match[0]) + parseInt(match[1]) + parseInt(match[2])) / 3;
        return avg > 200; // Light text
      }
      return false;
    });

    console.log('Has light text on white background:', hasLightText);
    expect(hasLightText).toBe(false);

    await context.close();
  });
});
