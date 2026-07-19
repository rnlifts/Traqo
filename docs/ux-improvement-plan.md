# Traqo UX/UI Improvement Plan

**Scope of this document:** research and recommendations only — no app code was changed. Grounded in the actual frontend (`frontend/src/`) and backend (`backend/src/`) code as of 2026-07-19, plus competitor research on Hevy, Strong, StrongLifts, and Fitbod.

**A scope note up front:** `CLAUDE.md` and `docs/requirements.md` both explicitly list "analytics," "progress-tracking beyond the raw history list," and "personal records tracking" as out of scope for the MVP. The owner's brief for this review asks for "view progress over time" as a core journey, which is analytics by any reasonable definition. This document treats progress visualization as in-scope per the owner's direct instruction, but **flags this as a scope decision the owner should make explicitly** (Section 3 calls it out again where it matters) — ideally by updating `CLAUDE.md`/`requirements.md` once a direction is picked, rather than quietly reinterpreting "out of scope."

---

## 1. Current state summary

### 1.1 Plan creation (`PlanList.tsx`, `PlanDetail.tsx`, `workout_plans` module)

**What exists:** Create a named plan → add exercises one at a time from a `<select>` dropdown → reorder with ↑/↓ buttons → start a workout from the plan detail page.

**What's missing:**
- **No day-of-week concept anywhere.** `WorkoutPlanModel` (`backend/src/modules/workouts/infrastructure/models/workout_plan_model.py`) has only `id, user_id, name, created_at, updated_at`. There is no field, table, or endpoint that associates a plan with a day. The owner's stated goal #1 — "create a plan for selected days of the week" — is **not buildable today without a schema change.**
- **No target sets/reps/weight on a plan.** `WorkoutExerciseModel` (`workout_exercise_model.py`) has only `workout_plan_id, exercise_id, order_number`. A plan is literally just an ordered list of exercise names — it can't tell you "3 sets of 8" for anything. This also means the logging screen (below) has nothing to prefill or check off against.
- Exercise picking is a plain unfiltered `<select>` (`PlanDetail.tsx` lines 178–188) — fine at 5 exercises, unusable at 50+.
- Reordering is icon-only ↑/↓ buttons with no `aria-label` (`PlanDetail.tsx` lines 203–219) — a screen reader announces "button, button" with no indication of what they do.

### 1.2 Set logging (`ActiveWorkout.tsx`, `sessions` module)

**What exists:** A single form (exercise dropdown, weight, reps, free-text notes) that appends one set at a time to a running list grouped by exercise. "Finish Workout" ends the session.

**What's missing / weak:**
- No sense of "today's plan" as a checklist — because plans don't store target sets/reps (1.1), there's nothing to check off. The user re-selects the exercise and retypes weight/reps for every single set, every time.
- **No previous-performance data shown anywhere.** `AddWorkoutSet` (`add_workout_set.py`) and `GetWorkoutSessionDetail` never query prior sessions. There is no "last time you did 135 × 8" placeholder — the single most-cited table-stakes pattern in this category (see Section 4).
- No rest timer.
- No +/- steppers — weight and reps are raw `<input type="number">` fields requiring the keyboard/numpad every time.
- Sets are marked "logged" by successfully submitting a form, not by checking off a pre-planned set — there's no concept of "planned but not yet done."

### 1.3 Progress over time (`WorkoutHistory.tsx`, `GetWorkoutHistory`)

**What exists:** A flat table: date, plan name, duration. That's it.

**What's missing — and this is the core gap for the owner's #3 journey:**
- No per-exercise view at all. There is no endpoint that returns "all sets ever logged for Bench Press across sessions." `GetWorkoutHistory` only joins session + plan name + duration; it never touches `workout_sets`.
- No charts, no estimated 1RM, no volume trend, no PR detection. None of this is possible today — not because the frontend hasn't built it, but because **no backend query exists that groups sets by exercise across sessions.** This is a genuine backend gap, not a rendering gap (Section 3).
- The Dashboard (`Dashboard.tsx`) — the one screen that should summarize progress at a glance — renders exactly `<h1>Dashboard</h1><p>Welcome, {name}!</p>` and nothing else. It fetches no data.

### 1.4 Why the app feels "bare" — diagnosis

This isn't vague — there are specific, fixable causes:

