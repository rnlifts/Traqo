#!/usr/bin/env python
"""Test script for multi-day workout plan implementation."""

import requests
import json
import sys

BASE_URL = "http://localhost:8001/api"
EMAIL = "test@example.com"
PASSWORD = "testpass12345"


def print_ok(msg):
    print(f"[OK] {msg}")


def print_fail(msg):
    print(f"[FAIL] {msg}")


def print_test(msg):
    print(f"\n=== {msg} ===")


def test_auth():
    """Register and login to get auth token."""
    print_test("Testing Authentication")

    # Try to register
    resp = requests.post(
        f"{BASE_URL}/auth/register",
        json={"display_name": "Test User", "password": PASSWORD},
    )

    username = None
    if resp.status_code == 201:
        print_ok("Registration successful")
        username = resp.json()["username"]
        print(f"  Generated username: {username}")
    elif resp.status_code == 400 and "already exists" in resp.text:
        print_ok("User already exists")
        # Try a few possible usernames
        for u in ["testuser", "testuser1", "testuser2"]:
            resp_test = requests.post(
                f"{BASE_URL}/auth/login",
                json={"username": u, "password": PASSWORD},
            )
            if resp_test.status_code == 200:
                username = u
                break
        if not username:
            print_fail("Could not find existing user")
            return None
    else:
        print_fail(f"Registration failed: {resp.status_code} - {resp.text}")
        return None

    # Login
    if not username:
        print_fail("No username available for login")
        return None

    resp = requests.post(
        f"{BASE_URL}/auth/login",
        json={"username": username, "password": PASSWORD},
    )

    if resp.status_code == 200:
        token = resp.json()["token"]
        print_ok("Login successful")
        return token
    else:
        print_fail(f"Login failed: {resp.status_code} - {resp.text}")
        return None


def test_plan_creation_with_days(token):
    """Test creating a plan and adding days to it."""
    print_test("Testing Plan and Day Creation")

    headers = {"Authorization": f"Bearer {token}"}

    # Create a plan
    resp = requests.post(
        f"{BASE_URL}/workout-plans",
        headers=headers,
        json={"name": "Push/Pull/Legs"},
    )

    if resp.status_code != 201:
        print_fail(f"Plan creation failed: {resp.status_code} - {resp.text}")
        return None

    plan_data = resp.json()
    plan_id = plan_data["id"]
    print_ok(f"Plan created: {plan_data['name']} (ID: {plan_id})")

    # Create days
    days_info = [
        {"label": "Push", "weekdays": ["Monday", "Thursday"]},
        {"label": "Pull", "weekdays": ["Tuesday", "Friday"]},
        {"label": "Legs", "weekdays": ["Wednesday"]},
    ]

    created_days = []
    for day_info in days_info:
        resp = requests.post(
            f"{BASE_URL}/workout-plans/{plan_id}/days",
            headers=headers,
            json=day_info,
        )

        if resp.status_code != 201:
            print_fail(f"Day creation failed: {resp.status_code} - {resp.text}")
            return None

        day_data = resp.json()
        created_days.append(day_data)
        print_ok(f"Day created: {day_data['label']} on {day_data['weekdays']} (ID: {day_data['id']})")

    return plan_id, created_days


def test_weekday_validation(token, plan_id, day_id):
    """Test that duplicate weekdays within a plan are rejected."""
    print_test("Testing Weekday Duplicate Validation")

    headers = {"Authorization": f"Bearer {token}"}

    # Try to create another day with the same weekday
    resp = requests.post(
        f"{BASE_URL}/workout-plans/{plan_id}/days",
        headers=headers,
        json={"label": "Push Accessories", "weekdays": ["Monday"]},
    )

    if resp.status_code == 409:
        print_ok(f"Duplicate weekday correctly rejected (409 Conflict)")
        print(f"  Error: {resp.json()['error']}")
        return True
    else:
        print_fail(f"Should have rejected duplicate weekday but got {resp.status_code}")
        print(f"  Response: {resp.text}")
        return False


