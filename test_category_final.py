#!/usr/bin/env python3
"""
Test script to verify exercise category field functionality.
"""
import asyncio
import json
import urllib.request
import urllib.error
from playwright.async_api import async_playwright
from datetime import datetime

# Generate unique username with timestamp
timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
display_name = f"Test User {timestamp}"
test_password = "TestPassword123!"
generated_username = None

def register_user():
    """Register a test user via API."""
    global generated_username
    payload = {
        "display_name": display_name,
        "password": test_password
    }
    try:
        req = urllib.request.Request(
            "http://localhost:5000/api/auth/register",
            data=json.dumps(payload).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            generated_username = data.get("username")
            print(f"   User registered: {generated_username} ({display_name})")
            return True
    except urllib.error.HTTPError as e:
        if e.code == 201:
            data = json.loads(e.read().decode())
            generated_username = data.get("username")
            print(f"   User registered: {generated_username} ({display_name})")
            return True
        print(f"   Register failed with status {e.code}: {e.read().decode()}")
        return False
    except Exception as e:
        print(f"   Error registering: {e}")
        return False

def login_user():
    """Login and get JWT token."""
    if not generated_username:
        print("   Error: No username available")
        return None

    payload = {
        "username": generated_username,
        "password": test_password
    }
    try:
        req = urllib.request.Request(
            "http://localhost:5000/api/auth/login",
            data=json.dumps(payload).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            token = data.get("token")
            user = data.get("user")
            print(f"   Login successful, got token")
            return token, user
    except Exception as e:
        print(f"   Error logging in: {e}")
        return None, None

async def test_exercise_category():
    """Test the exercise category feature end-to-end."""

    # First register and login via API
    print("0. Setting up test user...")
    register_ok = register_user()
    if not register_ok:
        print("   Could not register user, test cannot proceed")
        return

    token, user_data = login_user()
    if not token or not user_data:
        print("   Could not login, test cannot proceed")
        return

    print("\n1. Starting browser test...")
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()

        # Set authentication token in local storage
        page = await context.new_page()

        # Navigate to app and set token
        print("   Navigating to app and setting authentication...")
        await page.goto("http://localhost:5175", wait_until="load")

        # Set token and user in localStorage using the exact keys the frontend expects
        user_json_str = json.dumps(user_data).replace('"', '\\"')
        js_code = f"""
            localStorage.setItem('auth_token', '{token}');
            localStorage.setItem('current_user', "{user_json_str}");
        """
        await page.evaluate(js_code)

        # Reload to apply token
        await page.reload(wait_until="networkidle")
        await page.wait_for_timeout(1500)

        print("   Authentication applied, checking if exercises page is accessible...")

        # Navigate to exercises
        await page.goto("http://localhost:5175/exercises", wait_until="networkidle")
        await page.wait_for_timeout(1500)

        # Check if we're on the exercises page
        page_content = await page.content()
        print("\n   Page title/heading check...")
        if "Exercise Name" in page_content or "Bench Press" in page_content or "Add Exercise" in page_content:
            print("   SUCCESS: On exercises page")
        else:
            print("   WARNING: Expected elements not found")
            print(f"   Page contains '{page_content[300:600]}'")

        print("\n2. Looking for exercise form elements...")

        # Find form elements
        name_input = await page.query_selector("input[placeholder='e.g., Bench Press']")
        if not name_input:
            inputs = await page.query_selector_all("input[type='text']")
            for inp in inputs:
                placeholder = await inp.get_attribute("placeholder")
                if placeholder and ("exercise" in placeholder.lower() or "bench" in placeholder.lower() or "e.g." in placeholder.lower()):
                    name_input = inp
                    break

        category_select = await page.query_selector("select")

        if not name_input:
            print("   ERROR: Could not find exercise name input")
            print("   Available inputs:")
            inputs = await page.query_selector_all("input")
            for inp in inputs[:10]:
                placeholder = await inp.get_attribute("placeholder")
                input_type = await inp.get_attribute("type")
                input_id = await inp.get_attribute("id")
                print(f"      type='{input_type}' placeholder='{placeholder}' id='{input_id}'")

            # Also check if maybe we got redirected back to login
            login_form = await page.query_selector("input[placeholder*='password']")
            if login_form:
                print("   ERROR: Still on login page after setting token!")
                print("   The authentication token may not be properly recognized.")

            await browser.close()
            return

        if not category_select:
            print("   ERROR: Could not find category select dropdown")
            await browser.close()
            return

        print("   SUCCESS: Found exercise name input and category select")

        print("\n3. Creating exercise with category 'Back'...")

        exercise_name = "Deadlift Test"
        await name_input.fill(exercise_name)
        print(f"   Entered exercise name: '{exercise_name}'")

        await category_select.select_option("Back")
        print("   Selected category: 'Back' from dropdown")

        # Find and click submit button
        submit_btn = await page.query_selector("button:has-text('Add Exercise')")
        if not submit_btn:
            submit_btn = await page.query_selector("button[type='submit']")

        if submit_btn:
            await submit_btn.click()
            print("   Clicked 'Add Exercise' button")
            await page.wait_for_timeout(1500)

            # Check for success
            success_msg = await page.query_selector("text=Exercise created successfully")
            if success_msg:
                print("   SUCCESS: Got 'Exercise created successfully' message")

            # Wait for form to clear
            await page.wait_for_timeout(500)

            # Look for the exercise in the list
            page_content = await page.content()
            if exercise_name in page_content and "Back" in page_content:
                # Find the exact text
                spans = await page.query_selector_all("span")
                for span in spans:
                    text = await span.text_content()
                    if exercise_name in text:
                        print(f"   Exercise card text: '{text}'")
                        if "Back" in text:
                            print("   SUCCESS: Category 'Back' is displayed with the exercise!")
                            if "—" in text:
                                print("   SUCCESS: Using em-dash separator as specified")
                        break
            else:
                print(f"   WARNING: Exercise or category not found in page")
        else:
            print("   ERROR: Could not find submit button")

        print("\n4. Testing form validation (required category field)...")

        # Clear name field
        await name_input.click()
        await name_input.evaluate("el => el.value = ''")

        # Type new exercise name without selecting category
        await name_input.fill("Validation Test Exercise")
        print("   Entered exercise name: 'Validation Test Exercise'")

        # Check that category is still on blank/select category
        category_value = await category_select.input_value()
        print(f"   Category select current value: '{category_value}'")

        if category_value == "":
            print("   Category is empty (required field)")

            # Check if form will prevent submission
            form = await page.query_selector("form")
            if form:
                is_valid = await form.evaluate("el => el.checkValidity()")
                print(f"   Form checkValidity() returns: {is_valid}")

                if not is_valid:
                    print("   SUCCESS: Browser validation prevents submission without category")
                else:
                    # Try submitting and see what happens
                    print("   Attempting to submit without category...")
                    submit_btn = await page.query_selector("button:has-text('Add Exercise')")
                    if submit_btn and not await submit_btn.is_disabled():
                        # Try to click
                        await submit_btn.click()
                        await page.wait_for_timeout(500)

                        # Check for validation message or error
                        error = await page.query_selector("text=required")
                        if error:
                            print("   SUCCESS: Got validation error message")
                        else:
                            print("   WARNING: No validation error shown")

        print("\n5. Verifying all category options are present...")

        expected_categories = ["Chest", "Back", "Legs", "Shoulders", "Biceps", "Triceps", "Core", "Glutes", "Cardio", "Full Body"]

        options = await category_select.query_selector_all("option")
        found_categories = []

        print(f"   Total options: {len(options)}")

        for opt in options:
            value = await opt.get_attribute("value")
            text = await opt.text_content()
            if value and value != "":
                found_categories.append(text.strip())

        print("   Options found:")
        for cat in found_categories:
            marker = "[OK]" if cat in expected_categories else "[?]"
            print(f"      {marker} {cat}")

        missing = [cat for cat in expected_categories if cat not in found_categories]
        if not missing:
            print(f"   SUCCESS: All {len(expected_categories)} expected categories present")
        else:
            print(f"   ERROR: Missing categories: {missing}")

        print("\n6. Checking display of exercises in list...")
        # Reload to refresh list
        await page.reload(wait_until="networkidle")
        await page.wait_for_timeout(1000)

        cards = await page.query_selector_all(".card")
        if cards:
            print(f"   Found {len(cards)} exercise cards, checking first 3...")

            count = 0
            for card in cards:
                if count >= 3:
                    break
                span = await card.query_selector("span")
                if span:
                    text = await span.text_content()
                    if text and len(text) > 2 and "Create" not in text and "Delete" not in text and "Category" not in text:
                        print(f"   Card: '{text}'")
                        if "null" in text.lower():
                            print(f"      ERROR: Contains 'null'")
                        elif text.strip().endswith("—") or text.strip().endswith(" —"):
                            print(f"      ERROR: Ends with incomplete dash")
                        else:
                            print(f"      OK: Displays correctly")
                        count += 1
        else:
            print("   No cards found")

        await browser.close()

    print("\n=== Test completed ===")


if __name__ == "__main__":
    asyncio.run(test_exercise_category())
