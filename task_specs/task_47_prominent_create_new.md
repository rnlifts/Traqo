# Task 47 — Frontend: make "Create New" instantly visible, and wire it to the real form

## Objective
Right now, when a search in the Exercise Library section doesn't match anything, a small dashed-border "Create New: {query}" button quietly appears — easy to miss, and it only creates a bare-name exercise with no metadata. Make this affordance impossible to miss, and have it open the real Task 45 form (pre-filled with the search text) instead of a bare quick-add.

## Context
- Depends on Task 45 (`CustomExerciseForm`) and Task 46 (the Custom Exercise section) being complete — this task connects the two.
- Current behavior: `ExerciseLibrarySidebar.tsx:269-286` renders a "Create New: "{searchQuery}"" button only when `!loading && searchQuery.trim() && !hasExactMatch` (i.e. only after the user searches and truly finds nothing). Clicking it calls `handleCreateNew()` (`ExerciseLibrarySidebar.tsx:72-77`), which just calls `onSelectExercise(searchQuery)` — the same bare-name path as clicking "+ Add" on a library result. There's no metadata capture at all today.
- The owner's ask: users should *instantly* know they can create a custom exercise when what they're looking for isn't in the shared library — the current dashed box is too subtle/conditional to notice.

## Requirements

### 1. Make the "create new" affordance visibly prominent
- Restyle and/or reposition the existing conditional "Create New" button so it's immediately noticeable the moment a search comes up empty (or has no exact match) — stronger visual weight than today's thin dashed box (e.g. solid accent background, an icon, more padding, positioned right at the top of the empty/no-match results area rather than only after scrolling past whatever partial matches exist).
- Use your judgment on the exact visual treatment, but the acceptance bar is: a user who types a search with no match should not be able to miss that they can create it themselves.

### 2. Wire it to the real form instead of the bare quick-add
- Replace `handleCreateNew`'s current behavior (`onSelectExercise(searchQuery)`) with opening Task 45's `CustomExerciseForm`, passing `initialName={searchQuery}` so the name field is pre-filled with what the user already typed.
- Where the form opens: reuse Task 46's Custom Exercise section as the single place this form ever renders — i.e. "Create New" from a failed search should expand/reveal the *same* Custom Exercise section's create form (scrolled into view if needed), not spawn a second, separate form instance. There should be exactly one form implementation and exactly one place it mounts in this sidebar.
- After successful creation via this path, behave the same as Task 46 specifies: show it in the Custom Exercise list, don't auto-add it to the plan — the user still clicks "+ Add" afterward.

## Do NOT
- Do not create a second copy of the custom-exercise form — reuse the exact component from Task 45, mounted via Task 46's section.
- Do not change the conditions under which "create new" is offered (i.e. still only when the search has no exact match) — this task is about visibility and wiring, not about when it appears. (If a broader "always show create new" change is wanted later, that's a separate, explicit ask — don't bundle it in here.)
- Do not remove the ability to quickly add a bare-name exercise if the owner still wants that as a fallback — check with the owner before removing any existing capability outright; default to redirecting to the richer form as the *only* path unless told otherwise.

## Acceptance criteria
- [ ] Searching for something not in the shared library shows a visually prominent "create new" affordance immediately, not something a user could plausibly overlook.
- [ ] Clicking it opens the real form (Task 45), pre-filled with the search text, in the Custom Exercise section (Task 46) — not a bare-name quick add.
- [ ] The created exercise appears in the Custom Exercise section immediately, same as Task 46's own creation path.
- [ ] No duplicate/second form implementation exists anywhere in the sidebar.

## Review checklist
- [ ] Confirm this doesn't regress the "always show Create New" fix from Task 38 (`task_38_always_show_create_new.md`) — check that spec/diff before changing the visibility conditions, since Task 38 already touched when this button appears once before.
- [ ] Get a quick visual check (screenshot) from the owner or via the browser preview before considering this done — "visibility" is inherently a judgment call that benefits from an actual look, not just code review.