1. **A real design system exists and is almost never used.** `index.css` defines a genuinely reasonable token set (`--text`, `--text-h`, `--accent`, `--border`, a type scale for `h1`/`h2`, dark-mode variables) and `App.css` defines shared classes (`.btn-primary`, `.card`, `.input-field`, `.error-message`, `.empty-state`, `.loading`). But almost none of the actual feature components (`PlanList`, `PlanDetail`, `ActiveWorkout`, `ExerciseList`, `Dashboard`, `Home`, `LoginPage`, `RegisterPage`) use these classes or tokens. Instead every component hand-rolls its own inline `style={{...}}` object with its own hardcoded hex colors (`#007bff`, `#28a745`, `#dc3545`, `#333`, `#f9f9f9`...). The result: no two screens share a button color, spacing unit, or border-radius consistently, even though the tokens to make them consistent already exist.
2. **`Layout.tsx`'s navbar is visually disconnected from everything else** — a hardcoded dark `#333` bar, while the rest of the app is white/light with the purple `--accent` token from `index.css`. It reads like two different apps stitched together.
3. **Leftover Vite scaffold CSS.** `App.css` still contains `.hero`, `.counter`, `#next-steps`, `#docs`, `.ticks` — none of which are used by any real page. This is dead weight that also makes it harder to tell what's actually part of Traqo's design system vs. template leftovers.
4. **No density/hierarchy strategy.** Most pages are `<h1>` + flat `<ul>`/`<form>` with no cards, no grouping, no whitespace rhythm — e.g. `PlanList.tsx` renders plans as a bare unstyled `<li>` list.
5. **Feedback states are inconsistent, not absent** — there is a `.loading`/`.empty-state`/`.error-message` system in `App.css`, but most components render plain `<div>Loading...</div>` or inline `style={{color:'red'}}` instead of using it. Fixing this is largely a matter of *using what's already built*, not building something new.
6. **The Dashboard — the app's front door post-login — has no content.** First impression of "bare" starts here.

---

## 2. Improvement recommendations (ranked by impact, existing data only)

These require no schema changes — they're achievable with what the backend already returns today.

### 1. Give the Dashboard actual content — **High impact / Low effort**
Replace `Dashboard.tsx`'s two lines with: a "Start a workout" primary CTA linking to `/workout-plans`, and a "Recent activity" list showing the last 3 entries from the existing `getWorkoutHistory()` call (date, plan name, duration — data already available, just not fetched here). Copy: *"Welcome back, {name}. Ready to train?"* with a `.btn-primary` "Start a Workout" button. This alone fixes the single biggest "first impression is bare" moment with data you already have.

### 2. Adopt the existing design tokens/classes everywhere — **High impact / Medium effort**
Stop hand-rolling inline styles. Refactor `PlanList`, `PlanDetail`, `ActiveWorkout`, `ExerciseList`, `CreateExerciseForm`, `WorkoutHistory`, `LoginPage`, `RegisterPage`, `Home` to use the classes already defined in `App.css` (`.btn-primary/.btn-success/.btn-danger`, `.card`, `.input-field`, `.error-message`, `.empty-state`, `.loading`) and the CSS variables in `index.css` (`--accent`, `--text-h`, `--border`). Delete the dead Vite-scaffold rules (`.hero`, `.counter`, `#next-steps`, `#docs`, `.ticks`) from `App.css` since no page uses them. Rework `Layout.tsx`'s navbar to use the `--accent`/`--bg` tokens instead of the hardcoded `#333`, so nav and content feel like one product.

