# Feature Spec — Sprint 12: Progress Views (History Drill-Down, Per-Exercise Trends, Volume, Est. 1RM, PRs)

**Status:** Spec-only, no code written. Grounded in the actual current codebase (`backend/src/modules/sessions/`, `backend/src/modules/workouts/`, `frontend/src/`) as it stands after the Plan Builder v2 rework, not the pre-v2 codebase the original UX report was written against.

**Traces back to:** `docs/sprints.md` Sprint 12 brief, `docs/ux-improvement-plan.md` §3.D (original research/rationale — read for "why," not "how"; its "how" predates `plan_week_id`/pip-based logging and is superseded here), `docs/requirements.md` §2.5 (the already-approved scope: per-exercise history with best set/volume/est.-1RM per session, and PR detection across heaviest weight / best est. 1RM / best volume / most reps).

**Supersedes:** `docs/feature-spec-plan-builder-v2.md` open question **f** ("History detail view for weeks-type sessions... not a new question, just flagging the dependency") — this spec is that dependency being resolved. Also closes out the "History redesign" item noted as still-open in `dev-log.md`'s most recent entry.

---

## 0. What this covers, and the one thing it deliberately doesn't

Two new user-facing views, built on data the app already fully has:

1. **Session detail drill-down** — click a row in `WorkoutHistory.tsx` → see every exercise and set actually logged in that session, in plan order, labeled with which day/week it was.
2. **Per-exercise progress view** — pick an exercise → see its entire logged history across every session it's ever appeared in: sets per session, volume trend, estimated 1RM trend, and personal records.

**Deliberately not covered here** (already shipped or separately scoped, not re-litigated):
- "Last time" prefill during active logging — already shipped (`GetPreviousPerformance`), unchanged, not touched by anything below.
- The consistency/streak calendar — that's Sprint 11 (`docs/sprints.md`), a separate frontend-only feature derived from `GetWorkoutHistory` data; nothing here blocks or duplicates it.
- Any change to `ActiveWorkout.tsx` or the pip-based logging flow — that surface was just rebuilt and live-verified in Plan Builder v2. Every design decision below was checked against "does this require touching that file," and where it would have, a different design was chosen instead (see §2.4, §6.a).

---

## 1. Data model — no migration required

**Decision, stated up front because it's the single biggest technical call in this spec:** Sprint 12 needs **zero new tables and zero new columns.** Everything it needs — `plan_week_id` on `workout_sessions`, `plan_day_id` resolution through the week-chain, `weight`/`reps`/`set_number`/`notes` on `workout_sets` — was already added by Plan Builder v2. This sprint is entirely new **read-side queries and computed views** over existing rows, plus two purely-additive response-schema extensions. Confirmed by reading every relevant model (`workout_session_model.py`, `workout_set_model.py`, `plan_week_model.py`, `plan_day_model.py`, `workout_exercise_model.py`) — nothing needed is missing.

This means `db-migration-checker` is not required for this sprint per its own trigger condition in `CLAUDE.md` ("only if the change touches schema or data") — worth flagging explicitly to whoever runs the pipeline next so it isn't invoked unnecessarily.

### 1.1 New repository methods needed (no new tables, just new queries)

- **`WorkoutSetRepository.list_finished_by_user_and_exercise(user_id: int, exercise_id: int) -> list[WorkoutSet]`** (new abstract method + `WorkoutSetRepositoryImpl` implementation). A single SQL join between `WorkoutSetModel` and `WorkoutSessionModel` (same module, not cross-module) — `WHERE session.user_id = :user_id AND session.completed_at IS NOT NULL AND set.exercise_id = :exercise_id`, ordered by `session.started_at ASC, set.set_number ASC`. This is the one query the per-exercise progress view is built on (§3).
- Everything else needed for the session detail drill-down (§2) is served by repository methods that **already exist**: `session_repository.get_by_id`, `set_repository.list_by_session`, `plan_repository.get_by_id`, `day_repository.get_by_id`, `week_repository.get_by_id`, `exercise_repository.get_by_id`.

### 1.2 Two additive (non-breaking) response-schema extensions

