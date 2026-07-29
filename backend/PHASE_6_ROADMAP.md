# Phase 6: Sessions Unit Tests — Implementation Roadmap

**Status:** Ready for implementation (Phases 1-5 complete with 100 tests passing)

## Current Progress
- ✅ Phases 1-5: 100 unit tests passing
- ✅ Core infrastructure: in-memory repository doubles for all major entities
- ⏳ Phase 6: Sessions unit tests (12 use cases)
- ⏳ Phase 7: Route-level integration tests
- ⏳ Phase 8: Cascade delete verification
- ⏳ Phase 9: Historical bug reproduction + verification

## Phase 6 Use Cases to Test

### Session Creation & Lifecycle
1. **StartWorkout** (`start_workout.py`)
   - Happy path: creates session from plan, links to day/week
   - UnresolvedSessionExistsError blocks second session start
   - Previous performance lookup (most recent finished for day)

2. **QuickStartWorkout** (`quick_start_workout.py`)
   - Happy path: creates session without plan
   - Allows inline exercise config
   - Inline field-presence config (has_reps, has_weight, has_duration)

### Set Management
3. **AddWorkoutSet** (`add_workout_set.py`)
   - Happy path: creates set, next_set_number computed
   - Upsert logic: overwrites if (session, exercise, set_number) exists
   - Field validation: permissive (one of weight/reps/duration non-null)

4. **DeleteWorkoutSet** (`delete_workout_set.py`)
   - Removes set by id
   - Resets set_numbers for remaining sets in exercise

### Session Completion
5. **FinishWorkout** (`finish_workout.py`)
   - Sets completed_at timestamp
   - Clears unresolved session status

6. **DiscardWorkoutSession** (`discard_workout_session.py`)
   - Deletes session and all sets
   - Clears unresolved status

### Session Queries
7. **GetUnresolvedSession** (`get_unresolved_session.py`)
   - Finds most recent unresolved session for user
   - Returns None if no unresolved session

8. **GetWorkoutSessionDetail** (`get_workout_session_detail.py`)
   - Returns session with all sets grouped by exercise
   - Includes previous performance data

9. **GetWorkoutHistory** (`get_workout_history.py`)
   - Lists finished sessions sorted by started_at (descending)
   - Includes set data
   - Supports pagination (limit/offset)

10. **GetExerciseProgress** (`get_exercise_progress.py`)
    - Returns all sets for exercise across finished sessions
    - 1RM estimation via Epley formula: `1RM = weight × (1 + reps/30)`
    - PR (personal record) detection: max weight per rep count
    - Volume trends: total weight per session

### Exception Handling
11. **GetPreviousPerformance** (`get_previous_performance.py`)
    - Returns previous set data for prefill
    - UnresolvedSessionExistsError guard

12. **Cross-cutting Concerns**
    - UnresolvedSessionExistsError: only one active session per user
    - WorkoutSessionNotFoundError: operations on missing sessions
    - InvalidSetDataError: validation failures

## Test Structure (Estimated 45-60 tests)

### Session Creation Tests (8-10 tests)
```python
class TestStartWorkout:
    - test_start_workout_creates_session_from_plan()
    - test_start_workout_prefills_previous_performance()
    - test_start_workout_unresolved_session_exists_raises_error()
    - test_start_workout_blocks_concurrent_sessions()

class TestQuickStartWorkout:
    - test_quick_start_creates_planless_session()
    - test_quick_start_allows_inline_exercise_config()
    - test_quick_start_unresolved_session_blocks()
```

### Set Management Tests (8-10 tests)
```python
class TestAddWorkoutSet:
    - test_add_set_increments_set_number()
    - test_add_set_upsert_logic()
    - test_add_set_field_validation_permissive()
    - test_add_set_requires_one_field()

class TestDeleteWorkoutSet:
    - test_delete_set_removes_by_id()
    - test_delete_set_reorders_remaining()
```

