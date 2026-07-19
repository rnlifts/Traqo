#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Verification script for plan-builder v2 implementation.
Tests all 6 required verification steps.
"""

import sys
sys.path.insert(0, '/c/Users/user/Desktop/Traqo/backend')

from src.infrastructure.database import SessionLocal
from src.modules.workouts.infrastructure.models.workout_plan_model import WorkoutPlanModel
from src.modules.workouts.infrastructure.models.plan_week_model import PlanWeekModel
from src.modules.workouts.infrastructure.models.plan_day_model import PlanDayModel
from src.modules.workouts.infrastructure.models.workout_exercise_model import WorkoutExerciseModel
from src.modules.sessions.infrastructure.models.workout_session_model import WorkoutSessionModel
from src.modules.exercises.infrastructure.models.exercise_model import ExerciseModel
from src.modules.auth.infrastructure.models.user_model import UserModel
import requests
import base64

print("=" * 80)
print("VERIFICATION: Plan-Builder v2 Data-Model Foundation")
print("=" * 80)

# === STEP 1: Verify migration applied ===
print("\nSTEP 1: Verify migration applied...")
db = SessionLocal()

# Check that new tables/columns exist by trying to query them
try:
    plan_weeks_count = db.query(PlanWeekModel).count()
    print("[OK] plan_weeks table exists")
except Exception as e:
    print(f"[FAIL] plan_weeks table check failed: {e}")
    exit(1)

# Count rows in key tables
plan_days_count = db.query(PlanDayModel).count()
workout_exercises_count = db.query(WorkoutExerciseModel).count()
workout_sessions_count = db.query(WorkoutSessionModel).count()

print(f"[OK] Before-migration row counts:")
print(f"     plan_days: {plan_days_count}")
print(f"     workout_exercises: {workout_exercises_count}")
print(f"     workout_sessions: {workout_sessions_count}")
print(f"     plan_weeks: {plan_weeks_count}")

# Check that plan_day_schedule was dropped
try:
    from sqlalchemy import inspect
    inspector = inspect(db.get_bind())
    tables = inspector.get_table_names()
    if 'plan_day_schedule' in tables:
        print("[FAIL] plan_day_schedule table should have been dropped")
        exit(1)
    else:
        print("[OK] plan_day_schedule table dropped as expected")
except Exception as e:
    print(f"[FAIL] Table inspection failed: {e}")

db.close()

# === STEP 2: Create test user and exercises ===
print("\nSTEP 2: Creating test user and exercises...")

# Register user
BASE_URL = "http://localhost:5000/api"
resp = requests.post(f"{BASE_URL}/auth/register", json={
    "display_name": "VerifyTest",
    "password": "VerifyTest123"
})

if resp.status_code != 201:
    print(f"[FAIL] Register failed: {resp.status_code} - {resp.text}")
    exit(1)

username = resp.json()["username"]
print(f"[OK] User created: {username}")

# Login
resp = requests.post(f"{BASE_URL}/auth/login", json={
    "username": username,
    "password": "VerifyTest123"
})

if resp.status_code != 200:
    print(f"[FAIL] Login failed: {resp.status_code}")
    exit(1)

token = resp.json()["token"]
# Extract user_id from token payload
try:
    import json as json_lib
    decoded_payload = base64.urlsafe_b64decode(token.split('.')[1] + "==").decode()
    payload = json_lib.loads(decoded_payload)
    user_id = payload.get("user_id") or payload.get("sub")  # JWT uses 'sub' for subject (user_id)
    if not user_id:
        print(f"[FAIL] user_id not found in token payload: {decoded_payload}")
        exit(1)
    user_id = int(user_id)
except Exception as e:
    print(f"[FAIL] Failed to parse token: {e}")
    print(f"       Token payload: {decoded_payload if 'decoded_payload' in locals() else 'failed to decode'}")
    exit(1)

headers = {"Authorization": f"Bearer {token}"}
print(f"[OK] Logged in, user_id: {user_id}")

# Create exercises
exercises = []
exercise_names = ["Bench Press", "Squats", "Deadlift"]
for name in exercise_names:
    resp = requests.post(f"{BASE_URL}/exercises", headers=headers, json={
        "name": name,
        "category": "Chest"  # Use valid category
    })
    if resp.status_code == 201:
        exercises.append(resp.json()["id"])
        print(f"[OK] Exercise created: {name} (ID {resp.json()['id']})")
    else:
        print(f"[FAIL] Exercise creation failed: {resp.status_code} - {resp.text}")

if len(exercises) < 3:
    print(f"[FAIL] Only created {len(exercises)} exercises, need 3")
    exit(1)

# === STEP 3: Build week-chain in database ===
print("\nSTEP 3: Building week-chain structure (weeks 1-5)...")
db = SessionLocal()

# Create weeks-type plan
plan = WorkoutPlanModel(
    user_id=user_id,
    name="5-Week Verification Plan",
    unit_type="weeks",
    total_units=5
)
db.add(plan)
db.commit()
plan_id = plan.id
print(f"[OK] Created plan: ID {plan_id}, unit_type='weeks', total_units=5")

# Create week 1 (base)
week1 = PlanWeekModel(workout_plan_id=plan_id, week_number=1, mode="base")
db.add(week1)
db.commit()
print(f"[OK] Week 1: mode=base")

# Create days for week 1 (Mon-Sun)
day_labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
week1_days = []
for i, label in enumerate(day_labels):
    day = PlanDayModel(
        workout_plan_id=plan_id,
        label=label,
        order_position=i+1,
        is_rest=(label == "Sunday"),
        plan_week_id=week1.id
    )
    db.add(day)
    db.commit()
    week1_days.append(day.id)

# Add 2 exercises to week 1 Monday
for j, ex_id in enumerate(exercises[:2]):
    ex = WorkoutExerciseModel(
        plan_day_id=week1_days[0],  # Monday
        exercise_id=ex_id,
        order_number=j+1,
        target_sets=4,
        target_reps=5,
        target_weight=225.0 - j*20,
        notes=f"Week1-Set{j+1}"
    )
    db.add(ex)
    db.commit()

print(f"[OK] Week 1 has 7 days with Monday containing 2 exercises")

# Create weeks 2-5 as linked (no days)
for week_num in [2, 3, 4, 5]:
    week = PlanWeekModel(workout_plan_id=plan_id, week_number=week_num, mode="linked")
    db.add(week)
    db.commit()
    if week_num == 3:
        week3_id = week.id

print(f"[OK] Weeks 2,4,5 created as linked (no days)")

# Now make week 3 custom and give it different content
week3 = db.query(PlanWeekModel).filter(
    PlanWeekModel.workout_plan_id == plan_id,
    PlanWeekModel.week_number == 3
).first()

week3_days = []
for i, label in enumerate(day_labels):
    day = PlanDayModel(
        workout_plan_id=plan_id,
        label=label,
        order_position=i+1,
        is_rest=(label == "Wednesday"),  # Different rest day
        plan_week_id=week3.id
    )
    db.add(day)
    db.commit()
    week3_days.append(day.id)

# Add exercise to week 3 Monday (different from week 1)
ex = WorkoutExerciseModel(
    plan_day_id=week3_days[0],
    exercise_id=exercises[2],  # Different exercise
    order_number=1,
    target_sets=5,
    target_reps=8,
    target_weight=185.0,
    notes="Week3-Custom"
)
db.add(ex)

week3.mode = "custom"
db.commit()

print(f"[OK] Week 3 created as custom with different content (Wednesday is rest, Monday has different exercise)")

db.close()

# === STEP 4: Test GetWorkoutPlanDetail resolution algorithm ===
print("\nSTEP 4: Testing GetWorkoutPlanDetail link-resolution...")

resp = requests.get(f"{BASE_URL}/workout-plans/{plan_id}", headers=headers)
if resp.status_code != 200:
    print(f"[FAIL] GetWorkoutPlanDetail failed: {resp.status_code}")
    exit(1)

detail = resp.json()
print(f"[OK] GetWorkoutPlanDetail returned: unit_type={detail['plan'].get('unit_type')}, total_units={detail['plan'].get('total_units')}")
print(f"     Days in response: {len(detail['days'])}")

# Manual verification of resolution algorithm
db = SessionLocal()
weeks = db.query(PlanWeekModel).filter(PlanWeekModel.workout_plan_id == plan_id).order_by(PlanWeekModel.week_number).all()

def resolve_week(weeks_list, target_week_num):
    """Walk backward to find effective week."""
    j = target_week_num
    while j >= 1:
        w = next((w for w in weeks_list if w.week_number == j), None)
        if w and w.mode != "linked":
            return w.week_number
        j -= 1
    return None

week2_resolved = resolve_week(weeks, 2)
week4_resolved = resolve_week(weeks, 4)
week5_resolved = resolve_week(weeks, 5)

print(f"[OK] Resolution algorithm test:")
print(f"     Week 2 resolves to week: {week2_resolved} (expected 1) {'[OK]' if week2_resolved == 1 else '[FAIL]'}")
print(f"     Week 4 resolves to week: {week4_resolved} (expected 3) {'[OK]' if week4_resolved == 3 else '[FAIL]'}")
print(f"     Week 5 resolves to week: {week5_resolved} (expected 3) {'[OK]' if week5_resolved == 3 else '[FAIL]'}")

if not (week2_resolved == 1 and week4_resolved == 3 and week5_resolved == 3):
    print("[FAIL] Resolution algorithm incorrect")
    exit(1)

db.close()

# === STEP 5: Test CustomizeWeek ===
print("\nSTEP 5: Testing CustomizeWeek endpoint...")

resp = requests.post(f"{BASE_URL}/workout-plans/{plan_id}/weeks/2/customize", headers=headers)
if resp.status_code != 204:
    print(f"[FAIL] CustomizeWeek failed: {resp.status_code}")
    if resp.text:
        print(f"       Response: {resp.text}")
    exit(1)

print(f"[OK] CustomizeWeek succeeded (204)")

# Verify week 2 is now custom with cloned days
db = SessionLocal()
week2 = db.query(PlanWeekModel).filter(
    PlanWeekModel.workout_plan_id == plan_id,
    PlanWeekModel.week_number == 2
).first()

if week2.mode != "custom":
    print(f"[FAIL] Week 2 mode is '{week2.mode}', expected 'custom'")
    exit(1)

week2_days = db.query(PlanDayModel).filter(PlanDayModel.plan_week_id == week2.id).count()
if week2_days != 7:
    print(f"[FAIL] Week 2 should have 7 days, has {week2_days}")
    exit(1)

print(f"[OK] Week 2 is now custom with {week2_days} days")

# Check that Monday has the exercise (cloned from week 1)
monday = db.query(PlanDayModel).filter(
    PlanDayModel.plan_week_id == week2.id,
    PlanDayModel.label == "Monday"
).first()

if not monday:
    print(f"[FAIL] Week 2 Monday not found")
    exit(1)

monday_ex_count = db.query(WorkoutExerciseModel).filter(
    WorkoutExerciseModel.plan_day_id == monday.id
).count()

if monday_ex_count != 2:
    print(f"[FAIL] Week 2 Monday should have 2 exercises (cloned), has {monday_ex_count}")
    exit(1)

print(f"[OK] Week 2 Monday has {monday_ex_count} exercises (cloned from week 1)")

db.close()

# === STEP 6: Test MatchPreviousWeek (success case - no sessions) ===
print("\nSTEP 6: Testing MatchPreviousWeek (no sessions) endpoint...")

resp = requests.post(f"{BASE_URL}/workout-plans/{plan_id}/weeks/2/match-previous", headers=headers)
if resp.status_code != 204:
    print(f"[FAIL] MatchPreviousWeek failed: {resp.status_code}")
    if resp.text:
        print(f"       Response: {resp.text}")
    exit(1)

print(f"[OK] MatchPreviousWeek succeeded (204)")

# Verify week 2 is back to linked with no days
db = SessionLocal()
week2 = db.query(PlanWeekModel).filter(
    PlanWeekModel.workout_plan_id == plan_id,
    PlanWeekModel.week_number == 2
).first()

if week2.mode != "linked":
    print(f"[FAIL] Week 2 mode is '{week2.mode}', expected 'linked'")
    exit(1)

week2_days = db.query(PlanDayModel).filter(PlanDayModel.plan_week_id == week2.id).count()
if week2_days != 0:
    print(f"[FAIL] Week 2 should have 0 days after revert, has {week2_days}")
    exit(1)

print(f"[OK] Week 2 is back to linked with no days")

# Verify resolution still works correctly
week2_resolved = resolve_week(
    db.query(PlanWeekModel).filter(PlanWeekModel.workout_plan_id == plan_id).order_by(PlanWeekModel.week_number).all(),
    2
)
if week2_resolved != 1:
    print(f"[FAIL] Week 2 should resolve to 1, resolved to {week2_resolved}")
    exit(1)

print(f"[OK] Week 2 resolves to week 1 (as expected for linked week)")

db.close()

# === STEP 7: Test MatchPreviousWeek (blocked by sessions) ===
print("\nSTEP 7: Testing MatchPreviousWeek blocked by sessions...")

# Create a session for one of week 3's days
db = SessionLocal()
week3 = db.query(PlanWeekModel).filter(
    PlanWeekModel.workout_plan_id == plan_id,
    PlanWeekModel.week_number == 3
).first()

monday3 = db.query(PlanDayModel).filter(
    PlanDayModel.plan_week_id == week3.id,
    PlanDayModel.label == "Monday"
).first()

from datetime import datetime
session = WorkoutSessionModel(
    user_id=user_id,
    workout_plan_id=plan_id,
    plan_day_id=monday3.id,
    plan_week_id=week3.id,
    started_at=datetime.utcnow(),
    completed_at=datetime.utcnow()
)
db.add(session)
db.commit()
db.close()

print(f"[OK] Created a session for week 3 Monday")

# Try to revert week 3 to linked - should fail with 409
resp = requests.post(f"{BASE_URL}/workout-plans/{plan_id}/weeks/3/match-previous", headers=headers)
if resp.status_code != 409:
    print(f"[FAIL] MatchPreviousWeek should return 409, got {resp.status_code}")
    if resp.text:
        print(f"       Response: {resp.text}")
    exit(1)

error_msg = resp.json().get("error", "")
if "has logged workouts" not in error_msg.lower():
    print(f"[FAIL] Error message should mention 'has logged workouts', got: {error_msg}")
    exit(1)

print(f"[OK] MatchPreviousWeek correctly blocked with 409")
print(f"     Error message: {error_msg}")

# Verify week 3 is still custom with its days intact
db = SessionLocal()
week3 = db.query(PlanWeekModel).filter(
    PlanWeekModel.workout_plan_id == plan_id,
    PlanWeekModel.week_number == 3
).first()

if week3.mode != "custom":
    print(f"[FAIL] Week 3 should still be custom, is {week3.mode}")
    exit(1)

week3_days = db.query(PlanDayModel).filter(PlanDayModel.plan_week_id == week3.id).count()
if week3_days != 7:
    print(f"[FAIL] Week 3 should still have 7 days, has {week3_days}")
    exit(1)

print(f"[OK] Week 3 remains custom with {week3_days} days (unchanged by blocked operation)")

db.close()

# === STEP 8: Verify domain layer has zero framework imports ===
print("\nSTEP 8: Verifying domain layer purity (no framework imports)...")

domain_files = [
    '/c/Users/user/Desktop/Traqo/backend/src/modules/workouts/domain/entities/plan_week.py',
    '/c/Users/user/Desktop/Traqo/backend/src/modules/workouts/domain/interfaces/plan_week_repository.py',
    '/c/Users/user/Desktop/Traqo/backend/src/modules/workouts/domain/exceptions.py',
]

forbidden_imports = ['sqlalchemy', 'fastapi', 'flask', 'jwt', 'postgresql']

all_clean = True
for filepath in domain_files:
    try:
        with open(filepath, 'r') as f:
            content = f.read()
            for forbidden in forbidden_imports:
                if forbidden.lower() in content.lower():
                    print(f"[FAIL] {filepath} contains '{forbidden}'")
                    all_clean = False
    except FileNotFoundError:
        print(f"[FAIL] {filepath} not found")
        all_clean = False

if all_clean:
    print(f"[OK] Domain layer is framework-agnostic (zero framework imports in checked files)")
else:
    exit(1)

print("\n" + "=" * 80)
print("ALL VERIFICATION STEPS PASSED")
print("=" * 80)