Both are pure additions — new optional/extra fields on existing Pydantic response models. Neither changes an existing field's name, type, or removes anything. This matters because the endpoints they extend (`GET /workout-sessions/{id}`, `GET /workout-history`) are **already consumed by shipped, live-verified code** (`ActiveWorkoutPage.tsx`, `WorkoutHistory.tsx`) that must keep working unmodified:

- `WorkoutHistoryEntry` / `WorkoutHistoryEntryResponse` gains **`session_id: int`** — needed so the history list can link to the drill-down (currently the DTO has `date`/`workout_name`/`duration_minutes` only, no id at all — a real gap, not an oversight to preserve).
- `WorkoutSessionDetailResponse` gains new fields on `.session` (`plan_name`, `day_label`, `week_number`, `duration_minutes`) — see §2.2 for the exact shape and why `.sets` itself is *not* restructured (that's the part that would risk `ActiveWorkoutPage.tsx`).

---

## 2. Session detail drill-down

### 2.1 Entry point

`WorkoutHistory.tsx`'s existing cards (date / workout / duration) each get an explicit **"View Details →"** button/link in the card's corner (not the whole card silently clickable — keeps the tap target unambiguous and gives screen readers a real accessible name: `aria-label="View details for {workout} on {date}"`). Navigates to a new route:

```
/workout-history/:sessionId  →  SessionDetailPage.tsx (new)
```

Deliberately **not** reusing `/workout-sessions/:sessionId`, which is `ActiveWorkoutPage.tsx` — a live, editable, pip-based logging surface. Overloading that route for read-only historical review would mean teaching it a whole second "finished, read-only" rendering mode inside a component that was just rebuilt and carefully re-verified; a dedicated route is one new page, zero risk to the existing one.

### 2.2 Backend: extend `GetWorkoutSessionDetail` in place

Current shape only returns `session` (id/user_id/workout_plan_id/plan_day_id/started_at/completed_at) and a flat `sets` list (id/exercise_id/set_number/weight/reps/notes) — no names, no day/week label, no duration. Extend the use case's constructor to take the additional repositories it needs to resolve those (mirrors the dependency count `StartWorkout` already has):

```python
class GetWorkoutSessionDetail:
    def __init__(
        self,
        session_repository: WorkoutSessionRepository,
        set_repository: WorkoutSetRepository,
        plan_repository: WorkoutPlanRepository,
        day_repository: PlanDayRepository,
        week_repository: PlanWeekRepository,
        exercise_repository: ExerciseRepository,  # cross-module, same direction AddWorkoutSet already uses
    ): ...
```

`execute()` resolves, after the existing ownership check:
- `plan = plan_repository.get_by_id(session.workout_plan_id)` → `plan_name = plan.name if plan else "Deleted Plan"` (identical fallback convention to `GetWorkoutHistory`).
- `day = day_repository.get_by_id(session.plan_day_id)` → `day_label = day.label if day else "Deleted Day"` (same convention, new instance of it).
- If `session.plan_week_id` is set: `week = week_repository.get_by_id(session.plan_week_id)` → `week_number = week.week_number if week else None`. Null for `days`-type plans (unchanged meaning from Plan Builder v2 §1.6).
- `duration_minutes = int((completed_at - started_at).total_seconds() // 60)` if `completed_at` is set, else `None` (session still in progress — see §2.4).
- For each set's `exercise_id`: resolve `exercise_name` via `exercise_repository.get_by_id`, called once per **distinct** exercise id in the session (typically 1–6, bounded by the day's exercise count) — not once per set. Fallback `"Deleted Exercise"` if the lookup returns `None` (see §2.5 for why this fallback is required, not hypothetical).

**Response schema — new, additive-only:**

```python
class WorkoutSetWithExerciseResponse(BaseModel):
    id: int
    exercise_id: int
    exercise_name: str
    set_number: int
    weight: float
    reps: int
    notes: str

class WorkoutSessionDetailResponse(BaseModel):
    class Session(BaseModel):
        id: int
        workout_plan_id: int
        plan_name: str                    # NEW
        plan_day_id: int | None
        day_label: str | None             # NEW
        plan_week_id: int | None          # NEW (already on the domain entity, just never surfaced)
        week_number: int | None           # NEW
        started_at: datetime
        completed_at: datetime | None
        duration_minutes: int | None      # NEW

    session: Session
    sets: list[WorkoutSetWithExerciseResponse]   # NEW item type, same field name
```

