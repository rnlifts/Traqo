# Task 38 — "Create New Exercise" should never disappear just because fuzzy search found something

## Objective
Fix a real gap found in live use: `ExerciseLibrarySidebar.tsx`'s "Create New: '{searchQuery}'" affordance only renders when `results.length === 0` (~line 264). But fuzzy/substring search (built in Task 35) can legitimately return low-relevance matches for almost any query — e.g. searching "inch worm" returns "Deadlift from 2 Inch Block" (shares the word "inch") even though it's not remotely what the user wanted. Because that counts as a non-empty result set, the create-custom option vanishes entirely, leaving no way to add "Inchworm" as a custom exercise at all.

## Context
- `frontend/src/features/exerciseLibrary/ExerciseLibrarySidebar.tsx` — the relevant block:
  ```tsx
  {!loading && results.length === 0 && searchQuery.trim() && (
    <button onClick={handleCreateNew} ...>
      Create New: "{searchQuery}"
    </button>
  )}
  ```
- `handleCreateNew` (referenced ~line 74 per earlier reading) calls `onSelectExercise(searchQuery)`, which — after Task 37 — instantly adds the typed name as a new custom exercise with default targets, same as picking a real match. That mechanism is correct and doesn't need to change; only the *visibility condition* of the button is wrong.
- This isn't a search-quality problem to solve by tightening the fuzzy-matching algorithm further (diminishing returns, risk of losing legitimate matches elsewhere) — the actual fix is simpler: the "make your own" escape hatch should never depend on whether search happened to return something.

## Requirements
1. Change the condition so "Create New: '{searchQuery}'" shows whenever there's a non-empty search query and the list isn't loading — **regardless of whether `results` is empty or not**. It should appear alongside real results, not only in their absence.
2. To avoid showing a pointless "Create New: 'Deadlift'" when "Deadlift" is already an exact match sitting right above it, suppress the button only in the specific case where the typed query case-insensitively exact-matches one of the current result names — not merely because results exist. (I.e. the fix is "always show unless a real result is literally an exact-name match," not "always show only when results are empty" and not "always show no matter what.")
3. Position it clearly (e.g. below the results list, as it already is) so it doesn't compete visually with real matches — it's a fallback, not a promoted option.

## Do NOT
- Do not change the fuzzy-search scoring/matching logic itself (Task 35's `score_exercise_match`) — this is a frontend visibility fix, not a backend search-quality fix.
- Do not remove the exact-match suppression case (requirement 2) — without it, every search would show a redundant "Create New" button even when the real thing is already right there in the results.

## Acceptance criteria
- [ ] Searching "inch worm" (or anything with no real match but some loose fuzzy overlap) shows both the loose/irrelevant fuzzy results *and* a "Create New: 'inch worm'" button — clicking it adds "inch worm" as a custom exercise.
- [ ] Searching an exact existing exercise name (e.g. "Squat," assuming it's in the library) does **not** show a redundant "Create New: 'Squat'" button alongside the real "Squat" result.
- [ ] Searching something with partial-but-not-exact fuzzy matches (e.g. typing a synonym that surfaces related-but-differently-named results) still shows "Create New" alongside those results.
- [ ] Clearing the search box hides the button (unchanged — still gated on `searchQuery.trim()` being non-empty).
- [ ] No TypeScript errors.

## Review checklist
- [ ] The exact-match check is case-insensitive (e.g. typing "squat" shouldn't show "Create New: 'squat'" if "Squat" is already an exact result, just because casing differs).
- [ ] No regression to Task 37's instant-add behavior for the Create New path.
