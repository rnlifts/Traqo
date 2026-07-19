#!/usr/bin/env python3
"""
Live browser test of the Add Exercise form changes.
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
import time

screenshots_dir = Path("C:/Users/user/Desktop/Traqo/test-screenshots-live")
screenshots_dir.mkdir(exist_ok=True)

async def test_live():
    print("=" * 70)
    print("LIVE BROWSER TEST - ADD EXERCISE FORM")
    print("=" * 70)

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        try:
            print("\n1. Opening frontend application...")
            await page.goto("http://localhost:5179", wait_until="load")
            await page.wait_for_timeout(2000)

            # Take screenshot
            await page.screenshot(path=str(screenshots_dir / "01-home-page.png"))
            print("   [SCREENSHOT] 01-home-page.png - Home page loaded")

            # Get current URL to see where we are
            current_url = page.url
            print(f"   Current URL: {current_url}")

            print("\n2. Looking for navigation elements...")

            # Get all links
            links = await page.query_selector_all("a")
            print(f"   Found {len(links)} links")

            # Get all buttons
            buttons = await page.query_selector_all("button")
            print(f"   Found {len(buttons)} buttons")

            # Check for text content
            page_text = await page.text_content("body")
            if "Traqo" in page_text:
                print("   [OK] Traqo app loaded")

            if "Log In" in page_text:
                print("   [ACTION] Login required")
                # Try to log in with a test account
                print("\n3. Testing login flow...")

                # Find input fields
                inputs = await page.query_selector_all("input")
                print(f"   Found {len(inputs)} input field(s)")

                if len(inputs) >= 2:
                    # Try to log in
                    await inputs[0].fill("testuser")
                    await inputs[1].fill("password")

                    await page.screenshot(path=str(screenshots_dir / "02-login-form.png"))
                    print("   [SCREENSHOT] 02-login-form.png - Login form filled")

                    # Try to find and click login button
                    login_buttons = await page.query_selector_all("button")
                    if login_buttons:
                        # Click last button (likely the submit button)
                        await login_buttons[-1].click()
                        await page.wait_for_timeout(3000)

                        await page.screenshot(path=str(screenshots_dir / "03-after-login-attempt.png"))
                        print("   [SCREENSHOT] 03-after-login-attempt.png")

            # Now look specifically for the Add Exercise form in the DOM
            # by checking if it's present in the HTML
            print("\n4. Analyzing form structure...")

            # Get the full HTML
            html = await page.content()

            # Check for form in HTML
            if "handleAddExerciseToDay" in html:
                print("   [OK] Add Exercise form handler found in HTML")
            else:
                print("   [NOTE] Add Exercise form handler not found (may not be visible yet)")

            # Check for the specific placeholder texts
            has_exercise_placeholder = 'placeholder="Exercise name"' in html
            has_sets_placeholder = 'placeholder="Sets"' in html
            has_reps_placeholder = 'placeholder="Reps"' in html
            has_weight_placeholder = 'placeholder="Weight"' in html

            print(f"\n5. Form field placeholders found:")
            print(f"   Exercise name: {has_exercise_placeholder}")
            print(f"   Sets: {has_sets_placeholder}")
            print(f"   Reps: {has_reps_placeholder}")
            print(f"   Weight: {has_weight_placeholder}")

            # This is the key verification!
            print(f"\n6. VERIFICATION RESULT:")
            if has_exercise_placeholder and not has_sets_placeholder and not has_reps_placeholder and not has_weight_placeholder:
                print("   [PASS] Form has exercise name only, no target fields!")
                print("   [SUCCESS] Add Exercise form changes are correct!")
            elif has_exercise_placeholder:
                print("   [PARTIAL] Form has exercise name, checking target fields...")
                if has_sets_placeholder or has_reps_placeholder or has_weight_placeholder:
                    print("   [FAIL] Form still has target fields that should be removed!")
            else:
                print("   [NOTE] Exercise name field not found in rendered HTML")

            # Check the API file too to verify it supports optional args
            print("\n7. Checking API compatibility...")
            api_file = Path("C:/Users/user/Desktop/Traqo/frontend/src/api/workoutPlansApi.ts")
            api_content = api_file.read_text(encoding='utf-8')

            # Check for optional parameters
            has_optional_target_sets = "targetSets?" in api_content
            has_optional_target_reps = "targetReps?" in api_content
            has_optional_target_weight = "targetWeight?" in api_content

            print(f"   API - targetSets optional: {has_optional_target_sets}")
            print(f"   API - targetReps optional: {has_optional_target_reps}")
            print(f"   API - targetWeight optional: {has_optional_target_weight}")

            if has_optional_target_sets and has_optional_target_reps and has_optional_target_weight:
                print("   [PASS] API supports optional target parameters!")
            else:
                print("   [WARN] Check API parameter definitions")

            print("\n" + "=" * 70)
            print("LIVE TEST COMPLETE")
            print("=" * 70)

            print(f"\nScreenshots saved to: {screenshots_dir}")

        except Exception as e:
            print(f"\n[ERROR] {e}")
            import traceback
            traceback.print_exc()

        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(test_live())