**Why a *new* `WorkoutSetWithExerciseResponse` type instead of adding `exercise_name` to the existing shared `WorkoutSetResponse`:** `WorkoutSetResponse` is also the return type of `POST /workout-sessions/{id}/sets` and used implicitly by `DELETE .../sets/{set_id}`'s 204 (no body, but same conceptual type) — the pip-logging endpoints from Plan Builder v2. Adding a required `exercise_name` field there would force `AddWorkoutSet`'s route handler to also resolve and return it on every single set log/edit during active logging, for no reason (the frontend already has the exercise name locally at that point via `planExercises`). Keeping it as a distinct type scoped only to `WorkoutSessionDetailResponse.sets` means `POST`/`DELETE /sets` are **completely untouched** — zero behavioral change, zero re-verification burden on that surface.

### 2.3 Frontend: reuse the day-matching logic, don't duplicate it

`ActiveWorkoutPage.tsx` already contains proven, live-verified logic for "given a session's `plan_day_id` and the plan's detail response, find the matching day whether the plan is `days`-type (`planDetail.days`) or `weeks`-type (search inside `planDetail.weeks[].days`), and build a `Week N · Day` label when applicable." `SessionDetailPage.tsx` needs the exact same resolution. Per `CLAUDE.md`'s "avoid duplicate code," extract it once rather than copy-pasting a second instance:

```
frontend/src/features/sessions/sessionDayResolver.ts (new)
  resolveSessionDay(planDetail: WorkoutPlanDetail, planDayId: number | null):
    { matchingDay: PlanDay | null; dayLabel: string }
```

