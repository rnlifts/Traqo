#!/usr/bin/env python
"""Comprehensive endpoint verification for multi-day program restructure."""

import requests
import json

BASE_URL = "http://localhost:8003/api"
PASSWORD = "verifytest12345"

def print_result(name, status, response=None):
    success = 200 <= status < 300 or status in [201, 204, 409]
    marker = "[OK]" if success else "[FAIL]"
    print(f"{marker} {name}: {status}")
    if status >= 400 and response:
        error_msg = response.get('error', response.get('detail', str(response)))
        print(f"     Error: {error_msg}")

# 1. Register and login
print("=" * 60)
print("SETUP: Register and login")
print("=" * 60)

resp = requests.post(
    f"{BASE_URL}/auth/register",
    json={"display_name": "Verify User", "password": PASSWORD},
)
username = resp.json()["username"]
print_result("Register", resp.status_code, resp.json())

resp = requests.post(
    f"{BASE_URL}/auth/login",
    json={"username": username, "password": PASSWORD},
)
token = resp.json()["token"]
print_result("Login", resp.status_code, resp.json())

headers = {"Authorization": f"Bearer {token}"}

# 2. Plan CRUD
print("\n" + "=" * 60)
print("PLAN CRUD")
print("=" * 60)

resp = requests.post(
    f"{BASE_URL}/workout-plans",
    headers=headers,
    json={"name": "Test Program"},
)
plan_id = resp.json()["id"]
print_result("POST /workout-plans (create)", resp.status_code, resp.json())

resp = requests.get(f"{BASE_URL}/workout-plans", headers=headers)
print_result("GET /workout-plans (list)", resp.status_code, resp.json())

resp = requests.get(f"{BASE_URL}/workout-plans/{plan_id}", headers=headers)
print_result("GET /workout-plans/{plan_id} (detail) - CORE ENDPOINT", resp.status_code, resp.json())
if resp.status_code == 200:
    detail = resp.json()
    print(f"     Plan: {detail['plan']['name']}, Days: {len(detail['days'])}")

resp = requests.put(
    f"{BASE_URL}/workout-plans/{plan_id}",
    headers=headers,
    json={"name": "Updated Program"},
)
print_result("PUT /workout-plans/{plan_id} (update)", resp.status_code, resp.json())

# 3. Day CRUD
print("\n" + "=" * 60)
print("DAY CRUD")
print("=" * 60)

resp = requests.post(
    f"{BASE_URL}/workout-plans/{plan_id}/days",
    headers=headers,
    json={"label": "Day A", "weekdays": ["Monday", "Thursday"]},
)
day1_id = resp.json()["id"]
print_result("POST /workout-plans/{plan_id}/days (create day 1)", resp.status_code, resp.json())

resp = requests.post(
    f"{BASE_URL}/workout-plans/{plan_id}/days",
    headers=headers,
    json={"label": "Day B", "weekdays": ["Tuesday"]},
)
day2_id = resp.json()["id"]
print_result("POST /workout-plans/{plan_id}/days (create day 2)", resp.status_code, resp.json())

resp = requests.get(
    f"{BASE_URL}/workout-plans/{plan_id}/days",
    headers=headers,
)
print_result("GET /workout-plans/{plan_id}/days (list days)", resp.status_code, resp.json())

resp = requests.put(
    f"{BASE_URL}/workout-plans/{plan_id}/days/{day1_id}",
    headers=headers,
    json={"label": "Updated Day A", "weekdays": ["Monday"]},
)
print_result("PUT /workout-plans/{plan_id}/days/{day_id} (update day)", resp.status_code, resp.json())

# Test weekday validation
resp = requests.post(
    f"{BASE_URL}/workout-plans/{plan_id}/days",
    headers=headers,
    json={"label": "Duplicate Monday", "weekdays": ["Monday"]},
)
print_result("POST /days with duplicate weekday (should be 409)", resp.status_code, resp.json())

# 4. Exercise CRUD (in day)
print("\n" + "=" * 60)
print("EXERCISE-IN-DAY CRUD")
print("=" * 60)

# Create exercises
resp = requests.post(
    f"{BASE_URL}/exercises",
    headers=headers,
    json={"name": "Squat", "category": "Legs"},
)
if resp.status_code == 201:
    ex1_id = resp.json()["id"]
    print_result("POST /exercises (create exercise 1)", resp.status_code, resp.json())
else:
    ex1_id = 1
    print_result("POST /exercises (create exercise 1)", resp.status_code, resp.json())

resp = requests.post(
    f"{BASE_URL}/exercises",
    headers=headers,
    json={"name": "Deadlift", "category": "Full Body"},
)
if resp.status_code == 201:
    ex2_id = resp.json()["id"]
    print_result("POST /exercises (create exercise 2)", resp.status_code, resp.json())
