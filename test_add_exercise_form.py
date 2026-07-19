#!/usr/bin/env python3
"""
Test script to verify the Add Exercise form changes in ActiveWorkout component.
Tests that the form shows only exercise name input and no target sets/reps/weight fields.
"""
import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright
import time

# Ensure screenshots directory exists
screenshots_dir = Path("C:/Users/user/Desktop/Traqo/test-screenshots")
screenshots_dir.mkdir(exist_ok=True)

async def test_add_exercise_form():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        try:
            print("1. Navigating to frontend...")
            await page.goto("http://localhost:5179", wait_until="networkidle")
            await page.wait_for_timeout(2000)

            # Take screenshot of home page
            await page.screenshot(path=str(screenshots_dir / "01-home.png"))
            print("   Screenshot: 01-home.png")

            # Look for workout plans or quick log
            print("\n2. Looking for active workout or quick log...")

            # Try clicking on quick-log if available
            try:
                await page.click("text=/quick.?log/i", timeout=3000)
                await page.wait_for_timeout(2000)
            except:
                # If quick-log not available, look for existing plan
                try:
                    # Check if there are workout plans listed
                    plan_elements = await page.query_selector_all("a[href*='/workout-plans/']")
                    if plan_elements:
                        print("   Found workout plans, clicking first one")
                        await plan_elements[0].click()
                        await page.wait_for_timeout(2000)

                        # Take screenshot of plan detail
                        await page.screenshot(path=str(screenshots_dir / "02-plan-detail.png"))
                        print("   Screenshot: 02-plan-detail.png")

                        # Start workout from a day
                        start_buttons = await page.query_selector_all("button:has-text('Start')")
                        if start_buttons:
                            await start_buttons[0].click()
                            await page.wait_for_timeout(3000)
                    else:
                        print("   No plans found, creating new plan...")
                        await page.click("button:has-text('Create')")
                        await page.wait_for_timeout(2000)
                except Exception as e:
                    print(f"   Error navigating to plan: {e}")

            # Take screenshot of active workout
            await page.screenshot(path=str(screenshots_dir / "03-active-workout.png"))
            print("   Screenshot: 03-active-workout.png")

            print("\n3. Testing Add Exercise form...")

            # Look for "+ Add Exercise" button
            add_exercise_buttons = await page.query_selector_all("button:has-text('Add Exercise')")
            if add_exercise_buttons:
                print(f"   Found {len(add_exercise_buttons)} Add Exercise button(s)")
                # Click the last one (should be the one in active workout, not in plan detail)
                await add_exercise_buttons[-1].click()
                await page.wait_for_timeout(1500)

                # Take screenshot of the form
                await page.screenshot(path=str(screenshots_dir / "04-add-exercise-form.png"))
                print("   Screenshot: 04-add-exercise-form.png")

                # Check what input fields are visible
                print("\n4. Checking form input fields...")

                # Look for input fields in the form
                all_inputs = await page.query_selector_all("input[class*='input']")
                print(f"   Found {len(all_inputs)} input field(s)")

                # Check specifically for Sets, Reps, Weight inputs (which should NOT be there)
                sets_input = await page.query_selector("input[placeholder='Sets']")
                reps_input = await page.query_selector("input[placeholder='Reps']")
                weight_input = await page.query_selector("input[placeholder='Weight']")
                exercise_name_input = await page.query_selector("input[placeholder='Exercise name']")

                print(f"\n   Exercise name input: {'PRESENT' if exercise_name_input else 'MISSING'}")
                print(f"   Sets input: {'PRESENT (SHOULD NOT BE)' if sets_input else 'MISSING (CORRECT)'}")
                print(f"   Reps input: {'PRESENT (SHOULD NOT BE)' if reps_input else 'MISSING (CORRECT)'}")
                print(f"   Weight input: {'PRESENT (SHOULD NOT BE)' if weight_input else 'MISSING (CORRECT)'}")

                # Verify the correct state
                form_is_correct = exercise_name_input is not None and sets_input is None and reps_input is None and weight_input is None

                if form_is_correct:
                    print("\n   ✅ FORM IS CORRECT: Only exercise name field, no target fields!")
                else:
                    print("\n   ❌ FORM IS INCORRECT: Missing exercise name or has unwanted target fields!")

                print("\n5. Testing exercise addition...")
                if exercise_name_input:
                    # Type an exercise name
                    await exercise_name_input.fill("Test Exercise")
                    await page.wait_for_timeout(500)

                    # Take screenshot with filled form
                    await page.screenshot(path=str(screenshots_dir / "05-form-filled.png"))
                    print("   Screenshot: 05-form-filled.png")

                    # Click Add button
                    add_button = await page.query_selector("button:has-text('Add'):not(:has-text('Add Exercise'))")
                    if not add_button:
                        add_button = await page.query_selector("button[type='submit']")

                    if add_button:
                        await add_button.click()
                        await page.wait_for_timeout(2000)

                        # Take screenshot after adding
                        await page.screenshot(path=str(screenshots_dir / "06-after-add.png"))
                        print("   Screenshot: 06-after-add.png")

                        # Verify exercise was added and has "Add Set" form
                        add_set_forms = await page.query_selector_all("button:has-text('Add Set')")
                        if add_set_forms:
                            print(f"\n   ✅ Exercise was added! Found {len(add_set_forms)} 'Add Set' form(s)")
                        else:
                            print("\n   ⚠️  Could not verify exercise addition")
            else:
                print("   Could not find Add Exercise button")

            print("\n6. Checking PlanDetail form (should still have target fields)...")
            # Navigate to a plan detail page
            try:
                plan_links = await page.query_selector_all("a[href*='/workout-plans/']")
                if plan_links:
                    # Click the first plan link (not the start workout button)
                    for link in plan_links:
                        href = await link.get_attribute("href")
                        if href and "/workout-sessions/" not in href:
                            await link.click()
                            await page.wait_for_timeout(2000)
                            break

                    await page.screenshot(path=str(screenshots_dir / "07-plan-detail-page.png"))
                    print("   Screenshot: 07-plan-detail-page.png")

                    # Check if plan detail has add exercise form with targets
                    plan_add_buttons = await page.query_selector_all("button:has-text('Add Exercise')")
                    if plan_add_buttons:
                        await plan_add_buttons[0].click()
                        await page.wait_for_timeout(1500)

                        await page.screenshot(path=str(screenshots_dir / "08-plan-add-exercise-form.png"))
                        print("   Screenshot: 08-plan-add-exercise-form.png")

                        # Check for target fields in plan form
                        sets_input = await page.query_selector("input[placeholder='Sets']")
                        reps_input = await page.query_selector("input[placeholder='Reps']")
                        weight_input = await page.query_selector("input[placeholder='Weight']")

                        print(f"\n   Plan form - Sets input: {'PRESENT (CORRECT)' if sets_input else 'MISSING (SHOULD BE)'}")
                        print(f"   Plan form - Reps input: {'PRESENT (CORRECT)' if reps_input else 'MISSING (SHOULD BE)'}")
                        print(f"   Plan form - Weight input: {'PRESENT (CORRECT)' if weight_input else 'MISSING (SHOULD BE)'}")

                        if sets_input and reps_input and weight_input:
                            print("\n   ✅ PLAN DETAIL FORM IS CORRECT: Still has target fields!")
                        else:
                            print("\n   ❌ PLAN DETAIL FORM IS WRONG: Missing target fields!")
            except Exception as e:
                print(f"   Could not verify plan detail form: {e}")

            print("\n" + "="*60)
            print("VERIFICATION COMPLETE")
            print("="*60)
            print(f"\nScreenshots saved to: {screenshots_dir}")

        except Exception as e:
            print(f"Error during test: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(test_add_exercise_form())
