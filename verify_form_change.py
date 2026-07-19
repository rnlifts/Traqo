#!/usr/bin/env python3
"""
Direct verification of the Add Exercise form structure by examining the component code.
"""
import re
from pathlib import Path

def verify_form_change():
    print("=" * 70)
    print("VERIFYING ACTIVEWORKOUT.TSX CHANGES")
    print("=" * 70)

    file_path = Path("C:/Users/user/Desktop/Traqo/frontend/src/features/sessions/ActiveWorkout.tsx")
    content = file_path.read_text(encoding='utf-8')

    print("\n1. Checking for removed state variables...")

    # Check if the old state variables are gone
    has_target_sets = "addExerciseTargetSets" in content
    has_target_reps = "addExerciseTargetReps" in content
    has_target_weight = "addExerciseTargetWeight" in content

    print(f"   addExerciseTargetSets in file: {has_target_sets}")
    print(f"   addExerciseTargetReps in file: {has_target_reps}")
    print(f"   addExerciseTargetWeight in file: {has_target_weight}")

    if not has_target_sets and not has_target_reps and not has_target_weight:
        print("\n   [PASS] All three state variables removed!")
    else:
        print("\n   [FAIL] Some state variables still present!")

    print("\n2. Checking for removed grid with target inputs...")

    # Look for the grid that held the three inputs
    grid_pattern = r'gridTemplateColumns:\s*"1fr\s+1fr\s+1fr"'
    has_grid = bool(re.search(grid_pattern, content))

    print(f"   3-column grid for targets present: {has_grid}")

    if not has_grid:
        print("\n   [PASS] Grid with target fields removed!")
    else:
        print("\n   [FAIL] Grid with target fields still present!")

    print("\n3. Checking that exercise name input is still present...")

    # Look for exercise name input
    has_exercise_input = 'placeholder="Exercise name"' in content
    print(f"   Exercise name input present: {has_exercise_input}")

    if has_exercise_input:
        print("\n   [PASS] Exercise name input still present!")
    else:
        print("\n   [FAIL] Exercise name input missing!")

    print("\n4. Checking that addExerciseToDay is called correctly...")

    # Look for the function call without target arguments
    call_pattern = r'await addExerciseToDay\(planId, dayId, exerciseId\);'
    has_correct_call = bool(re.search(call_pattern, content))

    print(f"   Correct function call present: {has_correct_call}")

    if has_correct_call:
        print("\n   [PASS] Function called with correct arguments (no targets)!")
    else:
        print("\n   [FAIL] Function call may be incorrect!")

    print("\n5. Checking that target fields removed from form JSX...")

    # Look for Sets/Reps/Weight placeholder references
    # Find the section with "Add Exercise" form
    match = re.search(r'<form onSubmit={handleAddExerciseToDay}.*?</form>', content, re.DOTALL)
    form_has_sets = False
    form_has_reps = False
    form_has_weight = False

    if match:
        form_content = match.group(0)
        form_has_sets = 'placeholder="Sets"' in form_content
        form_has_reps = 'placeholder="Reps"' in form_content
        form_has_weight = 'placeholder="Weight"' in form_content

        print(f"   Sets input in form: {form_has_sets}")
        print(f"   Reps input in form: {form_has_reps}")
        print(f"   Weight input in form: {form_has_weight}")

        if not form_has_sets and not form_has_reps and not form_has_weight:
            print("\n   [PASS] All target inputs removed from form!")
        else:
            print("\n   [FAIL] Some target inputs still in form!")
    else:
        print("   Could not find form in content")

    print("\n6. Checking PlanDetail.tsx is unchanged...")

    try:
        plan_detail_path = Path("C:/Users/user/Desktop/Traqo/frontend/src/features/workoutPlans/PlanDetail.tsx")
        plan_detail_content = plan_detail_path.read_text(encoding='utf-8')

        # Check if PlanDetail still has the target fields
        plan_has_sets = 'placeholder="Sets"' in plan_detail_content
        plan_has_reps = 'placeholder="Reps"' in plan_detail_content
        plan_has_weight = 'placeholder="Weight"' in plan_detail_content

        print(f"   PlanDetail has Sets input: {plan_has_sets}")
        print(f"   PlanDetail has Reps input: {plan_has_reps}")
        print(f"   PlanDetail has Weight input: {plan_has_weight}")

        if plan_has_sets and plan_has_reps and plan_has_weight:
            print("\n   [PASS] PlanDetail still has all target fields!")
        else:
            print("\n   [FAIL] PlanDetail may be missing target fields!")
    except Exception as e:
        print(f"   [ERROR] Could not read PlanDetail.tsx: {e}")
        plan_has_sets = False
        plan_has_reps = False
        plan_has_weight = False

    print("\n" + "=" * 70)
    print("VERIFICATION COMPLETE")
    print("=" * 70)

    # Summary
    print("\nSUMMARY:")
    all_checks = [
        ("State variables removed", not has_target_sets and not has_target_reps and not has_target_weight),
        ("Target grid removed", not has_grid),
        ("Exercise input preserved", has_exercise_input),
        ("Function call correct", has_correct_call),
        ("Form inputs removed", match and not form_has_sets and not form_has_reps and not form_has_weight),
        ("PlanDetail unchanged", plan_has_sets and plan_has_reps and plan_has_weight),
    ]

    passed = sum(1 for _, result in all_checks if result)
    total = len(all_checks)

    print(f"\nPassed: {passed}/{total} checks")

    for check_name, result in all_checks:
        status = "[PASS]" if result else "[FAIL]"
        print(f"  {status} {check_name}")

    if passed == total:
        print("\n[SUCCESS] All checks passed! Form changes are correct.")
        return True
    else:
        print(f"\n[ERROR] {total - passed} check(s) failed!")
        return False

if __name__ == "__main__":
    verify_form_change()
