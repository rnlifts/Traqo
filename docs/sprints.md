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
