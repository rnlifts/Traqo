# Traqo Sprint Plan (MVP)

Role: this document is the Product/Engineering plan for building Traqo. It sequences work into vertical slices (DB → API → UI) per feature module, following the clean-architecture + modular-monolith structure defined in `CLAUDE.md`.

Each module (`auth`, `exercises`, `workouts`, `sessions`) is built through all four backend layers — `domain → application → infrastructure → presentation` — before its frontend is wired up. Modules are sequenced by dependency: auth must exist before anything can be owned by a user; exercises must exist before they can be attached to a workout plan; plans must exist before sessions can reference them.

Priority key: **P0** = blocks everything after it, must ship this sprint. **P1** = core MVP scope, expected this sprint. **P2** = nice-to-have, defer if time runs short.

---

## Sprint 0 — Project Foundations

**Goal:** a running, empty skeleton on both ends that the rest of the plan builds on. No business logic yet.

**Status: in progress.** Already done: Flask app factory (`app.py`), per-environment config (`config/base.py`, `development.py`, `production.py`, `testing.py`), `db`/`jwt` extensions initialized. Not done: everything below.

**Backend (P0):**
- Add `flask-bcrypt` and `flask-cors` to `extensions.py`, wire into `create_app`
- Add `Flask-Migrate` to `requirements.txt` and initialize migrations (replace ad-hoc `db.create_all()` with real migration history from day one — this matters once more than one person or environment touches the DB)
- Create the `modules/` package with empty `auth/`, `exercises/`, `workouts/`, `sessions/` folders, each pre-stubbed with `domain/`, `application/`, `infrastructure/`, `presentation/`
- Global error handler (consistent `{ "error": "..." }` JSON shape per `api.md` §9) and a health-check route

**Frontend (P0):**
- Scaffold Vite + React + TypeScript in `frontend/`
- React Router set up with a placeholder home route
- `api/` folder with a configured axios instance (base URL from env, JSON headers)
- `.env` / `.env.example` for `VITE_API_BASE_URL`

**Definition of done:** `flask run` serves a health-check JSON response; `npm run dev` serves a blank React page that successfully calls the health-check endpoint and renders the result. Postgres running locally, first (empty) migration applied.

---

## Sprint 1 — Auth Module (vertical slice)

**Goal:** a person can register and log in, end-to-end, through the real UI. This is the first full proof of the clean-architecture pattern and the template every later module copies.

**Backend (P0), inside `modules/auth/`:**
- `domain/entities/user.py` — plain `User` entity (no SQLAlchemy): id, username, display_name, password_hash, created_at
- `domain/interfaces/user_repository.py` — abstract repository interface (`get_by_username`, `save`, `exists_by_username`)
- `domain/services/username_generator.py` — pure business rule for turning "Aryan" into a unique `aryan_8392`-style username (no DB access; takes uniqueness-check as an injected dependency so it stays framework-free)
- `application/use_cases/register_user.py` — orchestrates: generate username → hash password → persist → return result
- `application/use_cases/login_user.py` — orchestrates: look up user → verify password → issue JWT
- `infrastructure/models/user_model.py` — the real SQLAlchemy model
- `infrastructure/repositories/user_repository_impl.py` — implements the domain interface against SQLAlchemy
- `presentation/routes.py` — `POST /api/auth/register`, `POST /api/auth/login` blueprint; only does request parsing/validation and calls the use cases
- `presentation/schemas.py` — request/response validation (reject empty display name, enforce password length, etc.)

**Frontend (P0):**
- Register page (display name + password form)
- Login page (username + password form)
- Auth context/hook holding the JWT (persisted to `localStorage`), exposing `login`, `logout`, `currentUser`
- Protected-route wrapper for everything built in later sprints
- Basic client-side validation + surfaced API error messages

**Priority notes:** this is the highest-risk sprint because it's the first time the full layer stack gets exercised — expect it to take longer than later modules that just repeat the pattern. Don't parallelize past this sprint until the pattern is validated.

**Definition of done:** a new user can register in the browser, get redirected to login, log in, and land on a protected placeholder page with their JWT stored and attached to subsequent requests.

---

## Sprint 2 — Exercises Module

**Goal:** a logged-in user can create, view, and delete their own exercises. Simplest possible module — good second rep of the clean-architecture pattern with no cross-module dependencies except auth (ownership).

