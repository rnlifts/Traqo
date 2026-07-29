# Task 36 — Frontend: exercise library sidebar in Plan Builder, remove standalone Exercises page

## Objective
Add a right-hand sidebar panel to Plan Builder for browsing/searching/filtering the new exercise library (built in Task 35) and adding exercises straight into the plan being built, with a YouTube-derived thumbnail per exercise. Remove the standalone "Exercises" page and its nav link, since it becomes redundant once this exists.

Depends on Task 35 (`GET /api/exercise-library`, `GET /api/exercise-library/muscle-groups`).

## Context — read fully before starting, several existing pieces stay unchanged

### What Plan Builder's exercise-adding flow looks like today
`frontend/src/features/workoutPlans/PlanBuilder.tsx`:
- `exerciseName` (line 91) is a plain string state, bound to a bare text `<input>` inside an "Add Exercise Form" (~line 1221 onward) that also has Sets/Reps/Weight/Duration fields — the whole thing submits together via `handleAddExercise` (line 372).
- `handleAddExercise` (line 372-...): finds an existing exercise by exact name match in `availableExercises`, or calls `exercisesApi.create(exerciseName)` to make a new one — **this is the existing per-user "materialize an exercise" mechanism you will reuse, unchanged.**
- There is currently **zero autocomplete or suggestions** on this text field — it's a bare input.

### Recommended integration (this is a design decision — flagged clearly so it can be corrected if it doesn't match intent)
Rather than building a second, separate autocomplete UI on the existing bare text field, make the **new sidebar's own search box be the "type and get suggestions" experience** the product owner asked for. Clicking "+" on a result in the sidebar should:
1. Fill `exerciseName` with that exercise's name (open the "Add Exercise Form" if it isn't already open).
2. **Not auto-submit.** Let the user still see/set Sets/Reps/Weight/Duration via the existing form fields exactly as they do today, then submit via the existing "Add" button/`handleAddExercise`.

This means `handleAddExercise` and the target-configuration fields need **zero changes** — the sidebar is purely a better way to find and populate the name, not a replacement for the add mechanism. If this isn't the desired interaction (e.g. the product owner wants "+" to add immediately with no target-configuration step), that's a product call to confirm before or during implementation — don't guess past this without checking, since it changes what "+" actually does.