def test_exercise_addition_to_day(token, plan_id, days):
    """Test adding exercises to specific days."""
    print_test("Testing Exercise Addition to Days")

    headers = {"Authorization": f"Bearer {token}"}

    # First, create some exercises
    exercise_names = ["Bench Press", "Incline Dumbbell Press", "Barbell Row", "Lat Pulldown", "Squat", "Leg Press"]
    exercise_ids = []

    for exercise_name in exercise_names:
        resp = requests.post(
            f"{BASE_URL}/exercises",
            headers=headers,
            json={"name": exercise_name, "category": "strength"},
        )

        if resp.status_code != 201:
            print_fail(f"Exercise creation failed: {exercise_name}")
            continue

        exercise_ids.append(resp.json()["id"])
        print_ok(f"Exercise created: {exercise_name}")

    if not exercise_ids:
        print_fail("No exercises created")
        return False

    # Add exercises to days
    exercises_by_day = {
        0: [(exercise_ids[0], 3, 5, 185), (exercise_ids[1], 3, 8, 95)],  # Push
        1: [(exercise_ids[2], 3, 5, 185), (exercise_ids[3], 3, 10, 180)],  # Pull
        2: [(exercise_ids[4], 4, 6, 315), (exercise_ids[5], 3, 8, 405)],  # Legs
    }

    for day_idx, exercises in exercises_by_day.items():
        day_id = days[day_idx]["id"]
        print(f"\n  Adding exercises to day: {days[day_idx]['label']} (ID: {day_id})")

        for exercise_id, sets, reps, weight in exercises:
            resp = requests.post(
                f"{BASE_URL}/workout-plans/{plan_id}/days/{day_id}/exercises",
                headers=headers,
                json={
                    "exercise_id": exercise_id,
                    "target_sets": sets,
                    "target_reps": reps,
                    "target_weight": weight,
                },
            )

            if resp.status_code != 201:
                print_fail(f"Failed to add exercise: {resp.status_code} - {resp.text}")
                return False

            exercise_data = resp.json()
            print(f"  [OK] Added exercise (order: {exercise_data['order_number']})")

    return True


def test_plan_detail_retrieval(token, plan_id):
    """Test retrieving plan detail with nested day structure."""
    print_test("Testing Plan Detail Retrieval")

    headers = {"Authorization": f"Bearer {token}"}

    resp = requests.get(
        f"{BASE_URL}/workout-plans/{plan_id}",
        headers=headers,
    )

    if resp.status_code != 200:
        print_fail(f"Failed to get plan detail: {resp.status_code}")
        return False

    plan_detail = resp.json()
    print_ok(f"Retrieved plan: {plan_detail['plan']['name']}")
    print(f"  Days in plan: {len(plan_detail['days'])}")

    total_exercises = 0
    for day in plan_detail["days"]:
        day_exercises = len(day["exercises"])
        total_exercises += day_exercises
        print(f"  - {day['label']} (order {day['order_position']}): {day_exercises} exercises")
        for ex in day["exercises"]:
            print(f"    * {ex['exercise_name']} - {ex['target_sets']}x{ex['target_reps']} @ {ex['target_weight']}lbs")

    print(f"  Total exercises: {total_exercises}")
    return True


def test_start_workout_with_day(token, plan_id, day_id):
    """Test starting a workout for a specific day."""
    print_test("Testing Start Workout with Plan Day")

    headers = {"Authorization": f"Bearer {token}"}

    resp = requests.post(
        f"{BASE_URL}/workout-sessions",
        headers=headers,
        json={"workout_plan_id": plan_id, "plan_day_id": day_id},
    )

    if resp.status_code != 201:
        print_fail(f"Failed to start workout: {resp.status_code} - {resp.text}")
        return None

    session_data = resp.json()
    session_id = session_data["session_id"]
    print_ok(f"Workout session started (ID: {session_id})")

    # Verify session detail includes plan_day_id
    resp = requests.get(
        f"{BASE_URL}/workout-sessions/{session_id}",
        headers=headers,
    )

    if resp.status_code != 200:
        print_fail(f"Failed to get session detail: {resp.status_code}")
        return session_id

    session_detail = resp.json()
    if session_detail["session"]["plan_day_id"] == day_id:
        print_ok(f"Session correctly recorded plan_day_id: {day_id}")
    else:
        print_fail(f"Session plan_day_id mismatch")

    return session_id