**Backend (P1), inside `modules/exercises/`:**
- `domain/entities/exercise.py`, `domain/interfaces/exercise_repository.py`
- `application/use_cases/create_exercise.py`, `list_exercises.py`, `delete_exercise.py`
- `infrastructure/models/exercise_model.py`, `infrastructure/repositories/exercise_repository_impl.py`
- `presentation/routes.py` — `POST/GET/DELETE /api/exercises`, JWT-protected, scoped to `current_user`

**Frontend (P1):**
- Exercise list page, create-exercise form (modal or inline), delete action
- Empty state ("no exercises yet")

**Definition of done:** logged-in user creates a few exercises, sees them listed, deletes one, and cannot see another user's exercises (verify ownership scoping explicitly — write a quick manual test for this).

---

## Sprint 3 — Workout Plans Module + Plan↔Exercise linking

**Goal:** a user can build a named workout plan and attach their exercises to it in order.

**Backend (P1), inside `modules/workouts/`:**
- `domain/entities/workout_plan.py`, `workout_exercise.py`; `domain/interfaces/workout_plan_repository.py`
- `application/use_cases/create_workout_plan.py`, `list_workout_plans.py`, `update_workout_plan.py`, `delete_workout_plan.py`, `add_exercise_to_plan.py`, `reorder_plan_exercises.py`
- `infrastructure/models/workout_plan_model.py`, `workout_exercise_model.py`; repository impl
- `presentation/routes.py` — endpoints per `api.md` §4 and §6 (this module depends on `exercises` module's repository interface for validating `exercise_id` exists and is owned by the user)

**Frontend (P1):**
- Plan list page, create/edit/delete plan
- Plan detail page: add exercises from the user's exercise list, remove, reorder (P2 if drag-and-drop proves time-consuming — plain up/down buttons are an acceptable P1 fallback)

**Definition of done:** user creates "Push Day," adds 3 exercises in order, edits the plan name, and the order persists correctly on reload.

---

## Sprint 4 — Workout Sessions & Sets Module

**Goal:** a user can actually run a workout from a plan and log real performance data. This is the module the whole app exists for — treat it as the priority module once auth/exercises/plans are stable.

**Backend (P0 within this sprint), inside `modules/sessions/`:**
- `domain/entities/workout_session.py`, `workout_set.py`; `domain/interfaces/workout_session_repository.py`
- `domain/rules` — invariants like "cannot add a set to a finished session," "cannot finish an already-finished session" (this is exactly the kind of rule that belongs in `domain/`, not scattered in a route)
- `application/use_cases/start_workout.py`, `add_set.py`, `finish_workout.py`
- `infrastructure/models/*`, repository impl
- `presentation/routes.py` — per `api.md` §7

**Frontend (P0 within this sprint):**
- "Start workout" action from a plan detail page
- Active-workout screen: per-exercise set logging (weight, reps, notes), running list of logged sets
- "Finish workout" action

**Definition of done:** user starts a workout from "Push Day," logs multiple sets across multiple exercises, finishes the session, and the session is marked complete with an accurate timestamp.

---

## Sprint 5 — Workout History

**Goal:** a user can look back at what they've done.

**Backend (P1):**
- `application/use_cases/get_workout_history.py` in `modules/sessions/` (read-side, aggregates session + plan name + duration per `api.md` §8)
- `presentation/routes.py` — `GET /api/workout-history`

**Frontend (P1):**
- History list (date, plan name, duration)
- History detail view (sets logged in that session) — P2 if time-constrained, list view alone satisfies MVP scope

**Definition of done:** completed sessions from Sprint 4 show up correctly ordered by date with accurate duration.

---

## Sprint 6 — Hardening & Polish

**Goal:** MVP is demoable and safe to hand to a real user, not just functionally correct in the happy path.

**P1:**
- Consistent error handling across all modules (confirm every route follows `api.md` §9's error shape)
- Loading and empty states on every list view
- Input validation audit (both client and server side — server side is the actual boundary, client side is UX only)
- `architecture.md` and `requirements.md` written up to reflect what was actually built (keep docs truthful, not aspirational)

**P2:**
- Basic responsive/mobile layout pass
- Styling pass beyond functional/unstyled

**Definition of done:** a stranger can register, build a plan, run a workout, and view history without hitting an unhandled error or confusing blank screen.

---

## Sequencing summary

```
Sprint 0 (foundations)
   └─ Sprint 1 (auth)                    ← everything below requires this
        └─ Sprint 2 (exercises)
             └─ Sprint 3 (workout plans)  ← requires exercises
                  └─ Sprint 4 (sessions/sets)  ← requires plans   [core value — highest priority once unblocked]
                       └─ Sprint 5 (history)   ← requires sessions
                            └─ Sprint 6 (polish)
```

Modules `auth → exercises → workouts → sessions` are strictly sequential because each depends on the previous one's domain existing. Within a sprint, backend layers are built inside-out (`domain → application → infrastructure → presentation`) per `CLAUDE.md`'s dependency-inversion rule, and frontend work for that module starts only once its API is functional — this keeps every sprint boundary a genuine, demoable vertical slice rather than a half-finished layer.

**Explicitly excluded from all sprints above** (per `CLAUDE.md` scope): notifications, social features, trainer portal, analytics, AI features. If any of these come up mid-build, treat it as a scope-expansion decision to raise, not something to quietly fold in.

---

# Part 2: UX/Feature Expansion (Sprints 7+)

The MVP (Sprints 0–6) was completed and verified 2026-07-19. A dedicated UX/UI review followed — see `docs/ux-improvement-plan.md` for the full research, grounded in the actual codebase plus competitor research (Hevy, Strong, StrongLifts, Fitbod). The owner reviewed its findings and explicitly approved expanding scope to include progress-tracking/analytics and schema changes to Workout Plans, reversing two items that were previously out of scope — see the 2026-07-19 revisions in `CLAUDE.md` and `docs/requirements.md` §4.

This section sequences that report's recommendations into sprints. Same rigor as Part 1: each sprint is a full vertical slice, reviewed and independently live-verified before moving to the next.

## Sprint 7 — Bug Fix + Visual/UX Polish (no schema changes)

Everything here uses data the app already has and doesn't touch the database. Two independent pieces of work:

**Bug fix (do first, unrelated to the rest):**
- Fix the exercise-delete 500 (`docs/ux-improvement-plan.md` Item E): `DeleteExercise` doesn't check whether the exercise is referenced by any `workout_exercises` row before deleting, so deleting an in-use exercise throws an unhandled `IntegrityError`. Mirror the exact pattern already used in `DeleteWorkoutPlan`/`WorkoutPlanHasSessionsError`: new `ExerciseInUseError` domain exception → 409 via the centralized handler in `app.py`.

**Polish (Section 2 of the UX report, items 1–2, 4–7):**
- Give the Dashboard real content (recent activity + "Start a Workout" CTA) instead of two lines of placeholder text.
- Adopt the existing `index.css`/`App.css` design tokens and shared classes (`.btn-primary`, `.card`, `.input-field`, `.error-message`, `.empty-state`, `.loading`) across every component that's currently hand-rolling inline styles — this is most of the frontend. Delete dead leftover Vite-scaffold CSS while in there.
- Rework `Layout.tsx`'s navbar to use the actual design tokens instead of a hardcoded `#333`, and add an active-route indicator.
- Replace `window.confirm()` everywhere with one reusable in-app `<ConfirmDialog>` component.
- Add `aria-label`s to the icon-only reorder buttons.
- Add lightweight success feedback (toast/snackbar) for rename/add/log actions.
- Responsive nav for narrow viewports.

Item 3 (checklist-style set logging) is **not** in this sprint — it depends on Sprint 8's target-sets schema to be genuinely useful, not just restructured. Doing it twice would be wasted work.

## Sprint 8 — Target Sets/Reps/Weight on Plan Exercises

`docs/ux-improvement-plan.md` Item B — the most load-bearing schema addition in the report; blocks real checklist-style logging and most of what follows.

- Add `target_sets`, `target_reps`, `target_weight` (nullable) to `workout_exercises`.
- Update `WorkoutExercise` domain entity, `AddExerciseToPlan`/`UpdateWorkoutPlan`-adjacent use cases, migration.
- Frontend: capture targets when adding an exercise to a plan; restructure `ActiveWorkout.tsx` into one card per plan exercise showing its target, with logging inline per card (this is where Section 2 item 3 actually belongs).

## Sprint 9 — Day-of-Week Scheduling

`docs/ux-improvement-plan.md` Item A.

- Add day-of-week association to `workout_plans` (single field vs. join table — decide based on whether a plan should ever repeat on multiple days; the report suggests a join table if so).
- Frontend: day-picker (7 toggle chips) on plan create/edit; a "Today's workout" card on the Dashboard once this exists.

## Sprint 10 — Previous-Performance Prefill

`docs/ux-improvement-plan.md` Item C. No schema change — a new read-side use case joining `workout_sets` → `workout_sessions` for the most recent finished session per exercise. Prefill the logging form with "last time: 135 × 8" placeholders.

## Sprint 11 — Rest Timer + Consistency Calendar

`docs/ux-improvement-plan.md` Items F and G. Both frontend-only, no backend dependency, can be built in either order or in parallel with other sprints if desired.

## Sprint 12 — Progress Views (charts, volume, estimated 1RM, PRs)

`docs/ux-improvement-plan.md` Item D — the largest single item, deliberately last since it depends on nothing being blocked and B/C existing makes the data more meaningful. New `GetExerciseProgress(user_id, exercise_id)` use case (best set, volume, estimated 1RM via Epley formula, per session date), PR detection, a frontend chart component (report suggests Recharts — lightweight, no backend dependency question).

## Updated sequencing

```
Sprint 7 (bug fix + polish, no schema changes)
   └─ Sprint 8 (target sets/reps)  ← foundational, unlocks real logging UX
        ├─ Sprint 9 (day-of-week scheduling)
        ├─ Sprint 10 (previous-performance prefill)
        └─ Sprint 12 (progress views)  ← do last, most complex, most value once 8+10 exist
Sprint 11 (rest timer + calendar) — independent, can slot in anywhere after Sprint 7
```

**Status note (2026-07-20):** Sprints 8–12's underlying functionality was built (see `dev-log.md`, "Plan Builder v2" and "Sprint 12: Progress Views" entries — day/week-based plans, target sets/reps, pip-based active-workout logging with rest timer, and the progress/PR views are all implemented and verified). What follows is a separate, purely visual reskin pass across the whole app — see Part 3.

---

# Part 3: UI Reskin (Sprint 13)

The owner provided a full design system spec (`docs/design-system.md` — read that file first, it's the authoritative palette/typography/component reference and documents a couple of deliberate deviations from the literal spec that shouldn't be "fixed" back). This is a **visual-only pass**: swap inline styles and ad-hoc colors for the shared tokens/classes already built in `frontend/src/index.css` and `frontend/src/App.css`. Do not change any business logic, API calls, or state management on any page — if a page's behavior seems off, that's a separate bug report, not something to fix silently while reskinning.

## Already done (verified live, don't redo)
Design token foundation, sidebar (`Layout.tsx`), Dashboard, Create Plan (Step 1), Workout Plans (list), Workout History, Plan Builder (week rail / day tabs / info card — the exercise input grid within Plan Builder still needs the final Table-row polish, see below).

## Sprint 13 — Remaining pages

Work through these in order, verify each live (render + no console errors + core interaction still works) before moving to the next — same discipline as every prior sprint. Read `docs/design-system.md` before starting any of these; don't invent new colors, radii, or spacing values.

Each item below has a **Use case** (what the user is actually doing on this screen — read this first, the reskin has to preserve this exactly) and **Reskin task** (what to actually change).

### 1. Plan Builder exercise grid (`PlanBuilder.tsx`)

**Use case:** the user is inside a specific day of a plan (e.g. "Week 2 · Wed") building out what exercises belong there. For each exercise they set a *target* — planned sets/reps/weight, plus optional notes — which is what later pre-fills the logging screen during an actual workout (see Active Workout below). This is planning data, not performance data — no actual weight was lifted yet.

**Reskin task:** the Name/Sets/Reps/Weight/Notes rows still use ad-hoc inline sizing. Apply the Table row spec (white bg, `--border`, 16px radius, `--bg-secondary` hover) using the existing `.exercise-head`/`.exercise-row` classes (update those classes' CSS if needed to match, rather than hand-rolling more inline styles).

### 2. Session Setup (`SessionSetupPage.tsx`)

**Use case:** the user has a multi-day or multi-week plan and is about to start a real workout — this screen is "which part of the plan am I doing today?" They pick a week (if the plan has weeks) then a day. If the resolved day is a rest day, or has zero exercises, the screen must block starting with a clear message (this validation is existing, working logic — don't touch it, just restyle it).

**Reskin task:** week/day picker chips, use `.setup-chip`/`.setup-chip-row` (update their CSS to match the spec's chip treatment if not already aligned).

### 3. Active Workout (`ActiveWorkout.tsx`) — the most interaction-heavy screen, read carefully

**Use case:** the user is mid-workout, live-logging sets against the plan they started. The core interaction is a **pip** (small circular indicator) per planned set per exercise:
- An **empty pip** = not logged yet. Tapping it opens a weight/reps/notes entry panel, **pre-filled from the exercise's target** (the values set in Plan Builder).
- Submitting the panel **logs the set and flips the pip to "done"** (filled/checked), and **automatically starts a rest timer** (30/60/90/120s, user-selectable, with a live countdown, a "+15s" button, and a "Skip" button).
- Tapping an **already-done pip** reopens the same panel, but this time **pre-filled with the actual saved values** (not the target) — this is edit-in-place; saving updates the set, and there's a delete option too.
- A **"+" pip** at the end of an exercise's row lets the user log an *extra* set beyond what was planned — pre-filled from the most recently logged set for that exercise (not the original target).
- Attempting to leave mid-workout shows an inline (non-native — this was deliberately built to avoid `window.confirm()`) exit-confirm banner.
- "Finish Workout" goes through a `ConfirmDialog` and lands on the Session Summary screen (see below).

**Reskin task:** set-logging pips, rest timer widget, exit-confirm banner. Use `.pip`/`.pip-row`, `.rest-widget`, `.exit-confirm` classes (update CSS to match spec tokens). **Do not simplify the pip/panel interaction model down to a plain form while restyling** — the pre-fill-from-target vs. pre-fill-from-actual-value distinction, and the auto-starting rest timer, are the entire point of this screen and easy to accidentally flatten while just "cleaning up the UI."

### 4. Session Summary

**Use case:** shown immediately after finishing a workout — a quick confirmation screen (checkmark, "Workout complete") with two stat counts: exercises completed / total, and sets completed / total. Not a data-entry screen, purely a summary.

**Reskin task:** the post-workout completion screen (wherever it currently renders — check `ActiveWorkout.tsx`/`ActiveWorkoutPage.tsx` for where this lives). Use `.summary-wrap`/`.summary-stats` classes.

### 5. Exercises (`ExerciseList.tsx`, `CreateExerciseForm.tsx`, `ExercisesPage.tsx`)

**Use case:** simple personal CRUD — create/list/delete exercises the user owns, which then become available to add into any plan. Deleting an exercise that's currently used in a plan is blocked with a clear error (existing backend guard from Sprint 7 — don't touch, just make sure the error still displays correctly after restyling).

**Reskin task:** card/button/input styling per spec, consistent with the Plans list page already done.

### 6. Session Detail (`SessionDetail.tsx`/`SessionDetailPage.tsx`) — untouched, full reskin needed

**Use case:** read-only drill-down, reached by clicking "View Details" on a row in Workout History. Shows exactly what happened in that one session: which exercises, which sets (weight/reps/notes), plus plan name/day/week context and total duration. If the session is somehow still in-progress (not finished), it shows a banner and a "Continue Workout" link instead of static history data — this is a real, existing state, not an edge case to skip.

**Reskin task:** not touched at all yet. Full reskin using `.page-container`/`.card`/`.field-group` patterns already established on the History list page.

### 7. Exercise Progress (`ExerciseProgress.tsx`/`ExerciseProgressPage.tsx`, `TrendChart.tsx`)

**Use case:** reached from an exercise's "View Progress" link. Shows four **independently-tracked** personal-record stat tiles — heaviest weight, best estimated 1-rep-max (Epley formula), best session volume, most reps in a single set — each with the date it was achieved. A metric-selector switches a chart between plotting Est. 1RM / Volume / Best Weight over time. Below that, a reverse-chronological list of every session this exercise was logged in, with inline badges marking which sessions set a new PR. **Important existing rule: a user's first-ever logged set for an exercise is never itself flagged as a PR**, even though it technically becomes their current record — don't "fix" this while restyling, it's intentional (avoids a slightly absurd "PR!" badge on literally the first data point).

**Reskin task:** PR stat tiles need the spec's card/badge treatment; `TrendChart`'s line/axis colors need to pull from the token palette (`--accent` for the line, `--border`/`--ink-faint` for gridlines/axis labels) instead of any hardcoded colors it currently has.

---

# Part 4: Duplicate-Exercise Key Collision (Sprint 14)

**Use case:** A user creates a plan day with the same exercise appearing twice — e.g. "Bench Press" as a warm-up entry and again as a working-set entry, or the same exercise repeated across two different days in the same plan. Today, several code paths identify a logged set by `exercise_id` alone instead of the specific plan-exercise instance it belongs to (the `workout_exercises.id` row, aka `workout_exercise_id`). This was flagged by `reviewer` back in Sprint 8 as a real (if narrow) design gap, deliberately deferred rather than folded into that sprint, and has been sitting in the backlog since. Confirmed root cause (via codebase scan, 2026-07-21): **the `workout_sets` table has no `workout_exercise_id` column at all** — only `exercise_id` — so nothing downstream can distinguish two instances of the same exercise even in principle.

**Symptom if unfixed:** logging a set against the second occurrence of a repeated exercise can silently overwrite or read the wrong instance's sets, previous-performance prefill, or displayed history — a correctness bug, not cosmetic, and it gets more entrenched the longer other features (progress views, UI reskin) build on top of the same `exercise_id`-keyed data.

## Task 1 — Schema migration (backend, do first)

- Add `workout_exercise_id` (nullable initially, FK → `workout_exercises.id`) to `workout_sets` (`backend/src/modules/sessions/infrastructure/models/workout_set_model.py`).
- Decide and document a backfill strategy for existing rows: existing `workout_sets` only have `exercise_id` + `workout_session_id`, with no direct way to know which plan-day instance they were logged against if the plan had duplicates at logging time. For rows where the session's plan day had only one instance of that exercise, backfill is unambiguous (join session → plan day → workout_exercises). For rows where it was genuinely ambiguous (duplicate existed at the time), document them as unrecoverable and leave `workout_exercise_id` null — do not guess.
- Route through `db-migration-checker` before this touches real data.

## Task 2 — Backend: thread `workout_exercise_id` through the write/read paths

Files identified (from the 2026-07-21 scan):
- `add_workout_set.py` (~line 91-93) and `workout_set_repository_impl.py` (`get_by_session_exercise_and_set_number` ~line 35-52, `count_by_session_and_exercise` ~line 75-81) — currently key upserts on `(session_id, exercise_id, set_number)`; change to key on `(session_id, workout_exercise_id, set_number)`.
- `get_workout_session_detail.py` (~line 95-108) — `SetDetail` response should carry `workout_exercise_id` so the frontend can disambiguate.
- `get_previous_performance.py` (~line 46-53) — `sets_by_exercise` dict currently groups by `exercise_id`; regroup by `workout_exercise_id` so "last time" prefill reflects the correct plan-instance, not a merge of all instances.
- `get_exercise_progress.py` (~line 100-172) — **decide and document intended semantics explicitly** before touching: should PRs/volume/progress stay global across all plan placements of an exercise ever logged (current behavior), or become per-instance? This is a product decision, not just a bug fix — my read is global PR tracking is almost certainly the right behavior (a PR is a PR regardless of which plan it was set in), so this file likely needs no change, just an explicit sign-off that it's intentional so a future pass doesn't "fix" it by mistake.

## Task 3 — Frontend: key on `workout_exercise_id`, not `exercise_id`

- `ActiveWorkout.tsx`: `getExerciseSets`, `openSetPanel`, the target lookup (`planExercises.find(...)`), the React list `key={we.exercise_id}` (~line 701), and all set-panel open/close + input `id`s (~lines 757, 786, 808, 833-852) — all need to switch from `exercise_id` to `we.id` (the `workout_exercise` row id).
- `SessionDetail.tsx` (~line 97) — the `.filter((s) => s.exercise_id === exercise.exercise_id)` matching logged sets to a plan-day exercise needs to filter on `workout_exercise_id` instead, once the backend response carries it (Task 2).
- `PlanBuilder.tsx` and `ExerciseProgress.tsx` — confirmed **already correct** (PlanBuilder already keys on `we.id`; ExerciseProgress operates on global per-exercise data by design, consistent with the Task 2 decision above) — do not touch either file in this sprint.

## Verification (before calling this sprint done)

This is a correctness fix, not a visual one — verification must prove the bug is actually gone, not just that the code compiles:
1. Create a real plan day with the same exercise added twice (e.g. two "Bench Press" entries).
2. Log different sets against each instance in a real active-workout session (e.g. instance 1: 135×10, instance 2: 185×5).
3. Confirm via direct API/DB check that each instance's sets are stored under its own `workout_exercise_id` and do not collide, overwrite, or merge.
4. Reload Session Detail and Previous-Performance prefill and confirm each instance shows its own correct data, not the other's.
5. Confirm the migration backfill ran correctly against existing real data (spot-check a few pre-existing sessions) and that ambiguous rows were left null rather than guessed, per Task 1.

## Verification (every page, before calling it done)

- Renders with no console errors, on a **fresh browser tab** (this project has repeatedly hit stale-HMR-CSS false positives — always confirm on a fresh tab before concluding something is broken, and always confirm on a fresh tab before concluding something is *fixed*)
- Colors/radii/spacing spot-checked via `getComputedStyle()` against the exact hex values in `docs/design-system.md`, not just eyeballed
- Existing functionality on that page still works end-to-end (this is a reskin, regressions are not acceptable — e.g. Active Workout's pip logging, rest timer, and finish flow all need to still function exactly as before)
- `git status` clean of anything unintended

Report back with actual computed-style values and interaction results, not a claim. Update `dev-log.md` with the Sprint 13 entry once done.

---

# Part 5: Security & Correctness Hardening (Sprint 15)

Findings from an independent code-review pass (2026-07-22), each re-verified live against real running code before being added here — several findings from the original review were already stale (fixed by Sprint 14) and are not repeated below. Do the tasks in this order: 1 and 2 are genuinely urgent (a live, exploitable vulnerability and a leaked credential), the rest are real but lower-stakes.

## Task 1 — Fix IDOR on delete-set (do first, most urgent)

**Confirmed exploitable, not theoretical** — verified with a real cross-user attack: registered two separate users, had User B delete User A's workout set using only User B's own (unrelated) session id. It succeeded (`204 No Content`) and the victim's set was genuinely gone.

File: `backend/src/modules/sessions/application/use_cases/delete_workout_set.py:54-55`. The use case verifies the caller owns `session_id`, but never checks that `set_id` actually belongs to that session — so any authenticated user can delete any other user's set by pairing their own valid session id with someone else's set id.

Fix: before deleting, load the set by `set_id` and verify its `workout_session_id` matches the `session_id` passed in (and thus, transitively, that the session belongs to `user_id`, already checked). If it doesn't match, raise the same kind of not-found/unauthorized error used elsewhere in this file — do not silently no-op, and do not leak whether a mismatched `set_id` exists at all (return the same error shape as "not found" either way, so this doesn't become an enumeration oracle).

Verification: repeat the exact cross-user attack above after the fix and confirm it now fails (403/404, not 204), and that the victim's set is still present afterward.

## Task 2 — Remove hardcoded database credentials from source

File: `backend/src/config/settings.py:15-16`. The real database password (`HelloSql##33`) is hardcoded as the default value for `DATABASE_URL`/`TEST_DATABASE_URL`, and this file is committed to git (confirmed via `git show HEAD:...` — it's in history, not just the working tree). Note: `.env` itself is correctly gitignored and not tracked — the leak is specifically the default value baked into the committed Python source, not the `.env` file.

Steps:
1. Change the defaults in `settings.py` to non-functional placeholders (e.g. `"postgresql://user:password@localhost:5432/traqo_dev"`) so nothing sensitive ships in source, while still requiring a real `.env` (which is already gitignored) to run locally.
2. **Rotate the actual PostgreSQL password** — the current one is compromised by having been in git history, changing the default in code alone does not undo that exposure. Update the local Postgres user's password and the real `.env` file to match.
3. Confirm `.env` is still gitignored (it is — verified) and do a final `git log -p -- backend/src/config/settings.py` read-through to make sure no other file still carries the old password as a fallback.
4. Do the same check for `JWT_SECRET_KEY`'s default (`"dev-jwt-secret-key-change-me"`) — it's not a real secret today, but confirm the real `.env` overrides it with a properly random value, since anyone who can guess/read this default can forge valid JWTs otherwise.

Verification: confirm the app still starts and authenticates correctly against the rotated password (real `.env`, not the placeholder default), and that `git show HEAD:backend/src/config/settings.py` no longer contains a real credential.

## Task 3 — Surface the real username after registration (UX correctness bug)

Not a security issue, but a real bug that can lock a user out of an account they just created. `backend/src/modules/auth/domain/services/username_generator.py` silently appends a random suffix (e.g. `john` → `john_4487`) if the requested name is taken — confirmed live: registering the same display name three times in a row creates three separate real accounts with usernames `dupenametest`, `dupenametest_4487`, `dupenametest_1362`. `frontend/src/features/auth/RegisterPage.tsx:18-22` discards the register API response entirely and just redirects to `/login` with a generic success message — the user is never told their actual assigned username.

Fix: have `RegisterPage.tsx` read the `username` field from the register response and show it back to the user before redirecting (e.g. "Account created! Your username is `john_4487` — use this to log in," with the redirect either delayed or requiring a click-through, not instant). Do not change the backend's suffixing behavior itself — that's a reasonable way to guarantee uniqueness without a hard registration failure, it's only the frontend that's silently swallowing the result.

Verification: register with a name you know is already taken (create one first, then try the same name again) and confirm the UI actually displays the real suffixed username, then confirm you can log in with exactly that displayed value.

## Task 4 — Rate limiting on auth endpoints

`backend/src/modules/auth/presentation/routes.py` — confirmed zero rate-limiting anywhere in the backend (`grep` for limiter/throttle across `src/` returns nothing). `/api/auth/login` and `/api/auth/register` accept unlimited attempts.

Fix: add a rate limiter (e.g. `slowapi`, which wraps FastAPI cleanly) scoped to these two endpoints — a reasonable starting point is something like 5-10 attempts per minute per IP. This doesn't need to be elaborate; the goal is closing the unlimited-brute-force gap, not building full account-lockout infrastructure.

## Task 5 — Explicit transaction handling on multi-step writes

`backend/src/infrastructure/database.py:26-35` (`get_db`) — no explicit `rollback()` on exception; each repository method calls `self.session.commit()` individually, so a multi-step use case (e.g. `BuildPlan`, which creates a plan, then days, then exercises) can leave partially-committed data if a later step fails.

Fix: move to a unit-of-work pattern for multi-step use cases specifically — commit once at the end of the use case, or wrap the use case body in an explicit `try/except` that calls `db.rollback()` on failure. Scope this to use cases that do more than one write (`BuildPlan` is the clearest example); single-write use cases are already fine as-is.

Verification: pick one multi-step use case (e.g. `BuildPlan`), deliberately trigger a failure partway through (e.g. an invalid exercise id on the second day), and confirm via direct DB query that nothing from that request was persisted — not just that the API returned an error.

## Task 6 — Missing indexes

Add `index=True` to: `backend/src/modules/workouts/infrastructure/models/workout_plan_model.py` (`user_id`), `backend/src/modules/workouts/infrastructure/models/workout_exercise_model.py` (`plan_day_id`), `backend/src/modules/workouts/infrastructure/models/plan_day_model.py` (`workout_plan_id`). Route through a migration, not a raw model edit against the live DB.

## Task 7 — CORS origin from configuration

`backend/src/app.py:36-42` — `allow_origins=["http://localhost:5173"]` is hardcoded. Move to a `settings.CORS_ORIGINS` list read from `.env`, defaulting to the current localhost value for dev. This has already caused a real incident (Sprint 8 dev-log: a stale process pushed the dev server to port 5174, breaking all API calls) — configurable origins would have made that a one-line `.env` fix instead of a code change.

## Task 8 — Uniqueness constraint on exercise names

`backend/src/modules/exercises/infrastructure/models/exercise_model.py` — add a unique constraint on `(user_id, name)`, plus a migration. Decide and document what happens on conflict: reject with a clear error ("You already have an exercise named X"), rather than a raw DB constraint violation surfacing to the user.

## Task 9 — Remove dead `plan_day_schedule` code

`backend/src/modules/workouts/infrastructure/models/plan_day_schedule_model.py` and its usages in `backend/src/modules/workouts/infrastructure/repositories/plan_day_repository_impl.py`. Confirmed the underlying table doesn't exist in the live DB (`to_regclass('plan_day_schedule')` returns null) and confirmed nothing in `application/` or `presentation/` calls these repository methods — this is fully dead, unreachable code left over from before Plan Builder v2. Delete the model file and the dead methods in the repository. Low priority, but leaving it risks a bad migration the next time someone runs `alembic revision --autogenerate` without knowing to exclude it.

## Verification standard for this sprint

Every fix here must be proven with a real request/attack/query, not a source-code read — this is exactly the standard that caught the two most serious findings in the first place. In particular:
- Task 1's fix must be proven by literally repeating the cross-user delete attack and confirming it now fails.
- Task 2's rotation must be proven by confirming the app authenticates against the *new* password and fails against the old one.
- Task 3 must be proven by an actual duplicate-name registration in the browser, reading the real displayed username, and logging in with it.
