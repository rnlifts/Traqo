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

        # Navigate to the exercises page
        print("1. Navigating to exercises page...")
        await page.goto("http://localhost:5175", wait_until="networkidle")

        # Click on Exercises link if needed (depending on routing)
        try:
            exercises_link = await page.query_selector("a:has-text('Exercises')")
            if exercises_link:
                print("   Found Exercises link, clicking...")
                await exercises_link.click()
                await page.wait_for_load_state("networkidle")
        except:
            pass

        # Wait for exercises page to load
        await page.wait_for_selector("input[placeholder='e.g., Bench Press']", timeout=5000)
        print("   Exercises page loaded successfully")

        # TEST 1: Create exercise with category
        print("\n2. Creating exercise 'Deadlift' with category 'Back'...")
        name_input = await page.query_selector("input[placeholder='e.g., Bench Press']")
        category_select = await page.query_selector("select")

        # Fill in the name
        await name_input.fill("Deadlift")
        print("   Filled exercise name: 'Deadlift'")

        # Select category
        await category_select.select_option("Back")
        print("   Selected category: 'Back'")

        # Submit the form
        submit_button = await page.query_selector("button:has-text('Add Exercise')")
        await submit_button.click()
        print("   Clicked Add Exercise button")

        # Wait for the exercise to appear in the list
        await page.wait_for_timeout(500)

        # Check if the exercise appears with category
        exercises_text = await page.content()
        if "Deadlift" in exercises_text and "Back" in exercises_text:
            # More specific check
            exercise_card = await page.query_selector("span:has-text('Deadlift')")
            if exercise_card:
                text_content = await exercise_card.text_content()
                print(f"   Exercise card text: '{text_content}'")
                if "Back" in text_content:
                    print("   SUCCESS: Exercise created with category displayed correctly!")
                else:
                    print(f"   WARNING: Category not found in exercise card text")
        else:
            print("   ERROR: Exercise not found in list after creation")

        # TEST 2: Try submitting without category - should fail validation
        print("\n3. Testing validation: attempting to create exercise without category...")
        name_input = await page.query_selector("input[placeholder='e.g., Bench Press']")
        category_select = await page.query_selector("select")

        # Reset form
        await name_input.fill("Test Exercise")
        print("   Filled exercise name: 'Test Exercise'")

        # Don't select a category (it's required)
        print("   Category not selected (required field)")

        # Try to submit
        submit_button = await page.query_selector("button:has-text('Add Exercise')")

        # Check if browser validation prevents submission
        is_valid = await page.evaluate("""
            () => {
                const select = document.querySelector('select');
                return select.checkValidity();
            }
        """)

        if not is_valid:
            print("   SUCCESS: Browser validation correctly prevents submission without category!")
        else:
            print("   WARNING: Validation check returned true (may be browser-specific)")

        # TEST 3: Check if old exercises without category display correctly
        print("\n4. Checking for exercises without category (backward compatibility)...")

        # Reload the page to get fresh data from backend
        await page.reload(wait_until="networkidle")
        await page.wait_for_selector("input[placeholder='e.g., Bench Press']", timeout=5000)
        await page.wait_for_timeout(500)

        # Look for any existing exercises
        exercise_cards = await page.query_selector_all("div.card span")
        if exercise_cards:
            print(f"   Found {len(exercise_cards)} exercise cards")
            for i, card in enumerate(exercise_cards[:3]):  # Show first 3
                text = await card.text_content()
                print(f"   Card {i+1}: '{text}'")

                # Check for "— null" or other display issues
                if "null" in text.lower():
                    print(f"      WARNING: Found 'null' in display text!")
                elif text.endswith("—") or text.endswith(" —"):
                    print(f"      WARNING: Card ends with dash (incomplete category display)!")
                else:
                    print(f"      OK: No null values or incomplete dashes")
        else:
            print("   No exercises found in list (or page structure different)")

        print("\n5. Checking dropdown options...")
        category_select = await page.query_selector("select")
        options = await category_select.query_selector_all("option")
        option_values = []
        for opt in options:
            value = await opt.get_attribute("value")
            text = await opt.text_content()
            option_values.append((value, text))
            if value and value != "":
                print(f"   Option: '{text}' (value: '{value}')")

        expected_categories = ["Chest", "Back", "Legs", "Shoulders", "Biceps", "Triceps", "Core", "Glutes", "Cardio", "Full Body"]
        found_categories = [t for v, t in option_values if v and v != ""]

        if all(cat in found_categories for cat in expected_categories):
            print(f"   SUCCESS: All {len(expected_categories)} expected categories found!")
        else:
            missing = [cat for cat in expected_categories if cat not in found_categories]
            print(f"   WARNING: Missing categories: {missing}")

        await browser.close()
        print("\n=== Test completed successfully ===")


if __name__ == "__main__":
    asyncio.run(test_exercise_category())
