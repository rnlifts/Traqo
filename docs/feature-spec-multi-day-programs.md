# Feature Spec — Multi-Day Programs + History Redesign

**Status:** Owner-confirmed direction (2026-07-19), spec-only — no code written. This document supersedes `docs/sprints.md` Sprint 9 ("Day-of-Week Scheduling") and `docs/ux-improvement-plan.md` Item A. Not open for re-litigation on the *direction*; several structural details are still flagged as open decisions for the owner/PM to confirm before implementation starts (see Section 8).

**Scope of this document:** conceptual data model direction, UX flows, and copy — not literal SQL, migrations, or route code. The coder designs the actual schema/migration/endpoints from this.

---

## 0. What's changing and why

The original Sprint 9 plan (`ux-improvement-plan.md` Item A) was: add a day-of-week tag directly to `workout_plans`, so a plan repeats on chosen weekdays but still has exactly one exercise list. That plan was never implemented — `WorkoutPlanModel` today (`backend/src/modules/workouts/infrastructure/models/workout_plan_model.py`) has only `id, user_id, name, created_at, updated_at`, no day field. This simplifies the migration (see Section 6): there's no plan-level weekday data to reconcile, only the exercise list to re-parent.

The owner has now confirmed a bigger structure: **one plan is a named multi-day program, and each day within it has its own distinct exercise list.** Example: "Push/Pull/Legs" is one plan; Day 1 = Push exercises, Day 2 = Pull exercises, Day 3 = Leg exercises, each independently orderable and each potentially tagged to specific weekday(s). Starting a workout means picking a **day**, not just "the plan."

Bundled into this same spec, per the owner's request in the same conversation: **History must show which plan *and* which day was run on a given date**, with drill-down into the actual exercises/sets/reps/weight logged that session. This is coupled to the day structure — you can't show "which day of the program" in history until "day" exists as a real entity — and it also finally delivers the Sprint 5 `docs/sprints.md` line item "History detail view (sets logged in that session)," which was scoped as P2 and explicitly deferred, never built. Treat it as folded into this work, not separate.

---

## 1. Data model direction (conceptual)

### 1.1 New entity: Day (within a plan)

A plan gains a child entity — call it `PlanDay` (naming: keep `WorkoutPlan` as the existing plan/program root; see Section 8.e on whether "Plan" vs "Program" changes in UI copy). A `PlanDay` belongs to exactly one plan and has:

