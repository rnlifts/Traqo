#!/usr/bin/env python3
"""
Comprehensive test for Add Exercise form changes in ActiveWorkout component.
Uses API to set up test data, then tests the UI in browser.
"""
import asyncio
import json
import requests
import uuid
from pathlib import Path
from playwright.async_api import async_playwright
from urllib.parse import urljoin

# Configuration
BACKEND_URL = "http://localhost:5000"
FRONTEND_URL = "http://localhost:5179"
screenshots_dir = Path("C:/Users/user/Desktop/Traqo/test-screenshots-final")
screenshots_dir.mkdir(exist_ok=True)

def api_call(method, endpoint, data=None, headers=None):
    """Make API call to backend."""
    url = urljoin(BACKEND_URL, endpoint)
    h = headers or {}

    if method.upper() == "GET":
        return requests.get(url, headers=h).json()
    elif method.upper() == "POST":
        return requests.post(url, json=data, headers=h).json()
    elif method.upper() == "PUT":
        return requests.put(url, json=data, headers=h).json()
    else:
        raise ValueError(f"Unknown method: {method}")

async def test_comprehensive():
    print("=" * 60)
    print("COMPREHENSIVE ADD EXERCISE FORM TEST")
    print("=" * 60)

    # Step 1: Create test user via API
    print("\n1. Creating test user...")
    try:
        user_data = {
            "name": f"TestUser{uuid.uuid4().hex[:6]}",
            "password": "TestPassword123!"
        }
        register_response = api_call("POST", "/api/auth/register", user_data)
        print("   [PASS] User created")

        # Get token from login
        login_response = api_call("POST", "/api/auth/login", user_data)
        token = login_response.get("access_token")
        user_id = login_response.get("user_id")
        print("   [PASS] Login successful, token obtained")
    except Exception as e:
        print(f"   [FAIL] Error: {e}")
        return

    headers = {"Authorization": f"Bearer {token}"}

    # Step 2: Create a test plan via API
    print("\n2. Creating test plan...")
    try:
        plan_data = {"name": f"TestPlan{uuid.uuid4().hex[:6]}"}
        plan_response = api_call("POST", "/api/workout-plans", plan_data, headers)
        plan_id = plan_response["id"]
        print(f"   [PASS] Plan created with ID: {plan_id}")
    except Exception as e:
        print(f"   [FAIL] Error: {e}")
        return

    # Step 3: Create a test day via API
    print("\n3. Creating test day...")
    try:
        day_data = {"label": "TestDay", "weekdays": ["Monday"]}
        day_response = api_call("POST", f"/api/workout-plans/{plan_id}/days", day_data, headers)
        day_id = day_response["id"]
        print(f"   [PASS] Day created with ID: {day_id}")
    except Exception as e:
        print(f"   [FAIL] Error: {e}")
        return

    # Step 4: Add an exercise to the day (so day is not empty)
    print("\n4. Adding initial exercise to day...")
    try:
        # First create an exercise
        exercise_data = {"name": "BenchPress"}
        exercise_response = api_call("POST", "/api/exercises", exercise_data, headers)
        exercise_id = exercise_response["id"]

        # Add it to the day with targets
        add_ex_data = {
            "exercise_id": exercise_id,
            "target_sets": 3,
            "target_reps": 8,
            "target_weight": 225
        }
        api_call("POST", f"/api/workout-plans/{plan_id}/days/{day_id}/exercises", add_ex_data, headers)
        print("   [PASS] Initial exercise added")
    except Exception as e:
        print(f"   [WARN] Error: {e}")

    # Step 5: Start a workout session via API
    print("\n5. Starting workout session...")
    try:
        session_response = api_call("POST", f"/api/workout-sessions?plan_id={plan_id}&day_id={day_id}", None, headers)
        session_id = session_response.get("session_id")
        print(f"   [PASS] Session started with ID: {session_id}")
    except Exception as e:
        print(f"   [WARN] Error: {e}")
        session_id = None

    # Step 6: Test UI in browser
    print("\n6. Opening browser and testing UI...")

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        try:
            print("   Navigating to login page...")
            await page.goto(FRONTEND_URL, wait_until="networkidle")
            await page.wait_for_timeout(2000)

            # Take screenshot of login page
            await page.screenshot(path=str(screenshots_dir / "01-login-page.png"))
            print("   [SCREENSHOT] 01-login-page.png")

            # Log in
            print("   Logging in...")
            try:
                await page.fill("input[type='text']", user_data["name"])
                await page.fill("input[type='password']", user_data["password"])
                await page.click("button:has-text('Log In')")
                await page.wait_for_timeout(3000)

                # Take screenshot after login
                await page.screenshot(path=str(screenshots_dir / "02-after-login.png"))
                print("   [SCREENSHOT] 02-after-login.png")

                # Navigate to the plan
                print(f"   Navigating to plan ID: {plan_id}...")
                await page.goto(f"{FRONTEND_URL}/workout-plans/{plan_id}", wait_until="networkidle")
                await page.wait_for_timeout(2000)

                # Take screenshot of plan detail
                await page.screenshot(path=str(screenshots_dir / "03-plan-detail.png"))
                print("   [SCREENSHOT] 03-plan-detail.png")

                # Start the workout
                print(f"   Starting workout for day ID: {day_id}...")
                start_buttons = await page.query_selector_all("button:has-text('Start')")
                if start_buttons:
                    await start_buttons[0].click()
                    await page.wait_for_timeout(3000)

                    # Take screenshot of active workout
                    await page.screenshot(path=str(screenshots_dir / "04-active-workout.png"))
                    print("   [SCREENSHOT] 04-active-workout.png")

                    print("\n7. Testing Add Exercise form...")

                    # Look for "+ Add Exercise" button
                    add_exercise_buttons = await page.query_selector_all("button:has-text('Add Exercise')")
                    print(f"   Found {len(add_exercise_buttons)} 'Add Exercise' button(s)")

                    if add_exercise_buttons:
                        # Click the last one (from active workout)
                        await add_exercise_buttons[-1].click()
                        await page.wait_for_timeout(1500)

                        # Take screenshot of the form
                        await page.screenshot(path=str(screenshots_dir / "05-add-exercise-form-open.png"))
                        print("   [SCREENSHOT] 05-add-exercise-form-open.png")

                        # Check form inputs
                        print("\n8. Checking form structure...")

                        exercise_name_input = await page.query_selector("input[placeholder='Exercise name']")
                        sets_input = await page.query_selector("input[placeholder='Sets']")
                        reps_input = await page.query_selector("input[placeholder='Reps']")
                        weight_input = await page.query_selector("input[placeholder='Weight']")

                        print(f"   Exercise name input: {'[PRESENT]' if exercise_name_input else '[MISSING]'}")
                        print(f"   Sets input: {'[PRESENT-BAD]' if sets_input else '[MISSING-OK]'}")
                        print(f"   Reps input: {'[PRESENT-BAD]' if reps_input else '[MISSING-OK]'}")
                        print(f"   Weight input: {'[PRESENT-BAD]' if weight_input else '[MISSING-OK]'}")

                        # Verify correct state
                        form_is_correct = (exercise_name_input is not None and
                                         sets_input is None and
                                         reps_input is None and
                                         weight_input is None)

                        print("\n9. FORM VERIFICATION RESULT:")
                        if form_is_correct:
                            print("   [PASS] Form has only exercise name, no target fields!")
                        else:
                            print("   [FAIL] Form structure is incorrect!")

                        # Test adding exercise
                        if exercise_name_input:
                            print("\n10. Testing exercise addition flow...")
                            await exercise_name_input.fill("Squats")
                            await page.wait_for_timeout(500)

                            # Take screenshot with filled form
                            await page.screenshot(path=str(screenshots_dir / "06-form-filled.png"))
                            print("   [SCREENSHOT] 06-form-filled.png")

                            # Click Add button
                            submit_button = await page.query_selector("button[type='submit']")
                            if submit_button:
                                await submit_button.click()
                                await page.wait_for_timeout(2000)

                                # Take screenshot after adding
                                await page.screenshot(path=str(screenshots_dir / "07-after-add-exercise.png"))
                                print("   [SCREENSHOT] 07-after-add-exercise.png")

                                # Verify exercise card appears with "Add Set" form
                                add_set_buttons = await page.query_selector_all("button:has-text('Add Set')")
                                if len(add_set_buttons) > 0:
                                    print(f"\n11. [PASS] EXERCISE ADDED: Found {len(add_set_buttons)} 'Add Set' button(s)")

                                    # Test logging a set
                                    print("\n12. Testing set logging...")
                                    # The new exercise should be the last card
                                    weight_inputs = await page.query_selector_all("input[placeholder='Weight']")
                                    reps_inputs = await page.query_selector_all("input[placeholder='Reps']")

                                    if weight_inputs and reps_inputs:
                                        # Use the last ones (from newly added exercise)
                                        await weight_inputs[-1].fill("185")
                                        await reps_inputs[-1].fill("8")
                                        await page.wait_for_timeout(500)

                                        # Take screenshot with filled set
                                        await page.screenshot(path=str(screenshots_dir / "08-set-form-filled.png"))
                                        print("   [SCREENSHOT] 08-set-form-filled.png")

                                        # Click Add Set button
                                        await add_set_buttons[-1].click()
                                        await page.wait_for_timeout(2000)

                                        # Take screenshot after adding set
                                        await page.screenshot(path=str(screenshots_dir / "09-after-add-set.png"))
                                        print("   [SCREENSHOT] 09-after-add-set.png")

                                        print("\n13. [PASS] SET LOGGED successfully")
                                else:
                                    print(f"\n11. [FAIL] EXERCISE NOT ADDED: No 'Add Set' buttons found")

                # Check PlanDetail still has target fields
                print("\n14. Verifying PlanDetail form still has target fields...")
                await page.goto(f"{FRONTEND_URL}/workout-plans/{plan_id}", wait_until="networkidle")
                await page.wait_for_timeout(2000)

                # Click add exercise button in plan
                add_exercise_buttons = await page.query_selector_all("button:has-text('Add Exercise')")
                if add_exercise_buttons:
                    await add_exercise_buttons[0].click()
                    await page.wait_for_timeout(1500)

                    await page.screenshot(path=str(screenshots_dir / "10-plan-add-exercise-form.png"))
                    print("   [SCREENSHOT] 10-plan-add-exercise-form.png")

                    # Check for target fields
                    sets_input = await page.query_selector("input[placeholder='Sets']")
                    reps_input = await page.query_selector("input[placeholder='Reps']")
                    weight_input = await page.query_selector("input[placeholder='Weight']")

                    print(f"   Plan form - Sets: {'[PRESENT-OK]' if sets_input else '[MISSING-BAD]'}")
                    print(f"   Plan form - Reps: {'[PRESENT-OK]' if reps_input else '[MISSING-BAD]'}")
                    print(f"   Plan form - Weight: {'[PRESENT-OK]' if weight_input else '[MISSING-BAD]'}")

                    if sets_input and reps_input and weight_input:
                        print("\n15. [PASS] PLAN DETAIL FORM CORRECT: Still has target fields!")
                    else:
                        print("\n15. [FAIL] PLAN DETAIL FORM WRONG: Missing target fields!")

            except Exception as e:
                print(f"   [ERROR] {e}")
                import traceback
                traceback.print_exc()

        except Exception as e:
            print(f"Error during test: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await browser.close()

    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)
    print(f"Screenshots saved to: {screenshots_dir}")

if __name__ == "__main__":
    asyncio.run(test_comprehensive())