`ActiveWorkoutPage.tsx` is refactored to call this helper instead of its inline block — **pure extraction, no behavior change** — and the plan-builder-v2 live-verification checklist for weeks-type session loading (dev-log's "Weeks-type session ... now loads with the correct 'Week N · Day' heading") should be re-run after the extraction specifically because that's exactly the code path being moved, per this project's live-verification standard (memory: `feedback_live_verification_standard.md`).

`SessionDetailPage.tsx` flow:
1. `workoutSessionsApi.getSessionDetail(sessionId)` — same client method as today, now returning the richer payload from §2.2.
2. `getWorkoutPlanDetail(session.workout_plan_id)` — same call `ActiveWorkoutPage.tsx` already makes.
3. `resolveSessionDay(planDetail, session.plan_day_id)` → `matchingDay`.
4. Render: header (plan name, `week_number`/day label via the resolved helper or the new `session.week_number`/`day_label` fields directly — either source agrees by construction; using the session-response fields directly is simpler here since there's no live-editing need, so prefer `session.day_label`/`week_number` over re-deriving from plan detail, and use `matchingDay` only for the exercise list/targets). Then one card per exercise in `matchingDay.exercises` (already ordered, already carries `target_sets`/`target_reps`/`target_weight`/`notes`), each showing:
   - Exercise name (as a `<Link to="/exercises/{exercise_id}/progress">` — see §5 for why this cross-link is worth the two lines of code).
   - Target line, same "3 sets × 8 reps × 135 lbs" partial-omission formatting already established in `PlanDetail.tsx`/`ActiveWorkout.tsx`.
   - Every set from `sessionDetail.sets` where `exercise_id` matches, in `set_number` order: `Set {n}: {weight} × {reps}` + notes in italics if present.
   - `"No sets logged for this exercise"` empty-state (`.empty-state`) if zero sets — genuinely useful information for a completed-session review (shows a planned exercise that got skipped), not just a leftover pattern from the live-logging screen.
5. Fully read-only: no pips, no edit/delete affordances, no rest timer. This is a review screen, not a resumable one.

### 2.4 In-progress session edge case

Nothing prevents a user from directly navigating to `/workout-history/:sessionId` for a session that hasn't been finished yet (the route isn't reachable from `WorkoutHistory.tsx`, which only lists finished sessions, but a typed/bookmarked URL could still hit it). Rather than error, show a small banner above the read-only content: *"This workout is still in progress."* with a **"Continue Workout →"** button linking to `/workout-sessions/{sessionId}` (the live logging route) — the sets logged so far still render normally below it, just without a duration (shown as "In progress" instead of a number). Cheap, avoids a dead end, consistent with the app's general pattern of turning edge cases into a clear next action rather than a blank error.

### 2.5 The pre-existing "orphaned exercise" gap, and why it matters here

`DeleteExercise`'s guard (`is_used_in_any_plan`) only checks `workout_exercises` (plan-level), never `workout_sets` (session-level history). Because removing an exercise *from a plan* (not deleting the whole plan) has no history guard either, it's already possible today to: log sets against an exercise, later remove that exercise from the plan, then delete the exercise outright — leaving `workout_sets.exercise_id` pointing at a row that no longer exists. This was already flagged as open item **g** in `docs/feature-spec-plan-builder-v2.md` and is **not fixed here** (out of scope for progress views) — but both new views in this spec read exercise names for historical sets, so they're the first things that will actually *hit* this gap in practice. The `"Deleted Exercise"` fallback in §2.2 is the required defensive handling for it, matching the established `"Deleted Plan"`/`"Deleted Day"` convention — not new risk, just the first place it becomes visibly load-bearing. Restating the underlying gap here so it isn't lost twice.

**Consequence for exercise progress (§3):** a deleted exercise can never be selected from the live exercise list (§3.1 sources its picker from `GET /api/exercises`, which only returns non-deleted exercises), so its historical sets remain visible only through session-detail drill-down (as `"Deleted Exercise"`, non-clickable — no progress view to link to since the exercise no longer exists to fetch progress for). This is a deliberate, stated scope boundary, not an oversight: a full "browse progress for a deleted exercise" feature would require actually fixing the orphaned-exercise gap first, which is a separate, pre-existing item.

---

## 3. Per-exercise progress view

### 3.1 Entry point

`ExerciseList.tsx` gets a **"View Progress"** button/link per exercise row (alongside the existing "Delete" button), navigating to:

```
/exercises/:exerciseId/progress  →  ExerciseProgressPage.tsx (new)
```

No new top-level nav item in `Layout.tsx`. The nav already carries 5 items and Sprint 7 had to add a hamburger breakpoint for exactly that reason (`ux-improvement-plan.md` item 7) — adding a 6th persistent item for a feature reachable in one click from an already-existing list is worse information architecture than it's worth. Reachable from: the exercise list (primary entry) and from any exercise name inside a session detail drill-down (§2.3, secondary entry) and from any session entry inside the progress view itself (§3.4, tertiary — click a past session's date to jump to its full drill-down).

### 3.2 Backend: new use case, new route