- a label/name (e.g. "Push", "Day 1", "Upper A") — required, this is what appears in Start Workout, Dashboard, and History
- an order position within the plan (for plans with no weekday tags at all — see 1.2 — so there's still a deterministic "next day" sequence to display)
- zero or more weekday associations (see 1.2)
- its own ordered list of exercises, each carrying the Sprint 8 target fields

### 1.2 Weekday association: per-day, zero-to-many, join table

The owner's wording ("each potentially tagged to specific weekdays") confirms weekday association lives on the **day**, not the plan — that's the correct read given the whole point of the restructure is that different days do different things on different days. Concretely:

- **Recommend a join table** (e.g. `plan_day_schedule`: `plan_day_id`, `weekday`) rather than a single field on the day — mirrors the exact reasoning already in `ux-improvement-plan.md` Item A ("a join table if a plan should ever repeat on multiple days"). A day like "Upper" in an Upper/Lower split plausibly runs twice a week (e.g. Mon + Thu), so zero-to-many is the right cardinality, not zero-or-one.
- **A day can have zero weekdays** — this is the "rotating sequence, no fixed schedule" case the task description explicitly allows for (pure Push→Pull→Legs rotation the user manually advances through, no calendar binding at all).
- **Recommend*, flagged in Section 8.b for confirmation*: block two days *within the same plan* from claiming the same weekday** (can't have both "Push" and "Pull" tagged Monday inside one PPL program — that's just a data-entry error, and it would make "today's workout" auto-suggest ambiguous within a single plan). Validate this at add/edit-day time with a clear error, not silently allowed.
- **Do not block the same weekday being claimed across two *different* plans** — a user may run two concurrent programs (e.g. a lifting program + a conditioning program) that legitimately both touch Monday. The Dashboard and Start Workout flows need to handle "more than one match for today" gracefully rather than assuming uniqueness (see Section 4 and 5).

### 1.3 Exercises move down one level, targets go with them

Per the task's explicit steer: `target_sets`/`target_reps`/`target_weight` (added in Sprint 8 on `workout_exercises`) become properties of an **exercise scoped to a day**, not a plan. Concretely, `WorkoutExercise`'s parent foreign key changes from `workout_plan_id` → `plan_day_id`. The plan is still reachable, just one hop further (`workout_exercise → plan_day → workout_plan`), not duplicated as a redundant direct FK — avoids a second source of truth that could drift.

Order numbering (`order_number`, currently unique per `(workout_plan_id, order_number)`) becomes scoped per day instead: unique per `(plan_day_id, order_number)`. Same swap-based reorder logic Sprint 3 already built, just re-scoped.

**Carry-forward, not re-decided here:** Sprint 8 explicitly scoped "editing targets after an exercise is added" as out of scope (remove/re-add only). Nothing in this task changes that. Flagged again in Section 8.d in case the owner wants to revisit it now that programs are more structured and re-adding an exercise mid-program is more friction than before.

### 1.4 Sessions reference a day, not just a plan

`WorkoutSession` currently stores `workout_plan_id` only. It needs to record **which day was run**: add `plan_day_id` to `WorkoutSession`. Recommend keeping `workout_plan_id` on the session too (denormalized, not derived-only) rather than requiring a join through the day to find the plan — this matches the project's existing defensive-fallback philosophy (`GetWorkoutHistory` already falls back to `"Deleted Plan"` if the plan record is gone; the same fallback pattern should extend to a `"Deleted Day"` label if the day record is later removed, without losing the ability to show *something* for that historical session). A session should snapshot enough to survive its plan/day being edited or deleted later — see `docs/architecture.md` §4's existing rule that a plan can't be deleted while sessions reference it; recommend the same deletion guard extend to days (a day can't be deleted while a session references it, only if it's empty of history).

### 1.5 Resulting shape (conceptual, not DDL)

```
User
 └─ WorkoutPlan ("program")
     └─ PlanDay (label, order, 0..N weekdays via join table)
         └─ WorkoutExercise (exercise_id, order_number, target_sets/reps/weight)
                                                      — moved here from plan-level

WorkoutSession (user_id, workout_plan_id, plan_day_id, started_at, completed_at)
 └─ WorkoutSet (exercise_id, set_number, weight, reps, notes) — unchanged
```

No change to `User`, `Exercise`, or `WorkoutSet` shapes. The whole restructure is: insert `PlanDay` between `WorkoutPlan` and `WorkoutExercise`, and thread `plan_day_id` through `WorkoutSession`.

---

## 2. Plan (program) creation/edit flow

Keep the existing **incremental** creation pattern (create the shell first, add structure after) rather than one giant multi-step form — this is how plan creation already works today (`PlanList.tsx` creates a bare named plan, `PlanDetail.tsx` is where exercises get added afterward) and how Sprint 8's target-fields UI was layered in without disrupting that flow. Extend it by one level rather than replacing it:

1. **Create Program** — same as today: a name field only ("Push/Pull/Legs"), submit → redirected to the now-renamed Program Detail page. Copy: *"Program name (e.g. Push/Pull/Legs)"* placeholder, `Create Program` button (was `Create Plan`).

2. **Program Detail page** (`PlanDetail.tsx` → evolves into a program detail view):
   - Empty state when the program has zero days: *"This program has no days yet. Add your first day to get started."* + a prominent `+ Add Day` action — mirrors the existing `.empty-state` pattern already used for "No exercises added yet."
   - Days render as a row of cards/tabs, one per day, in their stored order. Each shows: label, weekday pills if any tagged (e.g. "Mon, Thu") or a muted "No scheduled days" if none, and an exercise count (e.g. "4 exercises").
   - `+ Add Day` opens an inline form (same interaction weight as the existing "Add Exercise" form): **Day label** text input (placeholder "Day label (e.g. Push, Day 1)"), **Repeats on** — 7 toggle chips (Sun–Sat), optional, none selected by default, `Add Day` submit button.
   - Clicking into a day expands/navigates to that day's exercise list, which is **exactly the existing Sprint 8 UI**, unchanged in shape, just re-scoped to a day instead of a plan: exercise `<select>` + Sets/Reps/Weight number inputs + `Add` button, exercise cards below with the `Target: 3 sets × 8 reps × 135 lbs` line, ↑/↓ reorder buttons (keep the existing `aria-label="Move exercise up/down"` pattern from Sprint 7), and `Remove` with the existing `ConfirmDialog`.
   - Day-level actions: rename label, edit weekday tags, reorder days (↑/↓, same pattern as exercise reorder), delete day (blocked via `ConfirmDialog` if it would delete a day with logged history — see 1.4 — with copy like *"This day has workout history and can't be deleted."* rather than a raw 409).

3. **Accessibility requirement carried into the new UI, not optional:** the 7 weekday toggle chips must be real `<button aria-pressed="true|false">` elements (or equivalent), not styled `<div onClick>` — Sprint 7 already established this discipline for icon-only buttons (`aria-label` on reorder arrows) and it should extend here. Day tabs/cards should mark the active day with `aria-current="page"` (or proper `role="tablist"`/`role="tab"` semantics if implemented as tabs), matching the pattern already used for nav active-state in `Layout.tsx`. On narrow viewports, wrap the 7 chips to two rows rather than shrinking them below a ~44×44px tap target — this app already has a documented mobile breakpoint (`Layout.tsx`'s hamburger nav) to reuse the same breakpoint value from.

4. **Naming a day vs. numbering it:** if the user adds a day and leaves the label blank, do not allow it — a day must have a label (default placeholder text like "Day 1" is fine as a *suggestion* pre-filled in the input, but require non-empty on submit, same validation posture as "reject empty display name" already used elsewhere in the app).

---

## 3. Start Workout flow

Today, "Start Workout" is a single button on the plan detail page (`PlanDetail.tsx` lines 212–221) that starts a session against the whole plan. That model no longer applies once a plan has multiple days.

- **Primary path — from Program Detail:** each day card gets its own `Start {label}` button (e.g. "Start Push"), not one global "Start Workout" button. This removes an extra picker step for the common case where the user already navigated to the day they intend to run — once they're looking at "Push," starting it should be one click.
- **Auto-suggest by weekday, always overridable:** if a day is tagged to today's weekday, visually highlight that day's card (e.g. a "Today" badge) — but never disable or hide the other days' Start buttons. The task explicitly requires manual override to always be available; treat weekday tags as advisory scheduling metadata, never a lock. This is also the correct read of the owner's "auto-suggest... but allow manual override" wording — flagged again in Section 8.c since it's worth an explicit confirm given how much of the UX hinges on it.
- **No same-day exclusivity.** If the user already ran "Push" today and wants to run it again (or run a different day the same day), don't block it — sessions are a log, not a slot-filling calendar. Nothing in the current domain model enforces one-session-per-day and this spec doesn't introduce that constraint.
- **Multiple days match today across different plans:** since cross-plan weekday overlap is allowed (1.2), a user could have two different programs both tagging Monday. Don't try to pick one automatically — surface both as candidates (this mostly falls out naturally since each program's own detail page independently highlights "today," and the Dashboard case is handled explicitly in Section 4).

---

## 4. Dashboard — "Today's Workout"

Sprint 9's original notes already anticipated a "Today's workout" Dashboard card once day-of-week data exists; this refines it for the new per-day structure. `Dashboard.tsx` today only shows generic recent-history cards (`docs/ux-improvement-plan.md` Recommendation 1, already partially shipped in Sprint 7) — this adds a dedicated card above that.

- **Exactly one day (across all the user's plans) tagged to today's weekday:** show a card — heading *"Today's Workout"*, body *"{Program name} — {Day label}"* (e.g. "Push/Pull/Legs — Push Day"), single CTA button *"Start {Day label}"* that starts the session directly, skipping the intermediate program/day picker entirely. This is the closest fit to Hevy's "routine of the day" home-screen widget already cited in `ux-improvement-plan.md` §4 (tap-to-start a scheduled routine directly from the home screen).
- **More than one match for today** (multiple plans/days tagged to the same weekday — allowed per 1.2): list each as its own compact row/card under the "Today's Workout" heading rather than guessing which one the user means: *"{Program} — {Day}"* per row, each with its own Start button.
- **No match** (no day tagged to today, or the user has plans with no weekday tags at all — pure manual-rotation plans): fall back to the existing generic CTA, but make the copy honest about *why*: *"No workout scheduled for today."* + secondary link *"Browse your programs →"* to `/workout-plans`. Don't show an empty/broken-looking card.
- **Recent activity section** (already exists, Sprint 7): extend each entry to also show the day label, since History now carries it (Section 5) — e.g. "Jul 18 — Push/Pull/Legs (Push Day) — 52 min" instead of today's "Jul 18 — Push/Pull/Legs — 52 min".

---

## 5. History redesign

### 5.1 List view

`GetWorkoutHistory` (`backend/src/modules/sessions/application/use_cases/get_workout_history.py`) currently returns `date`, `workout_name` (the plan name), `duration_minutes` — it never touches `workout_sets` or day data. Extend the DTO to also carry:
- the day label (via the session's new `plan_day_id` → falls back to `"Deleted Day"` if the day was later removed, same defensive posture as the existing `"Deleted Plan"` fallback)
- the session's own id, so the frontend can link into the drill-down detail view (5.2)

`WorkoutHistory.tsx`'s card layout (already a `.card` grid, not a raw table — this was reworked in Sprint 7) gets a fourth field alongside Date / Workout / Duration: **Day** — e.g. "Push Day." Each card becomes clickable/has a `View Details →` affordance leading to the drill-down.

Copy for a card: *"Jul 18, 2026 — Push/Pull/Legs (Push Day) — 52 minutes"* with the existing labeled-field layout (`Date` / `Workout` / `Duration` grid) gaining a `Day` column.

### 5.2 Detail drill-down (delivers the deferred Sprint 5 item)

The backend already has almost everything needed: `GetWorkoutSessionDetail` (`get_workout_session_detail.py`) returns a session plus every logged `WorkoutSet`, and `GET /api/workout-sessions/{session_id}` already exposes it. The gap is entirely on the frontend and in response enrichment, not new backend querying logic:

- **Enrich the response** to resolve `exercise_name` per set server-side (or per exercise group), rather than making the frontend separately fetch the user's full exercise list and manually map ids to names the way `ActiveWorkout.tsx`/`PlanDetail.tsx` do today. This matters more for history than for the active-workout screen, because a session viewed months later may reference an exercise the user has since deleted — see the orphaned-exercise gap flagged in Section 8.h, where client-side lookup against "current exercises" would silently show nothing.
- **New read surface:** a History Detail page/route (e.g. `/workout-history/{sessionId}`, or reuse `/workout-sessions/{sessionId}` in a read-only mode when `completed_at` is set — see Section 8.g, flagged as an explicit implementation choice). Recommend reusing `ActiveWorkout.tsx`'s existing per-exercise card layout (already grouped by exercise, already shows target line + logged sets) in a **read-only variant**: same cards, same "Target: 3 sets × 8 reps × 135 lbs" line and "Set 1: 185 lbs × 10 reps" list, but no add-set form and no Finish button. This reuses a component the team already trusts rather than building a parallel one.
- **Page heading:** *"{Program} — {Day} — {date}"* e.g. "Push/Pull/Legs — Push Day — Jul 18, 2026", with a back link to the history list (React Router `<Link>`, not `<a href>` — per the project's own established AuthContext-timing rule, `docs/architecture.md` §3).
- **Empty edge case:** a finished session with zero logged sets (user started it and immediately finished) should show a clear empty state per exercise card — *"No sets logged"* — reusing the existing `.empty-state` pattern already used in `ActiveWorkout.tsx` for unlogged exercises, not a blank card.

### 5.3 Pattern research (new citations beyond `ux-improvement-plan.md` §4)

- **Hevy — tap-through to session detail:** tapping a logged workout (from history or profile) opens the full session: every exercise done, sets/reps/weight, notes, and total volume for that session — the exact "list → drill-down" shape recommended above. Source: [Hevy — Best Way to Track Workouts You've Logged](https://www.hevyapp.com/features/best-way-to-track-workouts/), [Hevy — Track Exercises](https://www.hevyapp.com/features/track-exercises/).
- **Strong — history tab → per-set detail:** Strong's History tab lists every past workout; tapping one shows exactly how each set went (weight, reps) for that session, and the calendar view (already cited in `ux-improvement-plan.md` §4 via StrongLifts) is a secondary way to land on the same detail screen by date. Confirms "click a row → see the sets" is the established convention, not something to invent differently. Source: [Strong — Exercise Detail Screen](https://help.strongapp.io/article/237-about-exercise-detail).

---

## 6. Migration / compatibility for existing single-list plans

There is live test data in the dev DB today: plans created under the old flat model (`workout_exercises.workout_plan_id` pointing straight at a plan, no day concept). Since Sprint 9's plan-level weekday field was never actually built (confirmed via `workout_plan_model.py` — no such column exists), the migration is simpler than `ux-improvement-plan.md` originally anticipated: there's no weekday data to preserve, only the exercise list to re-parent.

Recommended migration shape (conceptual — coder finalizes as an Alembic migration + backfill):

1. Create the new `plan_days` table (+ `plan_day_schedule` join table).
2. For **every existing `workout_plans` row**, insert exactly one `plan_days` row: label = something sensible and non-empty by default (recommend `"Day 1"` rather than reusing the plan's own name, so the plan name and day label stay visually distinct in the new UI — e.g. plan "Push Day" would otherwise show as "Push Day — Push Day" in history). No weekday tags (nothing to migrate). Order position = 1.
3. Re-point every existing `workout_exercises` row's parent FK from `workout_plan_id` to the new day's `plan_day_id` (1:1 mapping, since each plan got exactly one day). Preserve `order_number` as-is (no `order_number` collisions possible from this step since it's a straight re-parent, not a merge).
4. Backfill every existing `workout_sessions` row's new `plan_day_id` column with that same plan's single new day — every historical session and its `workout_sets` stay fully intact and now correctly attribute to "Day 1" of their plan in the new History view.
5. Result: every plan that existed before this feature becomes a valid one-day program with zero user-visible data loss — a user opening an old plan post-migration sees one day card ("Day 1") containing exactly the exercises it had before, and their history correctly shows "Day 1" for old sessions.

**This is dev data, not production data with real users**, so the downtime/rollback bar is lower than a production migration — but the project's own migration discipline (a dedicated `db-migration-checker` review step, per `dev-log.md`'s Sprint 8 entry) should still apply: run the backfill against a DB snapshot first and verify row counts match 1:1 before/after (every pre-migration `workout_exercises` row should still exist post-migration, just re-parented; every pre-migration `workout_sessions` row should have a non-null `plan_day_id` after backfill, not silently left null).

---

## 7. Related, pre-existing issue worth fixing while this code is touched anyway

Not new scope, but directly adjacent: Sprint 8's `reviewer` flagged that `PlanDetail.tsx`'s remove/reorder actions key off `exercise_id` rather than the `workout_exercise` row's own `id` (`backend/src/modules/workouts/presentation/routes.py` lines ~184–195 and ~217–225 both do `for e in exercises: if e.exercise_id == exercise_id`), which means **adding the same exercise twice to one plan makes remove/reorder ambiguous** (both rows match, first one wins). This was spun off as a separate follow-up, not fixed in Sprint 8. Since this feature necessarily rewrites the day-scoped equivalent of those two endpoints (`.../days/{day_id}/exercises/{workout_exercise_id}`, conceptually), it's a natural, low-cost moment to key off the `workout_exercise` row id instead and close this out — flagging as a recommendation, not mandating it be bundled if the owner wants it tracked separately.

---

## 8. Open questions — confirm before implementation starts

These are flagged rather than silently decided, per the standing instruction not to guess on ambiguous product intent:

**a. Terminology — "Plan" vs "Program" in UI copy.** The owner's phrasing was "a named multi-day program." This spec recommends *keeping* "Plan" as the user-facing term where it already appears (routes, `workoutPlansApi.ts`, existing copy) to avoid a purely-cosmetic rename touching every exception class, route prefix, and doc — and only introducing "Day" as new vocabulary. But if the owner specifically wants "Program" surfaced in the UI (it does read better for a PPL split), that's a copy-only change, cheap to make — confirm which is wanted before the coder locks in copy strings.

**b. Same-weekday collision within one plan.** Recommended: block it (can't tag both "Push" and "Pull" to Monday inside the same program) — confirm this is actually desired, versus just letting the user shoot themselves in the foot and picking manually when it happens.

**c. Is a day's weekday tag ever restrictive, or always advisory?** Spec assumes **always advisory** — a day tagged "Monday" can still be started any day of the week; the weekday only drives auto-suggest highlighting. Confirm this reading is correct, since it affects whether Start Workout ever needs a disabled/blocked state at all (this spec assumes it never does).

**d. Should "edit targets after adding an exercise" (Sprint 8's deferred item) be revisited now?** Not part of this task's ask, but worth a deliberate yes/no now rather than letting it silently persist — re-adding an exercise to fix a typoed target is more annoying once it's nested inside a specific day of a multi-day program.

**e. Hard cap on number of days per plan?** Nothing in the ask suggests one is needed, and the domain has no natural limit (unlike weekdays, which cap at 7). Recommend no hard limit, but flagging since an unbounded day list changes the Program Detail page's layout assumptions (row of cards works fine at 3–7 days; may need to become a scrollable/wrapped list beyond that) — confirm this is an acceptable "won't fix until it's actually a problem" call.

**f. No auto-rotation tracking for weekday-less plans.** For a plan with days but no weekday tags (pure manual rotation), this spec does **not** propose tracking "which day was last run" to suggest "you did Push last, do Pull next" — that requires new state and cross-references the most recent session per plan. Flagged as a plausible future enhancement, explicitly **out of scope for this spec** — confirm that's acceptable for v1, since it's the one piece of "auto-suggest" the task description didn't explicitly ask for (it asked for weekday-based suggestion specifically).

**g. History detail view — reuse `ActiveWorkout.tsx` in read-only mode, or a separate component/route?** Recommended: reuse, gated on `session.completed_at != null`, since `GetWorkoutSessionDetail` doesn't currently distinguish finished vs. in-progress sessions when fetching (it'll happily return an in-progress session's detail too) — confirm whether History should link only to finished sessions (matches `GetWorkoutHistory`'s existing finished-only scope) or whether a user should also be able to jump into an *in-progress* session from somewhere in this UI (out of this task's ask, flagging only because the same backend endpoint technically already allows it).

**h. Orphaned exercise references in history (pre-existing gap, newly visible).** `DeleteExercise`'s guard (`is_used_in_any_plan`, added Sprint 7 per `ux-improvement-plan.md` Item E) only checks current `workout_exercises` rows, **not** historical `workout_sets`. Today this gap is invisible because there's no history detail view to expose it. Once 5.2 ships, a user could remove an exercise from all plans, delete it, and then open an old session's detail and see a set with no resolvable exercise name. Recommend the same defensive-fallback convention already used for deleted plans/days (`"Deleted Exercise"` label) rather than blocking exercise deletion further — but flagging the alternative (extend `is_used_in_any_plan`-style guard to also check `workout_sets`) as a real option the owner may prefer for data-integrity reasons. This is **not required** to ship 5.2 — it's a decision about how gracefully the fallback should degrade, not a blocker.
