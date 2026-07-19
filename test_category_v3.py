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

        # Wait for page to fully load
        await page.wait_for_timeout(1000)

        print("2. Checking if we need to login...")

        # Look for login form elements
        username_input = await page.query_selector("input[placeholder*='username']") or await page.query_selector("input[placeholder*='Username']")
        password_input = await page.query_selector("input[type='password']")

        if username_input:
            print("   Login form detected, attempting login...")

            # Type test credentials
            test_username = "testuser123"
            test_password = "password123"

            await username_input.fill(test_username)
            print(f"   Entered username: '{test_username}'")

            if password_input:
                await password_input.fill(test_password)
                print(f"   Entered password")

                # Find and click login button
                login_btn = await page.query_selector("button:has-text('Login')")
                if not login_btn:
                    login_btn = await page.query_selector("button:has-text('Sign In')")
                if not login_btn:
                    login_btn = await page.query_selector("button[type='submit']")

                if login_btn:
                    await login_btn.click()
                    print("   Clicked login button")

                    # Wait for navigation or error
                    try:
                        await page.wait_for_load_state("networkidle", timeout=3000)
                        await page.wait_for_timeout(500)
                    except:
                        pass

                    # Check if we got an error
                    error_msg = await page.query_selector(".error-message, [class*='error'], text=Invalid")
                    if error_msg:
                        error_text = await error_msg.text_content()
                        print(f"   Login error: {error_text}")
                        print("   This test requires a valid user in the backend")
                        print("   Creating new account via registration...")

                        # Try to find register button
                        register_link = await page.query_selector("text=Register") or await page.query_selector("text=Sign up")
                        if register_link:
                            await register_link.click()
                            await page.wait_for_timeout(1000)

                            # Fill registration form
                            reg_username = f"testuser_{asyncio.current_task().get_name() if hasattr(asyncio, 'current_task') else 'new'}"
                            reg_password = "TestPass123!"

                            name_input = await page.query_selector("input[placeholder*='Name']")
                            if name_input:
                                await name_input.fill("Test User")

                            username_input = await page.query_selector("input[placeholder*='Username']")
                            if username_input:
                                await username_input.fill(reg_username)

                            password_input = await page.query_selector("input[type='password']")
                            if password_input:
                                await password_input.fill(reg_password)

                            register_btn = await page.query_selector("button:has-text('Register')")
                            if register_btn:
                                await register_btn.click()
                                await page.wait_for_timeout(1500)
                        else:
                            print("   Could not find register link")
                    else:
                        print("   Login successful or form still displayed")

        # Now try to navigate to exercises
        print("\n3. Navigating to exercises page...")
        await page.goto("http://localhost:5175/exercises", wait_until="networkidle")
        await page.wait_for_timeout(1000)

        print("   Looking for exercise form...")

        # Look for the exercise name input
        name_input = await page.query_selector("input[placeholder='e.g., Bench Press']")
        if not name_input:
            # Try other selectors
            all_inputs = await page.query_selector_all("input[type='text']")
            for inp in all_inputs:
                placeholder = await inp.get_attribute("placeholder")
                if placeholder and "Bench" in placeholder:
                    name_input = inp
                    break

        category_select = await page.query_selector("select")

        if name_input:
            print("   Found exercise name input")
        else:
            print("   ERROR: Could not find exercise name input")
            print("\n   Available inputs on page:")
            inputs = await page.query_selector_all("input")
            for inp in inputs[:5]:
                placeholder = await inp.get_attribute("placeholder")
                input_type = await inp.get_attribute("type")
                print(f"      Type: {input_type}, Placeholder: {placeholder}")

        if category_select:
            print("   Found category select dropdown")
        else:
            print("   ERROR: Could not find category select dropdown")

        if name_input and category_select:
            print("\n4. Testing exercise creation with category...")

            # Create exercise
            exercise_name = "Deadlift Test"
            await name_input.fill(exercise_name)
            print(f"   Entered exercise name: '{exercise_name}'")

            await category_select.select_option("Back")
            print("   Selected category: 'Back'")

            # Find and click submit
            submit_btn = await page.query_selector("button:has-text('Add Exercise')")
            if submit_btn:
                await submit_btn.click()
                print("   Clicked 'Add Exercise' button")
                await page.wait_for_timeout(1500)

                # Check for success message
                success_msg = await page.query_selector("text=Exercise created successfully")
                if success_msg:
                    print("   SUCCESS: Got success message")

                # Look for the exercise in the list
                page_content = await page.content()
                if exercise_name in page_content:
                    print(f"   SUCCESS: Exercise '{exercise_name}' appears in list")

                    # Find the exact text displayed
                    spans = await page.query_selector_all("span")
                    for span in spans:
                        text = await span.text_content()
                        if exercise_name in text:
                            print(f"   Exercise displayed as: '{text}'")
                            if "Back" in text:
                                print("   SUCCESS: Category 'Back' is shown with exercise!")
                            break
                else:
                    print(f"   WARNING: Exercise not found in list")
            else:
                print("   ERROR: Could not find submit button")

            print("\n5. Testing form validation (no category selected)...")

            # Test validation by trying to submit without category
            await name_input.fill("Validation Test")
            print("   Entered exercise name without selecting category")

            # Check if select has required attribute
            is_required = await category_select.evaluate("el => el.required")
            print(f"   Category select required attribute: {is_required}")

            # Try to submit and see if validation prevents it
            try:
                submit_btn = await page.query_selector("button:has-text('Add Exercise')")
                if submit_btn:
                    # Check form validity
                    form = await page.query_selector("form")
                    if form:
                        is_valid = await form.evaluate("el => el.checkValidity()")
                        print(f"   Form validity check: {is_valid}")
                        if not is_valid:
                            print("   SUCCESS: Form validation prevents submission without category")
                    else:
                        print("   Form not found for validation check")
            except:
                pass

            print("\n6. Verifying category dropdown options...")
            options = await category_select.query_selector_all("option")
            expected = ["Chest", "Back", "Legs", "Shoulders", "Biceps", "Triceps", "Core", "Glutes", "Cardio", "Full Body"]
            found = []

            for opt in options:
                value = await opt.get_attribute("value")
                text = await opt.text_content()
                if value and value != "":
                    found.append(text.strip())
                    print(f"   Option: '{text.strip()}'")

            missing = [cat for cat in expected if cat not in found]
            if not missing:
                print(f"   SUCCESS: All {len(expected)} expected categories found")
            else:
                print(f"   ERROR: Missing categories: {missing}")

            print("\n7. Checking display of exercises without category...")
            # Reload page
            await page.reload(wait_until="networkidle")
            await page.wait_for_timeout(1000)

            # Look for exercises in the list
            cards = await page.query_selector_all(".card, div[class*='card']")
            print(f"   Found {len(cards)} exercise cards")

            for i, card in enumerate(cards[:5]):
                text = await card.text_content()
                if text and len(text) > 2:
                    print(f"   Card {i+1}: '{text[:100]}'")
                    if "null" in text:
                        print(f"      ERROR: Found 'null' in display")
                    if text.strip().endswith("—"):
                        print(f"      ERROR: Text ends with dash")

        await browser.close()
        print("\n=== Test completed ===")


if __name__ == "__main__":
    asyncio.run(test_exercise_category())