else:
    ex2_id = 2
    print_result("POST /exercises (create exercise 2)", resp.status_code, resp.json())

# Add exercises to day
resp = requests.post(
    f"{BASE_URL}/workout-plans/{plan_id}/days/{day1_id}/exercises",
    headers=headers,
    json={"exercise_id": ex1_id, "target_sets": 3, "target_reps": 5, "target_weight": 315},
)
ex_in_plan_id = resp.json().get("id")
print_result("POST /days/{day_id}/exercises (add to day)", resp.status_code, resp.json())

resp = requests.post(
    f"{BASE_URL}/workout-plans/{plan_id}/days/{day1_id}/exercises",
    headers=headers,
    json={"exercise_id": ex2_id, "target_sets": 3, "target_reps": 5, "target_weight": 405},
)
print_result("POST /days/{day_id}/exercises (add second)", resp.status_code, resp.json())

# Add to day 2 as well
resp = requests.post(
    f"{BASE_URL}/workout-plans/{plan_id}/days/{day2_id}/exercises",
    headers=headers,
    json={"exercise_id": ex1_id, "target_sets": 4, "target_reps": 8, "target_weight": 275},
)
print_result("POST /days/{day_id}/exercises (add to day 2)", resp.status_code, resp.json())

# Reorder exercise
if ex_in_plan_id:
    resp = requests.put(
        f"{BASE_URL}/workout-plans/{plan_id}/days/{day1_id}/exercises/{ex_in_plan_id}/move",
        headers=headers,
        json={"direction": "down"},
    )
    print_result("PUT /exercises/{id}/move (reorder)", resp.status_code, resp.json())

    # Remove exercise
    resp = requests.delete(
        f"{BASE_URL}/workout-plans/{plan_id}/days/{day1_id}/exercises/{ex_in_plan_id}",
        headers=headers,
    )
    print_result("DELETE /exercises/{id} (remove)", resp.status_code, resp.json() if resp.text else {})

# 5. Get plan detail (nested structure)
print("\n" + "=" * 60)
print("PLAN DETAIL WITH NESTED DAYS/EXERCISES")
print("=" * 60)

resp = requests.get(f"{BASE_URL}/workout-plans/{plan_id}", headers=headers)
if resp.status_code == 200:
    detail = resp.json()
    print_result("GET /workout-plans/{plan_id} (detail)", resp.status_code, {})
    plan = detail["plan"]
    print(f"     Plan: {plan['name']}")
    print(f"     Days: {len(detail['days'])}")
    for day in detail["days"]:
        print(f"       - {day['label']} (order {day['order_position']}, weekdays: {day['weekdays']})")
        print(f"         Exercises: {len(day['exercises'])}")
        for ex in day["exercises"]:
            print(f"           * {ex['exercise_name']} - {ex['target_sets']}x{ex['target_reps']} @ {ex['target_weight']}")
else:
    print_result("GET /workout-plans/{plan_id} (detail)", resp.status_code, resp.json())

# 6. Workout session
print("\n" + "=" * 60)
print("WORKOUT SESSIONS")
print("=" * 60)

resp = requests.post(
    f"{BASE_URL}/workout-sessions",
    headers=headers,
    json={"workout_plan_id": plan_id, "plan_day_id": day1_id},
)
session_id = resp.json().get("session_id")
print_result("POST /workout-sessions (start workout)", resp.status_code, resp.json())

if session_id:
    resp = requests.get(
        f"{BASE_URL}/workout-sessions/{session_id}",
        headers=headers,
    )
    print_result("GET /workout-sessions/{session_id} (detail)", resp.status_code, resp.json())

# 7. Delete operations
print("\n" + "=" * 60)
print("DELETE OPERATIONS")
print("=" * 60)

# Try to delete day with history - should fail
resp = requests.delete(
    f"{BASE_URL}/workout-plans/{plan_id}/days/{day1_id}",
    headers=headers,
)
print_result("DELETE /days/{day_id} with sessions (should be 409)", resp.status_code, resp.json() if resp.text else {})

# Delete day without history - should work
resp = requests.delete(
    f"{BASE_URL}/workout-plans/{plan_id}/days/{day2_id}",
    headers=headers,
)
print_result("DELETE /days/{day_id} without sessions", resp.status_code, resp.json() if resp.text else {})

# Delete plan with history - should fail
resp = requests.delete(
    f"{BASE_URL}/workout-plans/{plan_id}",
    headers=headers,
)
print_result("DELETE /workout-plans/{plan_id} with sessions (should be 409)", resp.status_code, resp.json())

print("\n" + "=" * 60)
print("VERIFICATION COMPLETE")
print("=" * 60)