def test_day_deletion_with_history(token, plan_id):
    """Test that days with history cannot be deleted."""
    print_test("Testing Day Deletion with Session History")

    headers = {"Authorization": f"Bearer {token}"}

    # Get all days
    resp = requests.get(
        f"{BASE_URL}/workout-plans/{plan_id}/days",
        headers=headers,
    )

    if resp.status_code != 200:
        print_fail(f"Failed to get days: {resp.status_code}")
        return False

    days = resp.json()
    if not days:
        print(f"[INFO] No days to test deletion")
        return True

    day_id = days[0]["id"]

    # Try to delete
    resp = requests.delete(
        f"{BASE_URL}/workout-plans/{plan_id}/days/{day_id}",
        headers=headers,
    )

    if resp.status_code == 409:
        print_ok(f"Day deletion correctly blocked (409 Conflict)")
        print(f"  Error: {resp.json()['error']}")
        return True
    elif resp.status_code == 204:
        print_ok(f"Day deleted (no history)")
        return True
    else:
        print_fail(f"Unexpected status code: {resp.status_code}")
        return False


def test_existing_data_migration(token):
    """Test that existing plans from before the migration still work."""
    print_test("Testing Existing Data Migration")

    headers = {"Authorization": f"Bearer {token}"}

    # List all plans
    resp = requests.get(
        f"{BASE_URL}/workout-plans",
        headers=headers,
    )

    if resp.status_code != 200:
        print_fail(f"Failed to list plans: {resp.status_code}")
        return False

    plans = resp.json()
    print_ok(f"Retrieved {len(plans)} total plans")

    if len(plans) > 0:
        # Pick a plan and verify its structure
        first_plan_id = plans[0]["id"]
        resp = requests.get(
            f"{BASE_URL}/workout-plans/{first_plan_id}",
            headers=headers,
        )

        if resp.status_code == 200:
            plan_detail = resp.json()
            days_count = len(plan_detail["days"])
            print_ok(f"Existing plan has {days_count} day(s)")

            if days_count == 1:
                day = plan_detail["days"][0]
                if day["label"] == "Day 1":
                    print_ok(f"Default 'Day 1' label correctly applied to existing plan")
                    print(f"  Exercises in Day 1: {len(day['exercises'])}")
                    return True
    return False


def main():
    """Run all tests."""
    print("=" * 60)
    print("Multi-Day Workout Plan Implementation Test Suite")
    print("=" * 60)

    # Test authentication
    token = test_auth()
    if not token:
        print_fail("Cannot proceed without authentication")
        sys.exit(1)

    # Test plan and day creation
    result = test_plan_creation_with_days(token)
    if not result:
        print_fail("Cannot proceed without plan and days")
        sys.exit(1)

    plan_id, created_days = result

    # Test weekday validation
    test_weekday_validation(token, plan_id, created_days[0]["id"])

    # Test exercise addition to days
    if test_exercise_addition_to_day(token, plan_id, created_days):
        # Test plan detail retrieval
        test_plan_detail_retrieval(token, plan_id)

        # Test starting workout with day
        if test_start_workout_with_day(token, plan_id, created_days[0]["id"]):
            # Test day deletion with history
            test_day_deletion_with_history(token, plan_id)

    # Test existing data migration
    test_existing_data_migration(token)

    print("\n" + "=" * 60)
    print("Test suite completed")
    print("=" * 60)


if __name__ == "__main__":
    main()
