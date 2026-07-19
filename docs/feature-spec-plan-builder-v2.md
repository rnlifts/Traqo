# Feature Spec — Plan Builder v2 (Week-Chain Model + Pip-Based Logging)

**Status:** Owner-confirmed direction (2026-07-20), spec-only — no code written. Source of truth for *workflow and interaction logic* is the owner-provided reference prototype (`C:\Users\user\Downloads\exercise-plan-builder.html`, self-contained in-memory HTML/JS, no backend). Its visual design (cream background, graph-paper texture, Bebas Neue, blue `#2748E0`) is explicitly **not** adopted — only its JS behavior is authoritative. Visual tokens map onto the already-shipped palette in `frontend/src/index.css` / `docs/design-spec-ui-refresh.md` (white bg, dark gray text, indigo `#4f46e5` accent).

**Supersedes:** `docs/feature-spec-multi-day-programs.md`, in part. See §0.1 for exactly what carries forward vs. retires.

**Scope of this document:** conceptual data model, UX flows, copy, and the one piece of net-new interaction design (weight capture on top of the reference's boolean pips) — not literal SQL, migrations, or route code. The coder finalizes actual schema/migration/endpoint shapes from this.

---

## 0. What's changing, and what this supersedes

The reference prototype introduces a fundamentally different plan shape than what's currently built: a plan is either a flat list of **N arbitrary days** (`unitType: 'days'`) or a **fixed-length chain of real calendar weeks**, each Mon–Sun, where every week after the first either mirrors an earlier week ("linked"), has its own content ("custom"), or — only for week 1 — is the immutable "base" everything else measures against (`unitType: 'weeks'`). This "weeks" concept does not exist in Traqo today. What exists today (`PlanDay` hanging directly off `WorkoutPlan`, with optional weekday tags via `plan_day_schedule`) becomes exactly the reference's "days" unit type, minus weekday tags.

### 0.1 Carries forward from `docs/feature-spec-multi-day-programs.md`

- The core insight that a plan is a multi-day program and starting a workout means picking a **day**, not just a plan (§0 of the old spec).
- `WorkoutExercise` carrying Sprint 8's target fields, scoped to a day (old spec §1.3) — unchanged, just gains `notes` (new, see §1.5 below).
- `WorkoutSession` recording which day was run, with the "denormalize `workout_plan_id` alongside `plan_day_id` so history survives a deleted plan/day" philosophy (old spec §1.4) — unchanged, and extended (see §1.6).
- The deletion guard: a day/week can't be removed while a session references it (old spec §1.4, §3) — unchanged, and this spec leans on it harder (see §1.8).
- History showing which day was run, with drill-down into sets (old spec §5) — still the right direction; not yet built (`WorkoutHistory.tsx` today shows only date/workout/duration, confirmed by reading the current component), and this spec's §1.6 changes what "which day" needs to display for a weeks-type plan (adds "Week N ·").
- `GetPreviousPerformance`/"last time" prefill (already shipped, keyed on `plan_day_id`) — unchanged and, per §1.4 below, keeps working correctly under the new model **by construction**, not by extra code.

### 0.2 Retires from `docs/feature-spec-multi-day-programs.md`

- **The entire weekday-tag mechanism** (§1.2, `plan_day_schedule` table, `DuplicateWeekdayInPlanError`, the 7-toggle-chip UI in `PlanDetail.tsx`, `get_days_by_weekday_in_plan`). The reference has no weekday-tagging concept anywhere — a "days" plan just rotates through N arbitrary days with no calendar binding, and a "weeks" plan's calendar structure comes from real `Week` entities, not tags on a day. There is no product need for both mechanisms to coexist, and the reference's model is strictly more expressive for anything with real weekly structure.
- **Old spec §3's "auto-suggest by weekday" Start Workout behavior and §4's whole "Today's Workout" Dashboard card.** Both were built entirely on weekday-tag data that no longer exists. Checked `frontend/src/pages/Dashboard.tsx` directly — this was never actually built (Dashboard today only renders a static "Recent Workouts" list, no weekday-matching logic), so retiring it is a paper cut, not a regression of shipped behavior. The reference's own dashboard (`renderDashboard()`) confirms this direction: a create-tile, a plan grid with per-card Start/Edit, and a flat "Recent workouts" list — no smart "today" card at all.
- **Old spec §2's "keep the existing incremental creation pattern" recommendation** (create a bare-named plan immediately, add structure after). The reference's Step 1 (name + length) → Step 2 (structure) wizard is a different, deliberate flow — see §2 below — and this spec replaces the old recommendation with it.
- **Old spec §8.b/8.c's open questions about weekday-collision blocking and "advisory vs. restrictive" tags** — moot, no weekday tags left to collide.
- Old spec §7 (the `exercise_id` vs. `workout_exercise.id` remove/reorder ambiguity) — already fixed in the shipped code (`backend/src/modules/workouts/presentation/routes.py` keys every day-scoped exercise endpoint off `workout_exercise_id`, confirmed by reading it). Nothing to retire or carry, just noting it's a non-issue now.

---

## 1. Data model (conceptual)

### 1.1 `WorkoutPlan` gains a unit type and a length

```
WorkoutPlan
  id, user_id, name, created_at, updated_at   (unchanged)
  + unit_type: 'days' | 'weeks'
  + total_units: int   (day count if 'days', week count if 'weeks')
```

Both fields are set once, at plan creation (Step 1, §2), and **not editable afterward** — the reference has no UI anywhere to add/remove a day from a "days" plan or add/remove a week from a "weeks" plan once `newDraft()` has run; `totalUnits` only exists as a Step 1 input. Flagged explicitly as a deliberate-but-debatable call in §6.b, because it's a real capability regression against what's shipped today (`PlanDetail.tsx` currently has live "+ Add Day" / "Delete Day" buttons, always available).

### 1.2 'days' plans: unchanged shape, minus weekday tags

For `unit_type='days'`, `PlanDay` continues to attach directly to `WorkoutPlan` exactly as it does today (`plan_day_model.py`'s `workout_plan_id` FK, `order_position`). The only structural changes: drop `plan_day_schedule` entirely (§0.2), and add `is_rest` (§1.3).

### 1.3 New: `is_rest` on `PlanDay` (replaces the weekday-tag concept)

```
PlanDay
  id, workout_plan_id, label, order_position, created_at, updated_at   (unchanged)
  + is_rest: bool, default false
  + plan_week_id: int | null   (new, weeks-type only — see 1.4)
```

`is_rest` is a pure display/gating flag, independent of whether the day has exercises attached — mirrors the reference exactly: `toggleRest()` only flips `days[activeDay].isRest`, it never clears `days[activeDay].exercises`. A day marked rest keeps whatever exercises it had; the builder just hides the exercise editor behind a "Rest day / No exercises scheduled / Undo — add exercises instead" state (`renderStep2`'s `rest-state` block) while `is_rest` is true, and Start Workout refuses to begin a session on a rest day regardless of what's underneath (§3).

### 1.4 New entity for 'weeks' plans: `PlanWeek`, with the reference's exact link-resolution logic

```
PlanWeek
  id, workout_plan_id, week_number (1-indexed), mode: 'base' | 'linked' | 'custom'
  created_at, updated_at
```

- **Week 1 is always `mode='base'`, permanently.** Confirmed from the reference: `newDraft()` hardcodes `weeks[0] = {mode:'base', days: WEEK_DAY_LABELS.map(makeDay)}`, and `renderStep2`'s week-status banner only ever offers "Customize this week" (linked→custom) or "Match previous week" (custom→linked) buttons for non-zero week indices — there is no code path that ever converts week 1 away from `base`, or converts any other week *into* `base`. Only one base week can exist per plan, and it's always week 1.
- **Weeks 2..N start as `mode='linked'`** and have **zero `PlanDay` children** — nothing to store, because a linked week's content is *resolved*, not stored. This is the one piece of logic the task explicitly calls out as needing exact fidelity — reading `getEffectiveDays()`/`getBaselineIndex()` directly:

  ```js
  function getEffectiveDays(weekIdx){
    let j = weekIdx;
    while(draft.weeks[j].mode === 'linked') j--;
    return draft.weeks[j].days;
  }
  ```

  This walks **backward from the requested week to the nearest preceding non-linked (`base` or `custom`) week** — not always week 1. Example: weeks 1(base)/2(linked)/3(custom)/4(linked)/5(linked) — week 4 and week 5 both resolve to week 3's content, not week 1's, because week 3 is the nearest non-linked week behind them. Both backend and frontend need this exact algorithm, not a simplified "always link to week 1" version.
- **`mode='custom'`** means the week has its own real `PlanDay` rows (`plan_week_id` set, 7 rows, Mon–Sun), populated at the moment of customization by deep-copying the *currently effective* days at that point (`customizeWeek()`'s `cloneDays(getEffectiveDays(weekIdx))`) — i.e. it forks from whatever it currently displays, not always from week 1.
- **Day labels for weeks-type plans are always `Mon`/`Tue`/`Wed`/`Thu`/`Fri`/`Sat`/`Sun`, fixed, never renamed.** The reference has no rename affordance for weeks-type days at all (day tabs in `renderStep2` are plain non-editable buttons showing `d.label`) — and this has to stay true for the linking model to mean anything: "Week 3 links to Week 1" only makes sense if "Monday" refers to the same slot in both weeks.

**Why linked weeks having zero stored rows is the correct design, not just a storage optimization:** it's what makes `GetPreviousPerformance` (already shipped, keyed on `plan_day_id`) keep working *by construction*. When a session is started against a linked week, the actual `plan_day_id` it references resolves — server-side — to the nearest preceding non-linked week's real `PlanDay` row (§3, §4.4). So "Week 3 Monday" and "Week 1 Monday," while linked, are literally the same `plan_day_id` in the database, and a session logged against either one shows up as "last time" for the other. This is exactly the right behavior (same prescribed exercises, genuine progression thread) and requires **zero changes** to `GetPreviousPerformance` or `AddWorkoutSet` — it falls out of the resolution design, not extra code.

### 1.5 `WorkoutExercise` gains `notes`

```
WorkoutExercise
  id, plan_day_id, exercise_id, order_number,
  target_sets, target_reps, target_weight   (unchanged, nullable, unchanged types)
  + notes: str, default ''   (planning-time note, e.g. "pause at bottom") 
```

Distinct from `WorkoutSet.notes` (already exists, per-actual-set, e.g. "felt heavy today") — two different notes fields at two different lifecycle points, both already named `notes` in their respective entities, which is fine since they're never read from the same object.

**This also resolves the open item from the old spec (§8.d):** "editing targets after adding an exercise" was Sprint 8's deliberately-deferred "remove/re-add only" restriction. The reference's exercise row is a plain editable `<input>` grid (name, sets, reps, notes, all with live `oninput` handlers) — there's no "locked after add" concept for prescription fields at all. Adopting that model resolves 8.d: **`target_sets`/`target_reps`/`target_weight`/`notes` become freely editable in place** (new endpoint needed — see §2). This is safe to allow even on exercises with logged history, because targets are forward-looking prescription metadata, not a record of what happened — editing them doesn't touch any existing `WorkoutSet` row. **What stays remove/re-add only:** which `Exercise` a row points to (`exercise_id` itself) — swapping exercise identity in place was never what 8.d was asking to unlock, and the reference doesn't support that either (no exercise-swap UI, only name-as-free-text which resolves-or-creates a *new* row, same pattern already shipped in `PlanDetail.tsx`'s `handleAddExerciseToDay`).

### 1.6 `WorkoutSession` gains `plan_week_id` (display only — `plan_day_id`'s meaning is now precisely defined)

The reference computes the session's display label like this:

```js
const dayLabel = plan.unitType === 'weeks'
  ? 'Week ' + (sessionSetup.weekIndex+1) + ' · ' + day.label
  : day.label;
```

Note it uses the **week the user actually picked** (`sessionSetup.weekIndex`), not necessarily the week whose `PlanDay` row structurally backs the session. If the user picks Week 3 and Week 3 is linked to Week 1, the exercises come from Week 1's real day (§1.4) but the label must still read "Week 3 · Monday," not "Week 1 · Monday" — otherwise a user running their program's third week would see "Week 1" in their session and later in history, which is confusing and wrong.

```
WorkoutSession
  id, user_id, workout_plan_id, plan_day_id, started_at, completed_at   (unchanged)
  + plan_week_id: int | null   (new — the PlanWeek the user selected at Start, weeks-type only)
```

- `plan_day_id` keeps its existing meaning and existing consumers unchanged: it always points at the real, structural `PlanDay` row backing the session's exercises (resolved through the linked-week chain if needed) — this is what `GetPreviousPerformance`, `AddWorkoutSet`, and the existing deletion guard all key off, and none of them need to change.
- `plan_week_id` is purely for **display**: "which week did the user say they were doing" — used to render "Week {plan_week.week_number} · {plan_day.label}" in the active-session header, the finish summary, and History (extending the old spec's still-valid §5.1 "Day" column to "Week · Day" for weeks-type plans). Null for `unit_type='days'` plans, where the label is just `day.label`, unchanged from today.

### 1.7 Resulting shape (conceptual, not DDL)

```
User
 └─ WorkoutPlan (unit_type, total_units)
     ├─ [unit_type='days'] PlanDay (label, order_position, is_rest)
     │                        └─ WorkoutExercise (target_sets/reps/weight, notes)
     └─ [unit_type='weeks'] PlanWeek (week_number, mode: base|linked|custom)
                              └─ PlanDay (label ∈ Mon..Sun, is_rest)   — only for base/custom weeks
                                   └─ WorkoutExercise (target_sets/reps/weight, notes)

WorkoutSession (user_id, workout_plan_id, plan_day_id, plan_week_id?, started_at, completed_at)
 └─ WorkoutSet (exercise_id, set_number, weight, reps, notes)   — unchanged shape,
                                                                    upsert semantics change, see §4.2
```

Retired entirely: `plan_day_schedule` (join table), `DuplicateWeekdayInPlanError`, `get_days_by_weekday_in_plan`.

### 1.8 The one real mechanical question: what does "Customize this week" / "Match previous week" actually do to persisted rows?

The reference is pure client-side draft state, so `customizeWeek()` and `matchPreviousWeek()` are trivial object mutations with no data-integrity concerns. A real backend has one: **a week that was customized may already have real workout history logged against its days.** `matchPreviousWeek()` in the reference silently discards the custom week's content (`draft.weeks[weekIdx] = {mode:'linked', days:null}`) — for us, that means either deleting real `PlanDay`/`WorkoutExercise` rows or orphaning them, and the project's own existing rule (old spec §1.4, already enforced for plan/day deletion today) is that a day can't be removed while a session references it.

**Recommendation:** `MatchPreviousWeek` on a currently-custom week checks each of that week's 7 `PlanDay` rows via the same `exists_for_day()` check `DeleteDay` already uses. If none have session history, delete them (matches the reference's clean "forget it, re-link" behavior). If any do, block with a clear error — proposed copy: *"Week {n} has logged workouts and can't be reverted to match another week. Customize it again with new content instead."* — rather than silently orphaning history or silently refusing to update the mode. This reuses an existing, already-battle-tested guard rather than inventing new deletion semantics.

**`CustomizeWeek` is comparatively simple:** deep-copy the effective days (resolved via §1.4's walk-backward algorithm) into 7 new `PlanDay` rows + their `WorkoutExercise` rows, parent them to this week, flip `mode` to `custom`. No guard needed — it only ever *creates* rows, never removes anything that could be referenced.

Both actions are proposed as **immediate, dedicated backend calls** (`POST .../weeks/{n}/customize`, `POST .../weeks/{n}/match-previous`), not deferred into a batched "Save" — see §2's save-model discussion for why.

---

## 2. Create-plan flow

### 2.1 Step 1 — name + length

Matches `renderStep1()` almost exactly, ported onto existing tokens:

- Plan name text input, placeholder *"e.g. Off-season strength block"*.
- Length: 5 chips — **1 Day**, **2 Days**, **1 Week**, **4 Weeks**, **Custom**. Custom reveals a number input (1–52, matches the reference's clamp) + a two-way segmented toggle (Days / Weeks), same as `custom-row`/`.seg` in the reference.
- `Continue →` disabled until both name (trimmed, non-empty) and a length are chosen — same guard as `updatePlanName()`'s `continueBtn.disabled` logic.
- `Cancel` discards and returns to the plan list.

**Nothing is persisted in Step 1.** This is a deliberate change from today's shipped flow (`PlanList.tsx`'s bare-name submit creates a real `WorkoutPlan` row immediately) — see §2.3.

### 2.2 Step 2 — structure

For `unit_type='weeks'` with `total_units > 1`: the week rail renders above everything else — a horizontal row of circular week nodes, connected by lines, one node per week, current week highlighted. Node states map onto the already-established palette from `docs/design-spec-ui-refresh.md` (which, notably, already anticipated this exact UI — its §4 cites "Duolingo's path/circle progress pattern... as a reference for how a row of 'week' circles can carry multiple at-a-glance states"):

| Reference state | Reference styling | Traqo token mapping |
|---|---|---|
| `base` | filled ink circle, white number | filled `--text-h` background, white number |
| `linked` | plain outline circle | outline only, `--border` border, `--text` number |
| `custom` | filled amber circle | filled `--customize` background, white number — this is literally the meaning `--customize` was designed for |
| active (currently viewed) week | accent ring | `--accent` border + `box-shadow: 0 0 0 3px var(--accent-bg)`, same "soft badge" pattern already established for nav active-state |
| connector into a `custom` week | dashed line ("chain breaks here") | dashed `--customize` border-top, same amber |

Per `docs/design-spec-ui-refresh.md`'s own WCAG 1.4.1 caveat (color alone isn't enough, amber sits between red and green under some color-blindness types): each node also needs an `aria-label` stating its state explicitly — *"Week 2, linked to Week 1, active"* / *"Week 3, customized"* — not conveyed by color/fill alone. The reference's own legend row (`rail-legend`: "Foundation week / Linked — matches an earlier week / Customized — its own content") should be kept as visible on-page text too, not just an accessibility-tree label.

Below the rail, a status banner mirrors `weekStatusHtml` exactly:
- Week 1: *"Week 1 is the foundation — every linked week below follows what you set here."*
- Linked week N: *"Week N is linked to Week {base}. Editing Week {base} updates this week too."* + `Customize this week` button.
- Custom week N: *"Week N is customized — it has its own days, separate from the chain."* + `Match previous week` button.

Below that: day tabs (`Mon`–`Sun` for weeks-type, `Day 1`/`Day 2`/… for days-type — the existing day-tab styling in `PlanDetail.tsx` already uses a similar active-underline pattern, reused here), a rest-day toggle switch for the active day (disabled/hidden if the active week is `linked` — matches `currentEditable()`), and the exercise row grid.

**Exercise row grid** extends the reference's 5-column layout (name/sets/reps/notes/remove) to 6, since the reference has no weight field at all and this app's owner explicitly requires it back:

```
Exercise name | Sets | Reps | Weight | Notes | ✕
```

Each editable in place (per §1.5's resolution of the old "remove/re-add only" restriction), disabled with a muted style when the active week is `linked` (matches the reference's `input:disabled` treatment + *"This day is linked. Customize the week to edit it directly."* footer note). Mobile: collapses to a 2-column wrapped grid below ~560px, exercise-head row hidden, matching the reference's own breakpoint behavior.

`+ Add exercise` (dashed-border button, matches the existing `add-exercise-btn` treatment already used for empty states elsewhere in the app).

### 2.3 Save model — a deliberate, flagged deviation from literal 1:1 reference behavior

The reference is pure in-memory: nothing touches `plans[]` until `savePlan()` runs, for *both* create and edit (`openEditFlow` deep-clones the target plan into the same draft object Step 2 edits). Adopting that literally for **editing an existing plan** would require diffing an entire edited draft against persisted rows on Save and figuring out, generically, which day/week rows can be safely updated-in-place vs. must block because they carry session history — real complexity the reference never had to solve, because it has no history to protect.

**Recommendation — split by context:**
- **Create flow (Step 1 → Step 2 → Save):** matches the reference exactly. Nothing persisted until the final `Save plan` — no backend calls during Step 1 or while filling in Step 2's days/exercises. This is also a genuine improvement over today's shipped behavior, where an abandoned plan creation (typed a name, navigated away) leaves a real orphaned `WorkoutPlan` row; under this model it leaves nothing.
- **Edit flow (existing plan → Step 2 directly, skipping Step 1 per `openEditFlow`):** keep today's shipped **immediate-per-action** pattern for simple field edits — day rest-toggle, exercise add/remove/reorder, and (per §1.5) in-place target/notes edits — each already has, or trivially extends, its own endpoint, already tested, already low-risk. `Customize this week` / `Match previous week` (§1.8) are *also* immediate, dedicated calls, specifically because deferring them into a batched save is where the undiffable complexity lives.
- Plan **name** stays editable post-creation (small deliberate addition beyond the reference, which has no rename path at all once `openEditFlow` skips Step 1 — see §6.d) via the same inline-rename pattern already shipped in `ActiveWorkout.tsx`.

Flagged explicitly in §6.a for confirmation, since it does deviate from "the reference is authoritative for exact behavior" for this one dimension (save timing) — the resolution-logic dimension (§1.4) is not touched by this deviation at all.

---

## 3. Session start flow

Matches `renderSessionSetup()` exactly:

1. User taps `Start` on a plan (from the plan list/dashboard) or `Start {label}` from inside a specific day (Program Detail, per old spec §3's still-valid "start from where you're already looking" reasoning).
2. If `unit_type='weeks'` and `total_units > 1`: week chips, **Week 1 selected by default** (`sessionSetup.weekIndex: plan.unitType==='weeks' ? 0 : null` — note there is no date-based "smart default," consistent with §0.2's retirement of weekday auto-suggest).
3. Day chips (only shown if the resolved day list has more than one entry) — for weeks-type, day labels come from the *effective* days of the selected week (§1.4's resolution, computed server-side when the plan detail is fetched, so the frontend never has to re-implement the walk-backward algorithm just to render this screen — see §4.4). A rest-day chip is visually muted/italic with a small dot, matching `.setup-chip.is-rest`.
4. Validation, exactly matching `canBegin = day && !day.isRest && day.exercises.length > 0`:
   - Rest day selected → *"{Day} is a rest day — pick another day, or edit the plan to add exercises here."*, `Begin workout →` disabled.
   - Empty day (no exercises) selected → *"No exercises added for {Day} yet — edit the plan first."*, disabled.
5. `Begin workout →` calls Start Workout with `(workout_plan_id, plan_week_id?, resolved plan_day_id)` — the **resolved** `plan_day_id`, not a client-computed one; server re-validates the resolution rather than trusting the client to have walked the chain correctly (defense in depth, cheap to do since the server already has to do this resolution for §1.4 to work at all).

---

## 4. Session active flow

### 4.1 Layout — matches `renderSessionActive()`

Plan name (small, muted, mono-ish label) + day/week label (large heading, e.g. "Week 3 · Push" or "Push," per §1.6) + `‹ Exit` link. Progress bar (`--success` fill, width = completed-exercises / total-exercises × 100, exactly matching the reference's `pct` calc). Rest-timer widget (§4.5). Per-exercise cards, each showing: exercise name, `{n} × {reps}` meta line, planning notes (italic, muted) if present, **"Last time" line** from the already-shipped previous-performance data (unchanged from today's `ActiveWorkout.tsx` — this must not be lost per the task's explicit requirement, and per §1.4 it keeps working correctly across linked weeks with no extra code), then the pip row (§4.2). Exit produces the exact `exit-confirm` banner copy: *"End this workout without finishing? Your progress on this session won't be saved."* with `Keep going` / `End workout` (danger-colored) actions. `Finish workout` → summary screen: *"Workout complete"*, `{exercisesCompleted}/{totalExercises}` and `{doneSets}/{totalSets}` stat pair, `Done` returns to dashboard — copy and stat shape ported directly from `renderSessionSummary()`/`finishWorkout()`.

### 4.2 The weight-capture design (net-new — the reference has nothing here)

The reference's pip is a pure boolean: tap toggles `done`, no data captured. The task requires: **tapping a pip must reveal inline weight+reps entry for that specific set before it counts as complete.**

**Chosen pattern: inline expand directly under the exercise card's pip row (not a popover, not a modal).** Rationale, grounded in competitor research already cited in this project's own prior docs (`docs/ux-improvement-plan.md` §4): Hevy and Strong both keep weight/reps entry **in-context**, next to the set being logged, never in a separate screen — "Strong shows the prior session's weight/reps automatically when a set starts, and the rest timer starts automatically after logging a set" (`docs/ux-improvement-plan.md`, citing Strong's Rest Timer help doc), and sets are marked done via a tappable control right there in the row, not via navigation. A popover was considered and rejected: positioning a floating panel reliably above/below a 34–44px circular target on narrow mobile viewports is exactly the kind of fragile pattern this app has avoided elsewhere (this project's inline-edit patterns — `PlanDetail.tsx`'s day-rename, `ActiveWorkout.tsx`'s plan-rename — are already "click → form appears in the same flow," never a floating panel). A modal was also rejected: it adds a full open/dismiss cycle per set, working directly against the "fast, low-friction, mid-set" logging speed that's the whole point of a tap-to-complete pip in the first place.

**Interaction, step by step:**

1. Pips render at **44×44px** (not the reference's 34px) with **8px gaps**, wrapping via `flex-wrap` on narrow rows — bumped up from the reference's own value specifically on tap-target grounds, matching the ~44×44px bar this project already set for itself in `docs/feature-spec-multi-day-programs.md` §2.3's weekday-chip guidance. Pip count = `target_sets` if set, else defaults to 3 (matches the reference's `makeExercise()` default of `sets:3` — flagged as a default worth confirming in §6.e since `target_sets` is nullable in this app but wasn't optional in the reference).
2. Tapping an **empty** pip opens a small entry panel directly beneath that exercise card's pip row (only one panel open per card at a time; opening a different pip's panel in the same card replaces it). The panel contains:
   - A small heading, *"Set {n}"*.
   - **Weight** and **Reps** number inputs, each with a real `<label>` (not placeholder-only — see the accessibility note below), pre-filled as an editable starting guess: **`target_weight`/`target_reps` from the exercise's prescription if set, else the corresponding set number from "last time" (previous-performance data, already fetched for the card's "Last time" line), else blank.** This reuses two pieces of data the app already has rather than inventing a third source or losing either.
   - A collapsed **"+ Add a note"** link that reveals a single-line text input if tapped (keeps the default panel compact; doesn't remove the existing per-set notes capability `WorkoutSet.notes` already supports).
   - **`✓ Log set`** (primary/success-colored) and **Cancel** (ghost, collapses the panel without saving).
3. Confirming calls the log-set endpoint with an **explicit `set_number`** equal to that pip's position (§4.3 explains why this must be explicit, not server-derived). On success: the pip flips to its done state (filled `--success`, checkmark, matching the reference's `.pip.done`), the panel collapses, and the rest timer auto-starts (§4.5) — matching `toggleSet()`'s `if(ex.done[setIdx]) startRest(...)`.
4. Tapping an **already-done** pip reopens the same panel, this time pre-filled with **that set's actual saved weight/reps** (not the guess), with a third action, **"Delete set"** (danger-colored text link), alongside **"Save changes"** (replaces "✓ Log set") and **Cancel**. Saving updates the existing set in place (no new row, no id churn); deleting removes it and reverts the pip to empty — this is how a mistaken tap gets undone under a model where the pip carries real persisted data, replacing the reference's simple `done = !done` toggle (which had nothing to lose, since it never stored anything).
5. **Sets beyond the target:** the reference has no concept of this at all (`ex.done` length is fixed at session start, no add-set affordance exists in `renderSessionActive`). This app's currently-shipped `ActiveWorkout.tsx` already allows arbitrary extra sets per exercise with no cap, so silently dropping that on adoption would be a real regression. Recommendation: append a distinct `+` pip (dashed border, not numbered) after the last target pip. Tapping it appends a new pip at the next position and opens its entry panel immediately, pre-filled from the just-completed pip's own values (same weight, same reps) as a reasonable "one more like that" default rather than the target/previous-performance guess.

**Accessibility, since this is entirely new code (not retrofitting an existing pattern):** each pip needs a stateful `aria-label` — *"Set 2, not logged"* / *"Set 2, logged: 135 lbs × 8 reps, tap to edit"* — not just a visual number/checkmark. The reveal panel's weight/reps inputs get real associated `<label>` elements, a step up from this app's existing convention of placeholder-only inputs elsewhere (`PlanDetail.tsx`'s exercise row, `ActiveWorkout.tsx`'s current add-set form) — worth doing here specifically because Sprint 7 already established the precedent of raising the accessibility bar on new/touched code (`aria-label`s added to icon-only reorder buttons) rather than copying forward an existing gap.

### 4.3 Backend implication: set-number must become caller-specified, and logging becomes an upsert

Today's `AddWorkoutSet` (`backend/src/modules/sessions/application/use_cases/add_workout_set.py`) auto-derives `set_number` as `count_by_session_and_exercise(...) + 1` — a pure append-only counter. That breaks the moment a set can be edited or deleted out of order: if pip 2 is deleted and a *new* set is later logged, the counter-based derivation would recompute `set_number=2` from the now-reduced count of 2 remaining rows (set 1 and set 3) and collide/confuse with the existing set 3, since the pip's position is no longer the same thing as "how many rows exist."

**Recommendation:** extend the log-set use case (rename to `LogWorkoutSet`, or extend `AddWorkoutSet` in place — coder's call) to accept an **explicit, caller-supplied `set_number`**, and give it **upsert semantics** keyed on `(session_id, exercise_id, set_number)`: if a row with that exact key already exists, update its `weight`/`reps`/`notes` in place (same row id — this is what makes "reopen a done pip and correct it" cheap and clean, §4.2 step 4); otherwise insert a new row. This single operation covers all three pip cases — first-time confirm, edit-in-place, and the "+ Add set" extra pip — with one code path instead of three. `WorkoutSetRepository` gains `get_by_session_exercise_and_set_number(...)` and `update(...)`; a new `DELETE /workout-sessions/{id}/sets/{set_id}` endpoint + `DeleteWorkoutSet` use case covers §4.2 step 4's "Delete set" action, with the same ownership + "session not already finished" checks `AddWorkoutSet` already enforces. This is new backend surface, flowing directly from the interaction design above, not something to build silently without calling out — flagging it here rather than leaving it implicit.

### 4.4 Server-side resolution, once, reused everywhere

`GetWorkoutPlanDetail` (already exists, `backend/src/modules/workouts/application/use_cases/get_workout_plan_detail.py` + its route) is the natural place to compute §1.4's walk-backward resolution **once per week**, server-side, and return each week's *effective* days (with the real underlying `plan_day_id`s) regardless of whether that week is linked — annotated with which week they were actually resolved from, for the builder's rail/status-banner UI. This means:
- Session setup (§3) never has to re-implement the resolution algorithm — it just reads the effective day list already resolved in the plan detail response.
- The **builder's** live rail/status-banner interactivity (clicking between weeks while editing, before Save) is the one place that legitimately needs a second, client-side implementation of the same algorithm — because it's operating on an in-memory, not-yet-saved draft (§2.3), the same way the reference does. This isn't duplicate logic in the harmful sense CLAUDE.md's "avoid duplicate code" guidance is aimed at (two implementations solving the same problem by accident) — it's the same well-defined algorithm applied to two different data shapes (persisted rows vs. an unsaved draft) that can't share a call stack. Both must be kept in sync if the algorithm ever changes; worth a code comment cross-referencing this section on both sides.

### 4.5 Rest timer

Matches the reference's `restTimer` behavior exactly: auto-starts after any set is confirmed (§4.2 step 3), duration selectable via `30s/60s/90s/120s` chips when idle, running state shows a live countdown clock with `+15s` and `Skip rest` controls. **Persistence: recommend ephemeral, frontend-only state** (matches the reference's `restTimer` being a plain in-memory variable, reset fresh at the start of every session via `beginWorkout()`) — no backend field, no `WorkoutSession` column. Nothing about rest duration needs to survive a page reload mid-session or be visible anywhere else in the app (history, other devices), so there's no product reason to pay for backend persistence. A `localStorage`-only "remember my last chosen duration across sessions" tweak is a cheap, optional nice-to-have, not required.

---

## 5. Migration / compatibility for existing dev data

There is live dev data under the current model: multiple real plans with `PlanDay` rows directly under `WorkoutPlan`, some with `plan_day_schedule` weekday tags set.

**Recommended migration shape (conceptual — coder finalizes as an Alembic migration + backfill), continuing the low-stakes-dev-data posture already established in the old spec's §6:**

1. Add `unit_type` and `total_units` (nullable initially) to `workout_plans`; add `is_rest` (default `false`) to `plan_days`; add `plan_week_id` (nullable) to `plan_days`; add `notes` (default `''`) to `workout_exercises`; add `plan_week_id` (nullable) to `workout_sessions`; create the new `plan_weeks` table.
2. Backfill every existing `workout_plans` row: `unit_type='days'`, `total_units = COUNT(existing plan_days for this plan)`. This preserves every plan's current day list exactly as-is — no `PlanDay`/`WorkoutExercise` rows move, get re-parented, or change id. Confirmed acceptable and low-cost specifically because "days"-type plans keep the exact same `PlanDay → WorkoutPlan` shape they have today (§1.2) — unlike the old spec's migration (which had to re-parent exercises down a new level), this migration barely touches existing rows at all.
3. **Drop `plan_day_schedule` and its rows entirely** — no equivalent concept exists for `days`-type plans in the new model, and weekday tags were always advisory-only (per the old spec's own framing) on dev data, never load-bearing for any currently-shipped feature (§0.2 confirmed the Dashboard "Today's Workout" card that would have consumed this data was never built). Recommend explicit confirmation this is an acceptable, genuinely-zero-user-visible-impact loss, same as the old spec's migration section asked for its own (larger) data changes.
4. No existing `workout_sessions` or `workout_sets` rows need any change at all — `plan_day_id` already means exactly what it needs to mean under the new model (§1.6), and `plan_week_id` simply stays `null` for every pre-existing session (correct, since they all belong to plans that are now `unit_type='days'`, which never has weeks).
5. Verification, same discipline as the old spec's §6 and this project's standing `db-migration-checker` step: row counts for `plan_days`/`workout_exercises`/`workout_sessions`/`workout_sets` before and after should be identical (nothing added, removed, or re-parented by this migration, only new nullable/defaulted columns) — the only row-count change expected anywhere is `plan_day_schedule` going from its current count to zero.

---

## 6. Open questions — confirm before implementation starts

Flagged rather than silently decided, per this project's standing discipline (`docs/feature-spec-multi-day-programs.md` §8, same posture continued here):

**a. Save-model split (§2.3).** Recommended: create flow is pure draft-then-Save (matches the reference exactly); edit flow keeps today's shipped immediate-per-action pattern for simple fields, with `Customize this week`/`Match previous week` also immediate. This is the one place this spec knowingly deviates from "the reference is authoritative for exact behavior," because the reference never had real history to protect. Confirm this split is acceptable, versus wanting a fully batched edit-Save with the diffing/guard logic described (and rejected as unnecessary complexity) in §2.3.

**b. `total_units` fixed forever at creation (§1.1).** The reference has no add/remove-day or add/remove-week affordance post-creation anywhere. For `weeks`-type plans this seems like a genuinely reasonable constraint (a program's calendar length is a real commitment). For `days`-type plans, this is a straightforward regression against what's shipped today (`PlanDetail.tsx` has live "+ Add Day"/"Delete Day" buttons right now). Recommend: **keep add/remove-day for `days`-type plans post-creation** (low risk, doesn't interact with the week-chain logic at all, and removing an already-shipped capability with no stated reason is a pure loss) — but leave `weeks`-type week-count fixed post-creation, matching the reference exactly, since adding/removing a week mid-chain has real knock-on questions (does it shift every subsequent linked week's baseline index?) the reference never had to answer. Confirm this asymmetric treatment is acceptable, or that owner wants day-count fixed too for consistency.

**c. `MatchPreviousWeek` blocked-by-history behavior (§1.8).** Recommended: block with an error if the custom week's days have logged sessions, reusing the existing day-deletion guard. Confirm this is preferred over silently orphaning the old custom days (keeping them in the DB, unreachable from the plan, purely for historical integrity) — the orphan approach avoids ever blocking a user action but leaves invisible, un-cleanable rows behind.

**d. Plan rename post-creation (§2.3).** Recommended as a small deliberate addition beyond the reference (which has no rename path at all once `openEditFlow` skips Step 1) — keep the already-shipped inline-rename capability. Low-stakes, flagging only because it's a literal behavior addition beyond the reference, not because there's real doubt about the right call.

**e. Default pip count when `target_sets` is null (§4.2).** Recommended: default to 3, matching the reference's `makeExercise()` hardcoded default — but `target_sets` is nullable in this app specifically because Sprint 8 made it optional (a user might genuinely not want to prescribe a set count up front). Confirm 3 is the right fallback versus, say, 1 (start minimal, rely on the "+ Add set" pip to grow it), since this is a product-feel call, not a technical one.

**f. History detail view for weeks-type sessions.** The old spec's §5.2 (History drill-down, still not built per §0.1) will need to display "Week N · Day" using `plan_week_id`/`plan_day.label` per §1.6 once both this spec and that one ship — not a new question, just flagging the dependency explicitly so it isn't missed when §5.2 is eventually implemented, since that spec was written before `plan_week_id` existed.

**g. Orphaned-exercise gap (old spec §8.h).** Still open, still not required to ship anything in this spec — restating only because this spec's new `notes` field on `WorkoutExercise` and the new upsert-based set-logging in §4.3 both touch the same code paths §8.h was concerned about (a session referencing an exercise that's since been deleted). No new exposure introduced, but worth re-confirming the same "Deleted Exercise" fallback convention applies once History's drill-down view is actually built.
