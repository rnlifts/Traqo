# Task 48 — Fix: Custom Exercise section breaks the sidebar's scroll layout

## Objective
Task 46 introduced a real layout regression: the Exercise Library's results list (the scrollable area showing search/filter results with thumbnails) gets squeezed down to a near-invisible sliver of height, because the new "Custom Exercise" section was appended below it as an unbounded, unconstrained block. At realistic window heights, this makes the library results area effectively disappear — which is why muscle-group filtering and thumbnails looked "broken" to the owner (the results were actually rendering correctly the whole time, just squeezed off-screen).

**This is a strict, narrow layout fix. Do not touch anything else.**

## Context
- File: `frontend/src/features/exerciseLibrary/ExerciseLibrarySidebar.tsx`.
- The sidebar is a single flex column (`display: 'flex', flexDirection: 'column', height: '100%'`, around line 121). Inside it:
  1. Search input, muscle group filter chips (fixed height, fine, unchanged).
  2. The "Results List" div (~line 199): `flex: 1, overflowY: 'auto'` — this was the ONE properly-bounded, independently-scrollable region, and it's supposed to take up all remaining vertical space.
  3. The "Create New Exercise Affordance" button (~line 305) — small, conditional, fine.
  4. **The new "Custom Exercise" section (~line 324-449, added in Task 46)** — this renders a heading, the create-form toggle button, an optionally-expanded `CustomExerciseForm`, and the full list of the user's custom exercises, with **no height cap and no `overflow` of its own**. Because it sits as a sibling *after* the `flex: 1` results div in the same column, and the whole column is `height: '100%'` with no overflow handling at the outer level either, this section just keeps growing and pushes/squeezes the `flex: 1` results area down to almost nothing to make room for itself.
- Verified directly: at a 1280×600 viewport, the results list's `clientHeight` drops to **38px** (with 714px of actual content) once the Custom Exercise section is present below it — confirmed via live DOM inspection, not guessed.
- The owner's actual screenshots show exactly this: selecting "calves" in the filter shows the Custom Exercise section immediately, with no visible calves results above it, even though the correctly-filtered results (with real thumbnails) are being fetched and rendered — just invisible due to being squeezed to a sliver.

## Requirements
1. Give the Exercise Library "Results List" region (~line 199) a reliable minimum usable height — it must not be allowed to collapse below a reasonable size (e.g. enough to show at least 2-3 result rows) no matter how much content is in the Custom Exercise section below it.
2. Give the "Custom Exercise" section its own bounded, independently-scrollable region (its own `max-height` + `overflow-y: auto`), instead of letting it grow unbounded and push everything else around. It should behave like its own self-contained scrollable list, not an ever-expanding block in the middle of the page flow.
3. Verify the fix at a realistic constrained window height (test at both 1280×720 and something shorter, e.g. 1280×600, since the bug is height-dependent and doesn't show at very tall viewports) — both the Exercise Library results and the Custom Exercise list must remain independently usable and scrollable at both sizes.
4. After the fix, re-verify: select a muscle group filter (e.g. "calves"), confirm the real filtered results with thumbnails are visibly present and not hidden below the Custom Exercise section.

## Do NOT
- Do not touch the search/filter logic (`searchQuery`, `selectedMuscleGroup`, the debounced `useEffect`, or the `exerciseLibraryApi.search()` call) — that logic is correct and was verified working; this is a pure CSS/layout containment fix.
- Do not touch `CustomExerciseForm.tsx`'s internal behavior.
- Do not touch any backend code, migrations, or schemas.
- Do not change the muscle-group filter chips, the "Create New" affordance, or any other already-working piece of this file beyond the specific layout containment described above.
- Do not refactor, rename, or reorganize anything else in this file "while you're in there" — touch only what's needed to fix the height/scroll containment.

## Acceptance criteria
- [ ] At 1280×600 (and 1280×720), the Exercise Library results list keeps a usable, visible height regardless of how many custom exercises exist.
- [ ] The Custom Exercise section scrolls independently within its own bounded area once it has enough content to overflow — it does not push/shrink the library results area.
- [ ] Selecting a muscle group filter shows visibly correct, thumbnail-bearing results without needing to scroll past the Custom Exercise section first.
- [ ] No regression to any other sidebar behavior (search, filter, create-new, custom exercise creation, "+ Add" on either section).

## Review checklist
- [ ] Confirm the fix was verified by actually resizing the browser window / checking computed heights, not just visually glancing at one screen size.
- [ ] Confirm nothing outside this one file changed.
