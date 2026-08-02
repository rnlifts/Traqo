# Task 78 — Remove the exercise-name preview from the History list (keep it in Session Detail)

## Objective
Task 77 added two things: (A) show logged exercises/sets in the Session Detail page even when the plan is deleted, and (B) a per-row exercise-name preview in the Workout History list. Part A is confirmed correct and should stay exactly as-is. Part B should be removed — with many exercises in a session, the comma-separated list (even truncated at "+N more") makes the compact list view feel cluttered. Exercise detail belongs on the "View Details" page, not the summary row.

This is a straightforward revert of Task 77's Part B only — both the frontend display and the backend work that fetches it (no reason to pay the extra per-session query cost for data nothing displays anymore).

## Required changes

### Frontend
- `frontend/src/features/sessions/WorkoutHistory.tsx` — remove the "Exercises" field-group block added in Task 77 (the one rendering `entry.exercises.length > 0 && (...)` with the comma-joined / "+N more" truncation logic). Restore the row to just Date / Workout / Duration / View Details, exactly as it was before Task 77.
- `frontend/src/api/workoutSessionsApi.ts` — remove `exercises: string[]` from the `WorkoutHistoryEntry` interface.

### Backend
- `backend/src/modules/sessions/application/use_cases/get_workout_history.py` — remove the `exercises` field from `WorkoutHistoryEntry`, remove the `set_repository`/`exercise_repository` dependencies and the exercise-name-collection loop added in Task 77. Restore `GetWorkoutHistory` to only depend on `session_repository` and `plan_repository`, exactly as before Task 77.
- `backend/src/modules/sessions/presentation/schemas.py` — remove `exercises: list[str]` from `WorkoutHistoryEntryResponse`.
- `backend/src/modules/sessions/presentation/routes.py` — revert `get_workout_history_handler`'s DI wiring: stop constructing `WorkoutSetRepositoryImpl`/`ExerciseRepositoryImpl` there, stop passing `exercises=entry.exercises` into the response construction, go back to the two-repository `GetWorkoutHistory(session_repo, plan_repo)` call from before Task 77.

## Do NOT
- Do not touch anything from Task 77's Part A (`SessionDetail.tsx`'s fallback rendering for deleted plans, grouping sets by `exercise_name`) — that stays exactly as shipped and verified. This task is scoped only to the History list.
- Do not remove or change `list_by_session` on `WorkoutSetRepository`, or anything in `GetWorkoutSessionDetail` / `GetExerciseProgress` — those are unrelated use cases that happen to use similar patterns; this task only touches `GetWorkoutHistory`.

## Acceptance criteria
- [ ] Workout History list shows Date / Workout / Duration / View Details only — no Exercises column, matching the pre-Task-77 layout exactly.
- [ ] Session Detail page (via "View Details") still correctly shows exercises and logged sets, including for sessions whose plan has been deleted — unchanged from Task 77's verified behavior.
- [ ] `GET /api/workout-history` no longer triggers per-session set/exercise lookups — confirm via a quick check that `GetWorkoutHistory` only calls into `session_repository`/`plan_repository`, not `set_repository`/`exercise_repository`.
- [ ] Full frontend test suite passes; `npx tsc -b` clean. Backend test suite passes.

## Review checklist
- [ ] Confirm Session Detail's exercise display (Task 77 Part A) is untouched by diffing only the files this task lists — if `SessionDetail.tsx` shows up in the diff at all, that's a scope violation.
- [ ] Live-verify both: History list is back to its plain 4-field layout, and a deleted-plan session's detail page still correctly shows its exercises.