### What's being removed, and why it's safe
- `frontend/src/components/Layout.tsx:14` — the `{ path: '/exercises', label: 'Exercises', Icon: DumbbellIcon }` nav entry.
- `frontend/src/App.tsx` — the `/exercises` route and its `ExercisesPage` import (lines ~6, ~38-42). **Do not touch the separate `/exercises/:exerciseId/progress` route** (~line 102) — that's a different page (`ExerciseProgressPage`) and stays fully intact; it's already independently reachable from Workout History (`SessionDetail.tsx` links to it directly), so removing the list page doesn't strand it.
- `frontend/src/features/exercises/ExerciseList.tsx` and `CreateExerciseForm.tsx` — no longer referenced by any route after the above; delete them (verify nothing else imports them first).
- The delete-an-exercise capability that lived on that page is being dropped for now (product decision — it only ever applied to exercises never used in any plan anyway, per `ExerciseInUseError`'s guard in the backend, which stays untouched). Do not try to rehome the delete button somewhere else — this was an explicit call to drop it, not an oversight.

## Requirements

### 1. API client
New file or addition to an existing api file, e.g. `frontend/src/api/exerciseLibraryApi.ts`:
```ts
export interface LibraryExercise {
  id: number;
  name: string;
  muscle_group: string;
  equipment: string | null;
  thumbnail_url: string | null;
}

async function search(q: string, muscleGroup?: string): Promise<LibraryExercise[]>
async function getMuscleGroups(): Promise<string[]>
```

### 2. Sidebar panel component
New feature folder `frontend/src/features/exerciseLibrary/` (new module, not mixed into `features/exercises/`, matching the backend's module separation). Build a panel with:
- A search input — debounce it (~300-400ms, matching the pattern already established in `RegisterPage.tsx`'s username-availability check) so it doesn't fire a request per keystroke.
- Filter chips for muscle group, **rendered dynamically from `getMuscleGroups()`**, not hardcoded — whatever the backend returns is what shows up (this will look different from any earlier mockup's fixed 7-chip row, and that's expected — the real seed data uses a different, more granular taxonomy).
- Results list: thumbnail (or a generic placeholder icon when `thumbnail_url` is null — check if a suitable placeholder already exists among `frontend/src/components/icons.tsx`'s icons, e.g. reuse `DumbbellIcon`, before adding a new asset), name, muscle group, and a "+" button per result.
- "+" click behavior: per the Context section above — fill in `exerciseName` in the parent `PlanBuilder`, open the add form if closed. This means the sidebar component needs some way to communicate back up to `PlanBuilder` (a callback prop, e.g. `onSelectExercise: (name: string) => void`).
- A "Create New Exercise" affordance for when the desired exercise isn't in the library — this can simply pre-fill the sidebar's current search text into `exerciseName` and open the form, same mechanism as a "+" click, just without a specific library match.

### 3. Wire it into `PlanBuilder.tsx`
Add the panel to the Plan Builder layout (right-hand side, matching the general shape of the mockup shared earlier — search + filters + scrollable results list). It should be visible while editing a plan day, since it needs to know which day is currently active (`activeDayIndex` / `getActiveDays()`, already present in `PlanBuilder.tsx`) to know where a "+" click's follow-up "Add" submission will land — this is unchanged from today's behavior, just confirming the sidebar doesn't need to duplicate day-selection logic.

### 4. Nav/page removal
Per Context above: remove the nav entry, the route, and delete the now-unreferenced `ExerciseList.tsx`/`CreateExerciseForm.tsx` files. Double-check nothing else in the codebase imports them before deleting (grep first).

## Do NOT
- Do not touch `/exercises/:exerciseId/progress`, `ExerciseProgressPage.tsx`, or anything under `frontend/src/features/progress/` — progress viewing is unaffected and stays reachable via Workout History.
- Do not change `handleAddExercise` or the Sets/Reps/Weight/Duration fields' behavior — the sidebar only ever populates the name field, per the Context decision above.
- Do not hardcode a muscle-group filter list — always derive it from the API.
- Do not try to rebuild delete-an-exercise capability anywhere — explicitly dropped.
- Do not build a second, separate autocomplete on the old bare text field — the sidebar's search is the one "type and see suggestions" experience.

## Acceptance criteria
- [ ] Plan Builder shows the new sidebar with a working search box, muscle-group filter chips (matching whatever's actually in the seeded backend data), and a results list with thumbnails.
- [ ] Typing `"lat pull down"` in the sidebar search surfaces a fuzzy-matched result sharing only some words (verify against whatever real seeded data demonstrates this, per Task 35's acceptance criteria).
- [ ] Clicking "+" on a result fills the exercise name into the Add Exercise Form (opening it if closed) without submitting — user still sets Sets/Reps/Weight/Duration and submits normally, and the exercise is added to the currently active day exactly as it works today.
- [ ] Filtering by a muscle-group chip narrows results correctly.
- [ ] An exercise with no `video_url`/thumbnail shows a sensible placeholder, not a broken image.
- [ ] The "Exercises" link is gone from the left nav; visiting `/exercises` directly no longer resolves to the old list page.
- [ ] `/exercises/:exerciseId/progress`, reached via Workout History → a past session → an exercise name, still works exactly as before.
- [ ] No TypeScript errors; no dead imports left behind after deleting the old exercises-list feature files.

## Review checklist
- [ ] `ExerciseList.tsx`/`CreateExerciseForm.tsx` deletion was verified safe (grepped for other importers) before removing.
- [ ] Search is debounced, matching the established pattern from `RegisterPage.tsx`.
- [ ] Sidebar component lives in its own new feature folder, not merged into the old (soon-partially-removed) `features/exercises/`.
- [ ] No regression to existing Plan Builder functionality (target-sets/reps/weight editing, day switching, etc.) — this task only adds a new panel and a removal elsewhere, it shouldn't touch unrelated Plan Builder logic.
