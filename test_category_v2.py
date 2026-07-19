#!/usr/bin/env python3
"""
Test script to verify exercise category field functionality.
"""
import asyncio
import sys
from playwright.async_api import async_playwright


async def test_exercise_category():
    """Test the exercise category feature end-to-end."""
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Navigate to the app
        print("1. Navigating to app...")
        await page.goto("http://localhost:5175", wait_until="networkidle")
        print("   Page loaded")

        # Debug: print page content to see structure
        content = await page.content()

        # Try to find navigation to exercises
        print("2. Looking for navigation to exercises...")

        # Look for any link containing 'exercise' or 'Exercises'
        links = await page.query_selector_all("a, button")
        for link in links[:10]:
            text = await link.text_content()
            if text and ("exercise" in text.lower() or "home" in text.lower()):
                print(f"   Found link: '{text}'")

        # Try direct navigation to exercises
        print("3. Attempting direct navigation to /exercises...")
        try:
            await page.goto("http://localhost:5175/exercises", wait_until="networkidle")
            print("   Successfully navigated to /exercises")
        except:
            print("   Direct navigation failed, trying another route...")
            # Page might not have /exercises route, try other URLs
            pass

        # Wait a bit and check what's on the page
        await page.wait_for_timeout(1000)

        # Look for the exercise name input in various ways
        print("4. Looking for exercise form elements...")

        # Try multiple selectors
        selectors = [
            "input[placeholder='e.g., Bench Press']",
            "input[placeholder*='Bench']",
            "input[placeholder*='exercise']",
            "input[type='text']",
            "select",
        ]

        found_input = None
        found_select = None

        for selector in selectors:
            elem = await page.query_selector(selector)
            if elem:
                tag = await elem.evaluate("el => el.tagName")
                placeholder = await elem.evaluate("el => el.placeholder || el.id || el.name || 'no-id'")
                print(f"   Found {tag} with placeholder/id: '{placeholder}'")
                if tag == "INPUT" and not found_input:
                    found_input = elem
                elif tag == "SELECT" and not found_select:
                    found_select = elem

        if not found_input:
            print("\n   ERROR: Could not find exercise name input")
            print("\n   Page content (first 2000 chars):")
            content = await page.content()
            print(content[:2000])
            await browser.close()
            return

        print("\n5. Testing exercise creation with category...")

        # Clear any existing content
        await found_input.fill("")

        # Type exercise name
        exercise_name = "Deadlift"
        await found_input.type(exercise_name)
        print(f"   Entered exercise name: '{exercise_name}'")

        # Select category if select found
        if found_select:
            await found_select.select_option("Back")
            print("   Selected category: 'Back'")

            # Find and click submit button
            submit_btn = await page.query_selector("button:has-text('Add Exercise')")
            if not submit_btn:
                submit_btn = await page.query_selector("button[type='submit']")

            if submit_btn:
                await submit_btn.click()
                print("   Clicked submit button")
                await page.wait_for_timeout(1000)

                # Check for success message or exercise in list
                success_toast = await page.query_selector("text=Exercise created successfully")
                if success_toast:
                    print("   SUCCESS: Got 'Exercise created successfully' message")

                # Check if exercise appears in list
                await page.wait_for_timeout(500)
                content = await page.content()
                if exercise_name in content:
                    print(f"   SUCCESS: Exercise '{exercise_name}' found in page content")

                    # Try to get the exact text from the card
                    exercise_spans = await page.query_selector_all("span")
                    for span in exercise_spans:
                        text = await span.text_content()
                        if exercise_name in text:
                            print(f"   Exercise card shows: '{text}'")
                            if "Back" in text:
                                print("   SUCCESS: Category 'Back' is displayed with exercise!")
                            break
                else:
                    print(f"   ERROR: Exercise '{exercise_name}' not found in content")
            else:
                print("   ERROR: Could not find submit button")
        else:
            print("   ERROR: Could not find category select element")

        print("\n6. Checking category dropdown options...")
        if found_select:
            options = await found_select.query_selector_all("option")
            print(f"   Found {len(options)} options in dropdown")

            expected = ["Chest", "Back", "Legs", "Shoulders", "Biceps", "Triceps", "Core", "Glutes", "Cardio", "Full Body"]
            found_categories = []

            for opt in options:
                value = await opt.get_attribute("value")
                text = await opt.text_content()
                if value and value != "":
                    found_categories.append(text.strip())

            if all(cat in found_categories for cat in expected):
                print(f"   SUCCESS: All {len(expected)} expected categories are present")
            else:
                missing = [cat for cat in expected if cat not in found_categories]
                print(f"   WARNING: Missing categories: {missing}")

        print("\n7. Checking for exercises without category (backward compatibility)...")
        # Reload to see all exercises
        await page.reload(wait_until="networkidle")
        await page.wait_for_timeout(1000)

        # Look for all exercise cards
        spans = await page.query_selector_all("span")
        exercise_count = 0
        for span in spans:
            text = await span.text_content()
            # Skip empty or very short text
            if text and len(text) > 2 and not text.startswith("×"):
                # Check if this looks like an exercise (contains name-like text)
                if "Deadlift" in text or "Bench" in text or "Press" in text or "Pull" in text:
                    exercise_count += 1
                    print(f"   Exercise: '{text}'")
                    if "null" in text:
                        print("      ERROR: Found 'null' in exercise display!")
                    elif text.endswith("—"):
                        print("      ERROR: Text ends with incomplete dash!")

        if exercise_count > 0:
            print(f"   OK: Found {exercise_count} exercises, checking for display issues...")
        else:
            print("   No exercises found to check backward compatibility")

        await browser.close()
        print("\n=== Test completed ===")


if __name__ == "__main__":
    asyncio.run(test_exercise_category())