```python
# modules/sessions/application/use_cases/get_exercise_progress.py

@dataclass
class ProgressSet:
    set_number: int
    weight: float
    reps: int
    notes: str
    estimated_1rm: float
    is_weight_pr: bool
    is_reps_pr: bool
    is_e1rm_pr: bool

@dataclass
class ProgressSessionEntry:
    session_id: int
    date: datetime
    sets: list[ProgressSet]
    volume: float              # Σ weight × reps across this session's sets of this exercise
    is_volume_pr: bool

@dataclass
class PersonalRecords:
    heaviest_weight: float | None
    heaviest_weight_date: datetime | None
    best_estimated_1rm: float | None
    best_estimated_1rm_date: datetime | None
    best_volume: float | None
    best_volume_date: datetime | None
    most_reps: int | None
    most_reps_date: datetime | None

@dataclass
class ExerciseProgressResult:
    exercise_id: int
    exercise_name: str
    sessions: list[ProgressSessionEntry]   # chronological ascending (oldest first) — see note below
    personal_records: PersonalRecords


class GetExerciseProgress:
    def __init__(
        self,
        session_repository: WorkoutSessionRepository,
        set_repository: WorkoutSetRepository,
        exercise_repository: ExerciseRepository,   # cross-module, same direction as AddWorkoutSet
    ): ...

    def execute(self, user_id: int, exercise_id: int) -> ExerciseProgressResult:
        # 1. Ownership check — same pattern as every other exercise-scoped use case
        exercise = self.exercise_repository.get_by_id(exercise_id)
        if not exercise:
            raise ExerciseNotFoundError(...)
        if exercise.user_id != user_id:
            raise UnauthorizedExerciseAccessError(...)

        # 2. One query (the new repository method from §1.1), already chronological
        sets = self.set_repository.list_finished_by_user_and_exercise(user_id, exercise_id)

        # 3. Group into sessions (dict preserves first-seen order, which is chronological
        #    because `sets` is already ordered by session.started_at)
        sessions_map: dict[int, list[WorkoutSet]] = {}
        for s in sets:
            sessions_map.setdefault(s.workout_session_id, []).append(s)

        entries = []
        running_max_weight = running_max_e1rm = running_max_volume = None
        running_max_reps = None

        for session_id, session_sets in sessions_map.items():
            session = self.session_repository.get_by_id(session_id)  # K calls, K = distinct
                                                                        # sessions containing this
                                                                        # exercise — small, bounded
            progress_sets = []
            volume = sum(s.weight * s.reps for s in session_sets)

            for s in session_sets:
                e1rm = round(s.weight * (1 + s.reps / 30), 1)   # Epley
                is_weight_pr = running_max_weight is not None and s.weight > running_max_weight
                is_reps_pr = running_max_reps is not None and s.reps > running_max_reps
                is_e1rm_pr = running_max_e1rm is not None and e1rm > running_max_e1rm

                progress_sets.append(ProgressSet(..., estimated_1rm=e1rm,
                                                  is_weight_pr=is_weight_pr,
                                                  is_reps_pr=is_reps_pr,
                                                  is_e1rm_pr=is_e1rm_pr))

                running_max_weight = max(running_max_weight or 0, s.weight)
                running_max_e1rm = max(running_max_e1rm or 0, e1rm)
                running_max_reps = max(running_max_reps or 0, s.reps)

            is_volume_pr = running_max_volume is not None and volume > running_max_volume
            running_max_volume = max(running_max_volume or 0, volume)

            entries.append(ProgressSessionEntry(session_id=session_id, date=session.started_at,
                                                 sets=progress_sets, volume=volume,
                                                 is_volume_pr=is_volume_pr))

        personal_records = build_personal_records(entries)  # simple final pass, see below
        return ExerciseProgressResult(exercise_id, exercise.name, entries, personal_records)
```

**Why the first-ever data point is never flagged as a PR:** running maxes start at `None`, not `0`, and a value only counts as a PR if it strictly beats an *existing* running max. A user's very first logged set for an exercise has nothing to beat — it establishes the baseline, not a record. This avoids meaningless "PR!" badges on someone's first-ever set of everything, which would cheapen the badge everywhere else. **This is distinct from the `personal_records` summary** (§3.3), which always reflects the *current* best-of-all-time once at least one session exists — a user with exactly one logged session for an exercise sees real numbers in their PR summary tiles (their one session's numbers, correctly labeled as their current best), even though that session's individual sets carry no PR badges.

**Why `list_finished_by_user_and_exercise` + per-distinct-session `get_by_id`, not one giant join returning everything:** the join already filters to exactly the sets that matter (this exercise, this user, finished sessions only) — the `get_by_id` calls that follow are bounded by *how many distinct sessions contain this exercise*, not by the user's total session count. This is a meaningfully better bound than the N+1-over-everything pattern `GetWorkoutHistory` already uses and gets away with (looping over *all* finished sessions to look up each one's plan) — same acceptable-tradeoff philosophy, applied more precisely here since the exercise filter already did the expensive narrowing at the database level.

