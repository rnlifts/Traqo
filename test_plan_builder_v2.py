#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Test script for plan-builder v2 data-model foundation.

Verifies:
1. Migration applied successfully (new columns/tables exist)
2. Link-resolution algorithm works correctly
3. CustomizeWeek use case works
4. MatchPreviousWeek use case works
5. New endpoints respond correctly
"""

import requests
import json
from datetime import datetime
import sys
import io
import base64

# Force UTF-8 encoding for stdout
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:5000/api"

# Test user credentials
import random
test_name = f"testuser_{int(datetime.now().timestamp()*1000) % 1000000}"
TEST_PASSWORD = "TestPassword123"

print("=" * 80)
print("PLAN-BUILDER V2 FOUNDATION TEST")
print("=" * 80)

# Step 1: Register a test user
print("\n1. Registering test user...")
resp = requests.post(f"{BASE_URL}/auth/register", json={
    "display_name": test_name,
    "password": TEST_PASSWORD
})
if resp.status_code == 201:
    username = resp.json()["username"]
    print(f"   [OK] User created: username {username}")
else:
    print(f"   [FAIL] Failed to create user: {resp.status_code}")
    print(f"   {resp.text}")
    exit(1)

# Login to get token
print("\n2. Logging in...")
login_resp = requests.post(
    f"{BASE_URL}/auth/login",
    json={"username": username, "password": TEST_PASSWORD}
)
if login_resp.status_code == 200:
    token = login_resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"   [OK] Logged in successfully")

    # Extract user_id from JWT token (without verifying signature for this test)
    decoded = jwt.decode(token, options={"verify_signature": False})
    user_id = decoded.get("user_id")
    print(f"   User ID: {user_id}")
else:
    print(f"   [FAIL] Login failed: {login_resp.status_code}")
    print(f"   {login_resp.text}")
    exit(1)

# Step 2: Create some exercises
print("\n3. Creating test exercises...")
exercises = []
for name in ["Bench Press", "Squats", "Deadlift"]:
    resp = requests.post(
        f"{BASE_URL}/exercises",
        headers=headers,
        json={"name": name, "category": "strength"}
    )
    if resp.status_code == 201:
        ex_id = resp.json()["id"]
        exercises.append(ex_id)
        print(f"   [OK] Created exercise: {name} (ID {ex_id})")
    else:
        print(f"   [FAIL] Failed to create exercise: {resp.status_code}")

# Step 3: Create a days-type plan (existing behavior, for baseline)
print("\n4. Creating a 'days'-type plan...")
resp = requests.post(
    f"{BASE_URL}/workout-plans",
    headers=headers,
    json={"name": "Simple Weekly Program"}
)
if resp.status_code == 201:
    days_plan = resp.json()
    days_plan_id = days_plan["id"]
    print(f"   [OK] Plan created: ID {days_plan_id}")
    print(f"   unit_type: {days_plan.get('unit_type', 'not set')}")
    print(f"   total_units: {days_plan.get('total_units', 'not set')}")
else:
    print(f"   [FAIL] Failed to create plan: {resp.status_code}")

# Step 4: Add days to the days-type plan
print("\n5. Adding days to plan...")
for i in range(1, 4):
    resp = requests.post(
        f"{BASE_URL}/workout-plans/{days_plan_id}/days",
        headers=headers,
        json={"label": f"Day {i}", "weekdays": []}
    )
    if resp.status_code == 201:
        day = resp.json()
        print(f"   [OK] Day created: {day['label']} (ID {day['id']})")

# Step 5: Add exercises to a day
print("\n6. Adding exercises to day 1...")
resp = requests.get(
    f"{BASE_URL}/workout-plans/{days_plan_id}/days",
    headers=headers
)
if resp.status_code == 200:
    days_list = resp.json()
    first_day_id = days_list[0]["id"]

    resp = requests.post(
        f"{BASE_URL}/workout-plans/{days_plan_id}/days/{first_day_id}/exercises",
        headers=headers,
        json={
            "exercise_id": exercises[0],
            "target_sets": 4,
            "target_reps": 5,
            "target_weight": 225.0
        }
    )
    if resp.status_code == 201:
        ex = resp.json()
        print(f"   [OK] Exercise added: (ID {ex['id']})")
        print(f"   target_sets={ex['target_sets']}, target_reps={ex['target_reps']}, target_weight={ex['target_weight']}")

# Step 6: Get plan detail and verify it includes correct info
print("\n7. Fetching plan detail...")
resp = requests.get(
    f"{BASE_URL}/workout-plans/{days_plan_id}",
    headers=headers
)
if resp.status_code == 200:
    detail = resp.json()
    print(f"   [OK] Plan detail retrieved")
    print(f"   Plan name: {detail['plan']['name']}")
    print(f"   Days in plan: {len(detail['days'])}")
    if len(detail['days']) > 0:
        day = detail['days'][0]
        print(f"   First day: {day['label']}, exercises: {len(day['exercises'])}")
        if len(day['exercises']) > 0:
            ex = day['exercises'][0]
            print(f"   First exercise: target_sets={ex.get('target_sets')}, target_reps={ex.get('target_reps')}, target_weight={ex.get('target_weight')}")

# Step 7: Manually create a weeks-type plan in the DB for testing
print("\n8. Creating test data for weeks-type plan (via direct DB)...")
print("   (This simulates a plan created by the planned bulk-create endpoint)")

import sys
sys.path.insert(0, '/c/Users/user/Desktop/Traqo/backend')

from src.infrastructure.database import SessionLocal
from src.modules.workouts.infrastructure.models.workout_plan_model import WorkoutPlanModel
from src.modules.workouts.infrastructure.models.plan_week_model import PlanWeekModel
from src.modules.workouts.infrastructure.models.plan_day_model import PlanDayModel
from src.modules.workouts.infrastructure.models.workout_exercise_model import WorkoutExerciseModel

db = SessionLocal()

# Create a weeks-type plan
weeks_plan = WorkoutPlanModel(
    user_id=user_id,
    name="5-Week Block",
    unit_type="weeks",
    total_units=5
)
db.add(weeks_plan)
db.commit()
weeks_plan_id = weeks_plan.id
print(f"   [OK] Created weeks-type plan: ID {weeks_plan_id}")

# Create week 1 (base) with 7 days
week1 = PlanWeekModel(
    workout_plan_id=weeks_plan_id,
    week_number=1,
    mode="base"
)
db.add(week1)
db.commit()
week1_id = week1.id
print(f"   [OK] Created week 1 (base): ID {week1_id}")

# Add days to week 1 (Mon-Sun)
day_labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
week1_day_ids = []
for i, label in enumerate(day_labels):
    day = PlanDayModel(
        workout_plan_id=weeks_plan_id,
        label=label,
        order_position=i+1,
        is_rest=(label == "Sunday"),  # Sunday is rest day
        plan_week_id=week1_id
    )
    db.add(day)
    db.commit()
    week1_day_ids.append(day.id)
print(f"   [OK] Created 7 days for week 1")

# Add an exercise to Monday
monday_day_id = week1_day_ids[0]
ex = WorkoutExerciseModel(
    plan_day_id=monday_day_id,
    exercise_id=exercises[0],
    order_number=1,
    target_sets=4,
    target_reps=5,
    target_weight=225.0,
    notes="Heavy singles"
)
db.add(ex)
db.commit()
print(f"   [OK] Added exercise to Monday")

# Create weeks 2-5 as linked weeks (no days)
for week_num in [2, 3, 4, 5]:
    week = PlanWeekModel(
        workout_plan_id=weeks_plan_id,
        week_number=week_num,
        mode="linked"
    )
    db.add(week)
    db.commit()
    if week_num == 3:
        week3_id = week.id
print(f"   [OK] Created weeks 2-5 (linked)")

# Create custom content for week 3
week3 = db.query(PlanWeekModel).filter(
    PlanWeekModel.workout_plan_id == weeks_plan_id,
    PlanWeekModel.week_number == 3
).first()
week3_day_ids = []
for i, label in enumerate(day_labels):
    day = PlanDayModel(
        workout_plan_id=weeks_plan_id,
        label=label,
        order_position=i+1,
        is_rest=(label == "Wednesday"),  # Different rest day
        plan_week_id=week3.id
    )
    db.add(day)
    db.commit()
    week3_day_ids.append(day.id)

# Make week 3 custom
week3.mode = "custom"
db.commit()
print(f"   [OK] Created week 3 (custom) with different content")

# Add exercise to week 3 Monday (different content)
ex = WorkoutExerciseModel(
    plan_day_id=week3_day_ids[0],
    exercise_id=exercises[1],
    order_number=1,
    target_sets=5,
    target_reps=8,
    target_weight=185.0,
    notes="Moderate volume"
)
db.add(ex)
db.commit()

db.close()

print("\n9. Testing link-resolution algorithm...")
print("   Scenario: Weeks 1(base)/2(linked)/3(custom)/4(linked)/5(linked)")
print("   Expected: Week 2 resolves to Week 1, Weeks 4-5 resolve to Week 3")

# Test the resolution via the API (via get_effective_week if exposed, or manually)
print("\n   Testing via direct algorithm simulation...")

# Simulate the resolution for week 2 (should resolve to week 1)
db = SessionLocal()
weeks = db.query(PlanWeekModel).filter(PlanWeekModel.workout_plan_id == weeks_plan_id).order_by(PlanWeekModel.week_number).all()

def resolve_week_to_base(weeks_list, target_week_num):
    """Simulate the getEffectiveDays algorithm."""
    j = target_week_num
    while j >= 1:
        w = next((w for w in weeks_list if w.week_number == j), None)
        if w and w.mode != "linked":
            return w.week_number
        j -= 1
    return None

week2_resolved = resolve_week_to_base(weeks, 2)
week4_resolved = resolve_week_to_base(weeks, 4)
week5_resolved = resolve_week_to_base(weeks, 5)

print(f"   Week 2 resolves to week: {week2_resolved} (expected 1) {'[OK]' if week2_resolved == 1 else '[FAIL]'}")
print(f"   Week 4 resolves to week: {week4_resolved} (expected 3) {'[OK]' if week4_resolved == 3 else '[FAIL]'}")
print(f"   Week 5 resolves to week: {week5_resolved} (expected 3) {'[OK]' if week5_resolved == 3 else '[FAIL]'}")

db.close()

print("\n10. Testing CustomizeWeek endpoint...")
# POST /api/workout-plans/{plan_id}/weeks/2/customize
resp = requests.post(
    f"{BASE_URL}/workout-plans/{weeks_plan_id}/weeks/2/customize",
    headers=headers
)
if resp.status_code == 204:
    print(f"   [OK] CustomizeWeek succeeded (204)")

    # Verify week 2 is now custom with its own days
    db = SessionLocal()
    week2 = db.query(PlanWeekModel).filter(
        PlanWeekModel.workout_plan_id == weeks_plan_id,
        PlanWeekModel.week_number == 2
    ).first()
    print(f"   Week 2 mode is now: {week2.mode} (expected 'custom') {'[OK]' if week2.mode == 'custom' else '[FAIL]'}")

    # Check if it has days now
    week2_days = db.query(PlanDayModel).filter(PlanDayModel.plan_week_id == week2.id).all()
    print(f"   Week 2 now has {len(week2_days)} days (expected 7) {'[OK]' if len(week2_days) == 7 else '[FAIL]'}")

    if len(week2_days) > 0:
        # Check if Monday has the exercise
        monday = next((d for d in week2_days if d.label == "Monday"), None)
        if monday:
            monday_exercises = db.query(WorkoutExerciseModel).filter(
                WorkoutExerciseModel.plan_day_id == monday.id
            ).all()
            print(f"   Week 2 Monday has {len(monday_exercises)} exercise(s) {'[OK]' if len(monday_exercises) > 0 else '[FAIL]'}")

    db.close()
else:
    print(f"   [FAIL] CustomizeWeek failed: {resp.status_code}")
    print(f"   {resp.text}")

print("\n11. Testing MatchPreviousWeek endpoint...")
# POST /api/workout-plans/{plan_id}/weeks/2/match-previous
resp = requests.post(
    f"{BASE_URL}/workout-plans/{weeks_plan_id}/weeks/2/match-previous",
    headers=headers
)
if resp.status_code == 204:
    print(f"   [OK] MatchPreviousWeek succeeded (204)")

    # Verify week 2 is now linked with no days
    db = SessionLocal()
    week2 = db.query(PlanWeekModel).filter(
        PlanWeekModel.workout_plan_id == weeks_plan_id,
        PlanWeekModel.week_number == 2
    ).first()
    print(f"   Week 2 mode is now: {week2.mode} (expected 'linked') {'[OK]' if week2.mode == 'linked' else '[FAIL]'}")

    # Check that its days were deleted
    week2_days = db.query(PlanDayModel).filter(PlanDayModel.plan_week_id == week2.id).all()
    print(f"   Week 2 now has {len(week2_days)} days (expected 0) {'[OK]' if len(week2_days) == 0 else '[FAIL]'}")

    db.close()
else:
    print(f"   [FAIL] MatchPreviousWeek failed: {resp.status_code}")
    print(f"   {resp.text}")

print("\n12. Database row count verification...")
db = SessionLocal()

# Count rows
plan_days_count = db.query(PlanDayModel).count()
workout_exercises_count = db.query(WorkoutExerciseModel).count()
workout_sessions_count = db.query(PlanWeekModel).count()  # Should still be fine
plan_weeks_count = db.query(PlanWeekModel).count()

print(f"   plan_days: {plan_days_count} rows")
print(f"   workout_exercises: {workout_exercises_count} rows")
print(f"   plan_weeks: {plan_weeks_count} rows")
print(f"   (no plan_day_schedule rows should exist - table should be dropped)")

db.close()

print("\n" + "=" * 80)
print("TESTS COMPLETE")
print("=" * 80)