### 3. Turn set logging into a checklist, not a blank form — **High impact / Medium effort**
Even without target-sets data (Section 3), stop requiring the user to re-pick the exercise from a dropdown for every set. Restructure `ActiveWorkout.tsx` into one card per plan exercise (it already groups `setsByExercise` for display — just move the input form *inside* each exercise's card instead of one shared form above everything). Add a "+ Add another set" link at the bottom of each exercise card rather than a single global form. This removes one full field (exercise selection) from every set logged after the first.

### 4. Replace `window.confirm()` with an in-app confirm dialog — **Medium impact / Low-Medium effort**
`PlanList.handleDeletePlan`, `PlanDetail.handleRemoveExercise`, `ExerciseList.handleDelete`, and `ActiveWorkout.handleFinish` all use the native browser `confirm()`. It can't be styled, doesn't match the rest of the app, and has inconsistent screen-reader behavior across browsers. Build one reusable `<ConfirmDialog>` component and use it in all four places.

### 5. Fix icon-only buttons and add active-nav state for accessibility — **Medium impact / Low effort**
Add `aria-label="Move {exercise name} up"` / `"down"` to the reorder buttons in `PlanDetail.tsx` (currently bare `↑`/`↓` glyphs with no accessible name). In `Layout.tsx`, mark the current route's nav link with `aria-current="page"` and a visual active state — right now there's no way to tell which page you're on from the nav itself.

### 6. Consistent success feedback — **Medium impact / Low effort**
Renaming a plan, adding an exercise, or logging a set gives no explicit confirmation beyond an implicit list refresh — a user who clicks "Update Name" isn't sure it worked. Add a lightweight toast/snackbar (e.g., "Plan renamed", "Set logged") for these actions.

### 7. Responsive nav — **Low-Medium impact / Low-Medium effort**
`Layout.tsx`'s nav is a single-row flex with 4 links + username + logout button and no mobile breakpoint or hamburger. On a phone-width viewport this will wrap awkwardly. Add a collapsed/hamburger nav under ~640px.

---

## 3. New features required (beyond visual polish)

These are things the three core flows genuinely cannot do today without backend changes. Each is marked **Backend** and/or **Frontend**, with effort.

### A. Day-of-week scheduling for plans — **Required for journey #1** — Backend: Medium, Frontend: Low-Medium
Add a way to assign a plan to one or more days of the week (e.g., a `scheduled_days` field on `workout_plans`, or a small `plan_schedule` join table if a plan should be able to repeat across a week). Needs: migration, domain entity update, `CreateWorkoutPlan`/`UpdateWorkoutPlan` use case changes, new response field. Frontend: a day-picker (7 toggle chips, Sun–Sat) in the plan create/edit form, and a "Today's workout" card on the Dashboard once this exists.

### B. Target sets/reps/weight per plan exercise — **Required for journey #1 and #2** — Backend: Medium, Frontend: Low-Medium
Add `target_sets`, `target_reps`, and optionally `target_weight` (nullable) to `workout_exercises`. Without this, a plan has no notion of "how much" — and the logging screen has nothing to check off against. This is the single most load-bearing missing field in the whole schema: it blocks both journey #1 (a plan is currently just names in order) and journey #2 (nothing to checklist against).

### C. "Previous performance" endpoint — **Required for journey #2 — table stakes per competitor research** — Backend: Medium, Frontend: Medium
A query that, given `user_id` + `exercise_id`, returns the most recent finished session's sets for that exercise (weight, reps per set number). Used to prefill the logging form with placeholder values ("last time: 135 × 8") the way Strong and Hevy do. Requires a new read-side use case joining `workout_sets` → `workout_sessions` filtered to `completed_at IS NOT NULL`, ordered by `started_at desc`, limited to the most recent session — this doesn't exist in any form today (`GetWorkoutSessionDetail` only reads the *current* session).

### D. Progress views: per-exercise history, volume, estimated 1RM — **Required for journey #3** — Backend: Medium-High, Frontend: Medium-High
`GetWorkoutHistory` never touches `workout_sets`; there is no query anywhere that groups sets by exercise across sessions. To show progress over time you need a new use case (e.g. `GetExerciseProgress(user_id, exercise_id)`) returning, per session date: best set (weight × reps), computed volume (Σ weight × reps), and an estimated 1RM (Epley: `weight × (1 + reps/30)`). Frontend needs a chart component (e.g. a lightweight library like Recharts) and an exercise picker to view it. **Scope flag:** this is exactly what `requirements.md` §4 currently lists as out of scope ("Analytics or progress-tracking beyond the raw history list," "Personal records tracking"). Recommend explicitly updating that doc once the owner confirms this direction, rather than leaving the written scope and the actual product silently contradicting each other.

### E. Exercise-delete guard against in-use exercises — **Bug, not a feature — High priority, Backend only, Low effort**
`WorkoutExerciseModel.exercise_id` has no `ondelete` behavior, and `DeleteExercise` (`delete_exercise.py`) never checks whether the exercise is referenced by any `workout_exercises` row before deleting. Deleting an exercise that's used in a plan will raise an **unhandled `IntegrityError` → an opaque 500**, not the clean `{"error": "..."}` shape the rest of the API guarantees — and it directly contradicts the project's own stated principle in `requirements.md` §3 ("destructive operations that would silently lose a user's data are blocked with a clear error rather than allowed to... fail with an opaque 500"). `DeleteWorkoutPlan` already implements exactly this pattern for plans-with-sessions; mirror it here with an `ExerciseInUseError` → HTTP 409 ("This exercise is used in one or more workout plans — remove it from those plans first").

### F. Rest timer during logging — **Frontend-only, table stakes per competitor research** — Frontend: Medium
No backend dependency — a client-side countdown (e.g., 90s default) that starts after a set is logged, with a visible/audible cue when it ends. Can ship independent of A–D.

### G. Consistency streak / calendar view on History — **Frontend-only, derivable from existing data today** — Frontend: Medium
This one needs **no backend work at all** — `GetWorkoutHistory` already returns every finished session's date. A calendar-heatmap or "workouts this week" streak counter can be built purely client-side from data the app already has. High value-to-effort ratio for the "progress over time" journey — recommend building this before D, since D requires new backend work and this doesn't.

---

## 4. Pattern research notes

- **Day-of-week scheduling & routine folders (Hevy):** Hevy routines are saved templates that can be scheduled to specific days via a home-screen "routine of the day" widget; tapping it starts a live workout directly. Source: [Hevy — Build a Workout Program](https://help.hevyapp.com/hc/en-us/articles/34953606698903-Build-a-Workout-Program-Create-Organize-Routines), [Hevy — Track Workouts](https://www.hevyapp.com/features/track-workouts/).
- **Previous-set placeholders & rest timer (Strong):** Strong shows the prior session's weight/reps automatically when a set starts, and the rest timer starts automatically after logging a set, configurable per exercise and per set type (warm-up vs. working). This is described as the most important single feature in the category. Source: [Strong — Rest Timer](https://help.strongapp.io/article/231-rest-timer), [RepReturn — Strong App Review](https://repreturn.com/strong-app-review/).
- **Quick set completion + plate math (Strong / StrongLifts):** Sets are marked done by tapping a circle/checkbox rather than submitting a form; a plate calculator is reachable by tapping the displayed weight, with +/- buttons per plate that live-update the total. Source: [Strong — Plate Calculator](https://help.strongapp.io/article/169-how-do-i-use-the-plate-calculator), [Stronglifts — Plate Calculator](https://support.stronglifts.com/article/154-plate-calculator).
- **Progress charts, est. 1RM, volume, live PRs (Hevy):** Hevy plots est. 1RM, volume, and best set per exercise over time with zoomable date ranges, and fires a "live PR" notification for new heaviest weight, best 1RM, best volume, most reps, or best duration. Source: [Hevy — Gym Performance Tracking](https://www.hevyapp.com/features/gym-performance/), [Hevy — Personal Records Explained](https://help.hevyapp.com/hc/en-us/articles/35649367857175-Personal-Records-PRs-and-Set-Records-Explained-How-They-Work-in-the-Hevy-App), [Hevy — Live PR](https://www.hevyapp.com/features/live-pr/).
- **Consistency calendar (StrongLifts):** StrongLifts' in-app calendar marks each completed workout day with a colored dot as a simple, low-effort consistency view — confirms a calendar/streak view is a well-established, low-complexity pattern (not a novel one to invent). Source: [StrongLifts — Workout and Exercise History](https://support.stronglifts.com/article/72-how-to-use-the-calendar).

---

## Suggested next-sprint picks (if choosing a small set)

If the owner wants a small, high-conviction slice rather than everything above:
1. Fix the exercise-delete 500 bug (Item E) — it's a real bug, trivial to fix.
2. Ship target sets/reps on plan exercises (Item B) — unlocks real logging UX and is a prerequisite for almost everything else.
3. Dashboard content + design-token adoption (Section 2, items 1–2) — biggest visible "less bare" improvement for the effort.
4. Previous-performance prefill (Item C) — the highest-value single feature for the logging flow per competitor research.
5. Day-of-week scheduling (Item A) — directly what the owner asked for in journey #1.

Progress charts (Item D) and streak/calendar (Item G) are real value but should follow once B and C exist — and D specifically needs an explicit scope decision given the current written-scope contradiction.