### Session Completion Tests (6-8 tests)
```python
class TestFinishWorkout:
    - test_finish_marks_completed_at()
    - test_finish_clears_unresolved()

class TestDiscardWorkoutSession:
    - test_discard_deletes_session_and_sets()
    - test_discard_clears_unresolved()
```

### Query Tests (10-12 tests)
```python
class TestGetUnresolvedSession:
    - test_get_unresolved_finds_most_recent()
    - test_get_unresolved_returns_none_if_none_exist()

class TestGetExerciseProgress:
    - test_get_progress_returns_all_sets_for_exercise()
    - test_get_progress_estimates_1rm_via_epley()
    - test_get_progress_detects_pr_per_rep_count()
    - test_get_progress_volume_trends()
    - test_get_progress_only_finished_sessions()
```

## Utilities Needed

### Epley 1RM Formula
```python
def calculate_1rm(weight: float, reps: int) -> float:
    """Epley formula: 1RM = weight × (1 + reps/30)"""
    return weight * (1 + reps / 30)
```

### Test Fixtures to Add to conftest.py
- `in_memory_session_repo` (already exists)
- `in_memory_set_repo` (already exists)
- Helper: `create_finished_session()` factory for history tests
- Helper: `create_unresolved_session()` factory
- Timestamp utility for testing

## Key Testing Patterns

### UnresolvedSessionExistsError Guard
```python
def test_unresolved_session_blocks_new_start():
    """Verify only one active session per user."""
    start_use_case = StartWorkout(...)
    
    # First session succeeds
    session1 = start_use_case.execute(user_id, plan_id)
    
    # Second session blocks
    with pytest.raises(UnresolvedSessionExistsError):
        start_use_case.execute(user_id, plan_id2)
```

### Epley Formula Verification
```python
def test_1rm_estimation():
    """Verify Epley formula for estimated 1RM."""
    progress = GetExerciseProgress(...).execute(exercise_id)
    
    # For a 185lb set of 10 reps: 1RM = 185 × (1 + 10/30) = 247.5
    assert progress.estimated_1rm == pytest.approx(247.5, rel=0.01)
```

### Set Upsert Behavior
```python
def test_add_set_upsert():
    """Adding same (session, exercise, set_num) overwrites."""
    add_set = AddWorkoutSet(...)
    
    set1 = add_set.execute(session_id, ex_id, 1, weight=185, reps=10)
    set2 = add_set.execute(session_id, ex_id, 1, weight=190, reps=12)
    
    # set2 overwrites set1
    assert set2.weight == 190
    assert repo.count_by_session(session_id) == 1
```

## Implementation Notes

1. **Epley Formula**: Implement in `src/utils/epley.py` or inline in use case
2. **PR Detection**: Track max weight per unique rep count from session history
3. **Volume Trends**: Sum weight × reps × sets per session over time
4. **Pagination**: Use offset/limit on GetWorkoutHistory
5. **Timestamp Handling**: Use `datetime.utcnow()` for consistency with codebase

## Dependencies

Phase 6 unit tests rely on:
- ✅ InMemoryWorkoutSessionRepository (conftest.py)
- ✅ InMemoryWorkoutSetRepository (conftest.py)
- ✅ Session entity model
- ✅ WorkoutSet entity model
- Actual use case implementations (already exist)

## Estimated Token Cost

- Test file: ~40-50KB (1500-2000 lines)
- Execution: Should complete with reasonable token budget

## Next Steps

1. Implement Phase 6 unit tests (~45-60 tests across 12 use cases)
2. Implement Phase 7 route integration tests (3 files: auth, sessions, exercise_library routes)
3. Run Phase 9 verification (temporarily revert cascade migrations to confirm tests fail, then restore)
4. Full suite should reach 150-180 unit tests + 20-30 integration tests

## Success Criteria

- ✅ All Phase 6 tests pass
- ✅ Coverage includes happy paths, edge cases, and error conditions
- ✅ Epley formula tests verify 1RM estimation accuracy
- ✅ Unresolved session guard prevents concurrent sessions
- ✅ Set upsert logic works correctly
- ✅ PR and volume tracking tested