**Route:** `GET /api/exercises/{exercise_id}/progress`. Registered the same way `GET /api/workout-history` already is — directly on `app.py` via `app.add_api_route(...)`, not on the sessions router (whose prefix is `/api/workout-sessions`) and not on the exercises router (which has zero dependency on the sessions module today, and should stay that way — the use case lives in `modules/sessions/` and depends on `modules/exercises/`'s repository interface, the same direction `AddWorkoutSet` already established; putting the route on the exercises router would require the reverse, unprecedented direction). This is an exact repeat of the pattern `dev-log.md` documents for Sprint 5's history route, not a new technique.

### 3.3 Personal records — what counts, and the four categories

Per `docs/requirements.md` §2.5 (already approved, not re-decided here): **heaviest weight, best estimated 1RM, best volume (per session), most reps in a single set** — four independent categories, each tracked separately because a session can set one without the others (a high-rep set at moderate weight can be a reps PR without being a weight PR; a long, moderate-weight session can be a volume PR without any single set being one).

`PersonalRecords` is built as a final pass over the chronological `entries` after the main loop (or accumulated inline during it — implementation detail, coder's call), tracking the final running max **and the date it was set** for each of the four categories. If `entries` is empty, all fields are `None` and the frontend shows an empty state instead of the summary card (§3.5).

### 3.4 Estimated 1RM — formula and tracking granularity

**Epley formula, as originally suggested and not changed:** `estimated_1rm = weight × (1 + reps / 30)`. It's the simplest, most widely recognized formula in this category (also what Hevy uses per the research already cited in `ux-improvement-plan.md`), and there's no concrete reason surfaced during this spec to prefer Brzycki or Lombardi instead — Epley is confirmed, not just carried forward by default.

**Tracked per session, not best-set-only:** `docs/requirements.md` §2.5 explicitly says "history of sets across all finished sessions: best set per session... and an estimated one-rep max" — a single current-best number would throw away the trend, which is the entire point of a *progress* view. Each session's entry reports the estimated 1RM of its **best set** (the set with the highest `estimated_1rm` within that session, not necessarily the heaviest raw weight — a higher-rep set can have a higher e1RM than a low-rep heavier one), and the chart in §3.5 plots that per-session value across time.

### 3.5 Volume trend and the chart — decision: no new dependency

**Definition:** volume for a session = `Σ (weight × reps)` across every set of the selected exercise logged in that session. Standard definition, matches what was already suggested.

**Chart library decision — a custom lightweight SVG component, not Recharts.** The original report suggested Recharts; re-evaluated against the current state of the project (`frontend/package.json` confirmed to have exactly `axios`, `react`, `react-dom`, `react-router-dom` as runtime dependencies — zero charting libraries, zero UI-kit dependencies of any kind). Reasons to override the original suggestion:
- Recharts pulls in a real dependency tree (it wraps D3 internals) for what this feature needs exactly once: a single line-chart type, plotted against a handful of data points (a personal fitness log will realistically have dozens to low hundreds of sessions per exercise, never thousands) — there's no data-volume or interactivity requirement here that needs a general-purpose charting engine.
- This project has shown a consistent bias toward not adding dependencies until something concrete requires them (frontend test tooling was explicitly deferred in Sprint 8 rather than added unilaterally; the whole dependency list today is four packages). Adding the project's first UI dependency for one chart type on one screen doesn't clear that bar.
- A hand-rolled chart trivially themes with the app's existing CSS custom properties (`--accent`, `--success`, `--customize`) with zero extra theming layer, whereas Recharts needs its own prop-based styling API layered on top of the token system.

**`frontend/src/components/TrendChart.tsx` (new):**
```tsx
interface TrendChartDataPoint {
  date: string;
  value: number;
  isPR?: boolean;
}
interface TrendChartProps {
  data: TrendChartDataPoint[];
  label: string;        // e.g. "Estimated 1RM (lbs)"
  color?: string;        // defaults to var(--accent)
}
```
Requirements (mechanics left to the coder, these are the fixed constraints):
- Responsive width (SVG `viewBox` + `width="100%"`), fixed height (~240px).
- Line connecting points in date order, small dot per point.
- Points where `isPR` is true get a visually distinct marker — per §3.6's color decision, filled with the existing `--customize` token plus a non-color glyph, not a new hue.
- Per-point tooltip: minimum viable is a native SVG `<title>` element per point (zero extra JS, always available via hover and the accessibility tree, no dependency) — a richer positioned-label-on-hover/tap treatment is a nice-to-have, not required.
- Empty state (0 sessions): `"No sets logged for {exercise name} yet. Log a workout with this exercise to start tracking progress."`
- Single-data-point state (exactly 1 session): don't render a misleading one-point "line" — show the single session's numbers (still meaningful) with a note instead of the chart: `"Log this exercise in another session to see a progress trend."`

**On the exercise progress page**, a metric-selector row (toggle buttons matching the existing chip pattern already established in `CreatePlanStep1.tsx`'s length picker) switches what `TrendChart` plots: **"Est. 1RM"** (default) / **"Volume"** / **"Best Weight"** — one chart, three interchangeable series, rather than three stacked charts with different scales competing for space.

### 3.6 PR badges — surfacing, color, and accessibility

**Surfacing, concretely:**
1. **"Personal Records" summary card** at the top of the exercise progress page, below the header, above the chart: four stat tiles (Heaviest Weight / Best Est. 1RM / Best Session Volume / Most Reps in a Set), each showing the value and the date it was achieved, using the existing `.card` styling. Hidden entirely if `personal_records` is empty (zero sessions).
2. **Inline badges** on individual sets in the chronological session list below the chart (see §3.7) — a small pill next to any set where `is_weight_pr`/`is_reps_pr`/`is_e1rm_pr` is true.
3. **Session-level badge** next to a session's volume figure when `is_volume_pr` is true (volume is a session aggregate, not a single-set value, so it can't live on a set's badge).
4. **No separate global "all my PRs across every exercise" page** in this sprint — scoped to per-exercise, matching what `GetExerciseProgress` returns. A cross-exercise PR digest (e.g. on the Dashboard) is a reasonable future addition but isn't implied by "Sprint 12 — Progress Views" and isn't built here.

**Color: reuse `--customize` (`#b45309`, amber), not a fifth token.** `docs/design-spec-ui-refresh.md` already established four semantic tokens roughly 90°+ apart in hue (indigo=active, green=done, amber=customized, red=danger) specifically to keep them distinguishable at a glance, and flagged that a fifth close-hue addition risks collision. Rather than invent a fifth color needing its own contrast audit and colorblindness cross-check, reuse `--customize`/`--customize-bg`/`--customize-border`'s existing soft-badge pattern for PR badges: amber/gold already carries a near-universal "achievement" association independent of this app's "customized week" meaning, and the two contexts (plan builder vs. progress view) never appear on screen together, so there's no real on-screen collision risk for a user — only a token-reuse decision at the implementation level, which is exactly the kind of reuse `docs/design-spec-ui-refresh.md`'s own implementation notes recommend (single source of truth for a color meaning, not a proliferating token list).
- **Never color alone**, per the same WCAG 1.4.1 discipline already applied throughout this project's other specs: every PR badge pairs the amber treatment with a literal glyph + text (e.g. a small trophy/star mark and the word "PR"), plus a stateful `aria-label` on the badge itself: `aria-label="New personal record: heaviest weight"` / `"New personal record: most reps"` / etc. — not just a colored pill with no accessible name.

### 3.7 Chronological session list (below the chart)

Reverse-chronological (most recent first — the list is for scanning recent history, unlike the chart which needs ascending order for its x-axis; the backend already returns ascending, the frontend does a trivial `.slice().reverse()` for this list). Each entry:
- Date (clickable → `/workout-history/{session_id}`, the drill-down from §2 — completes the bidirectional link between the two new views).
- Every set logged that session for this exercise: `Set {n}: {weight} × {reps}` (+ notes if present) with inline PR badges per §3.6.
- Session volume, with its own PR badge if applicable.
- Estimated 1RM of the session's best set.

---

## 4. API surface summary

| Method | Path | Status | Change |
|---|---|---|---|
| `GET` | `/api/workout-history` | existing | `WorkoutHistoryEntryResponse` gains `session_id` (additive) |
| `GET` | `/api/workout-sessions/{session_id}` | existing | `WorkoutSessionDetailResponse.session` gains 4 fields; `.sets` items switch to a new `WorkoutSetWithExerciseResponse` type (additive at the response-model level; `POST`/`DELETE /sets` untouched) |
| `GET` | `/api/exercises/{exercise_id}/progress` | **new** | `GetExerciseProgress`, registered directly on `app.py` per the established Sprint-5 route-override pattern |

No changes to any `POST`/`PUT`/`DELETE` endpoint anywhere in this spec — everything here is additive reads.

---

## 5. Frontend surface summary

| File | Status | Purpose |
|---|---|---|
| `frontend/src/pages/SessionDetailPage.tsx` | new | Session drill-down page (§2) |
| `frontend/src/features/sessions/SessionDetail.tsx` | new | Read-only per-exercise card layout, sibling to `ActiveWorkout.tsx`/`WorkoutHistory.tsx` |
| `frontend/src/features/sessions/sessionDayResolver.ts` | new | Extracted day/week resolution helper, shared by `ActiveWorkoutPage.tsx` (refactored to use it) and `SessionDetailPage.tsx` (§2.3) |
| `frontend/src/pages/ExerciseProgressPage.tsx` | new | Per-exercise progress page (§3) |
| `frontend/src/features/progress/ExerciseProgress.tsx` | new | PR summary card, metric-selector, chart, session list (§3) |
| `frontend/src/components/TrendChart.tsx` | new | Custom SVG line chart, no new dependency (§3.5) |
| `frontend/src/api/progressApi.ts` | new | `getExerciseProgress(exerciseId)` → `GET /exercises/{id}/progress` |
| `frontend/src/api/workoutSessionsApi.ts` | modified | `WorkoutHistoryEntry`/`WorkoutSessionDetailResponse` TS interfaces gain the new optional fields from §1.2/§2.2 (additive) |
| `frontend/src/features/sessions/WorkoutHistory.tsx` | modified | Each card gains a "View Details →" link to `/workout-history/:sessionId` |
| `frontend/src/features/exercises/ExerciseList.tsx` | modified | Each row gains a "View Progress" link to `/exercises/:exerciseId/progress` |
| `frontend/src/pages/ActiveWorkoutPage.tsx` | modified (refactor only) | Inline day/week resolution block extracted to `sessionDayResolver.ts` — no behavior change, re-verify per §2.3 |
| `frontend/src/App.tsx` | modified | Two new routes: `/workout-history/:sessionId`, `/exercises/:exerciseId/progress`, both `ProtectedRoute`-wrapped |

New `progress` feature folder (`frontend/src/features/progress/`) rather than folding this into the existing `sessions` or `exercises` feature folders — it's a genuinely distinct concern (cross-session analytics) from either "run a session" or "manage my exercise list," consistent with this project's feature-based frontend architecture (`CLAUDE.md`).

---

## 6. Open questions — product-level calls, not decided here

Everything else in this document is a technical/UX call made directly, per this project's PM-orchestration pipeline. These two are flagged because reasonable owners could genuinely land differently, and one of them would touch a second, already-shipped surface if answered "yes":

**a. Live "New PR!" notification during active logging (Hevy-style), now vs. later.** `docs/ux-improvement-plan.md` §4 specifically cites Hevy's "live PR" feature (fires a notification the moment a set beats a prior best, mid-workout) as an established, well-liked competitor pattern. This spec deliberately does **not** build that — PR detection here is entirely a look-back feature, surfaced only in the progress view and session drill-down, computed on read with nothing persisted (§3.2's `is_*_pr` fields are computed fresh every request, not stored). Building a live version would mean running the same comparison at the moment `AddWorkoutSet`/`LogWorkoutSet` is called (during active, pip-based logging) and surfacing a toast from within `ActiveWorkout.tsx` — the one surface this spec otherwise avoids touching entirely, specifically because it was just rebuilt and re-verified in Plan Builder v2. Confirm whether that's worth doing now (as a small follow-up immediately after this sprint, low incremental cost since the comparison logic already exists here and would just be reused) or later.

**b. Whether an editable/deleted set should retroactively change PR history the way this design implies.** Because PR flags are computed fresh from current data on every read (not persisted at the moment a set was logged), editing or deleting a past set via `LogWorkoutSet`'s upsert semantics or `DeleteWorkoutSet` (both from Plan Builder v2) will change which historical sets show as PRs the next time the progress view is loaded — e.g., deleting what used to be a PR set silently un-flags it and may promote an earlier or later set to PR status instead. This is the technically consistent behavior (there's no stale "it was a PR when I logged it, even though I've since corrected the number" state to manage) and was chosen deliberately over persisting an `is_pr` flag at write-time specifically to avoid that staleness — but it does mean PR badges are not an immutable historical record of what felt like an achievement in the moment, they're always "your current best-known history as of right now." Confirm this is the intended framing, versus wanting PR status to be a permanent, point-in-time record that a later edit can't retroactively erase.
