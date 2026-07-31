# Task 67 — Frontend: redesign set "pips" into clickable pill/chip shapes

## Objective
The circular per-set buttons ("pips") in `ActiveWorkout.tsx` currently show only a bare number ("1", "2", "3") or a checkmark, and read as a plain status indicator rather than something clickable. Widen them into rounded rectangle ("pill") shapes that fit "Set 1", "Set 2" text directly, with visual affordance (shadow/border/hover) that makes clear they're buttons. This task is independent of Tasks 63-66 (the preview/thumbnail work) — no shared files beyond `ActiveWorkout.tsx` itself, can be done in either order.

## Context
- `frontend/src/features/sessions/ActiveWorkout.tsx:866-922` — the exact current pip implementation. Each pip is a `44px × 44px` circular `<button>` (`borderRadius: "50%"`, line 906), showing only `{isLogged ? "✓" : setNumber}` as its entire visible content (line 919). The real set details (weight/reps/duration) only exist today in the `aria-label` (lines 884-902) — invisible to sighted users, only exposed to screen readers.
- Owner's approved design: widen each pip into a pill/chip — a rounded rectangle wider than tall, showing `Set 1`, `Set 2`, etc. as visible text, plus the checkmark when logged (e.g. `Set 1 ✓`), with a subtle shadow/border treatment so it clearly reads as a pressable button.
- The row wrapping these (line 866-873) already has `flexWrap: "wrap"`, `gap: "8px"` — pills wrapping onto a second line for exercises with many sets is expected/fine, no change needed there.
- The dashed "+" extra-set pip (lines 924-946, not shown above but immediately follows) uses the same circular styling (`borderRadius: "50%"`, `44px × 44px`) — update it to match the new pill shape too for visual consistency (it's still a "+" for adding an extra set, not a numbered one).
- `onClick={() => openSetPanel(we.id, setNumber)}` (line 883) — do not change this behavior, only the visual/label styling. Same for the "+" pip's click handler.

## Requirements
- Change each pip's shape from a `44px` circle to a pill: wider than tall (e.g. auto-width based on content with horizontal padding, fixed or min height similar to today's `44px`), `border-radius` reduced to something like `20-22px` (pill shape) rather than `50%`.
- Visible text becomes `Set {setNumber}` instead of the bare number, with the checkmark appended when logged (e.g. `Set 1 ✓` or checkmark rendered as a small icon alongside the text — your call on exact arrangement, but both the "Set N" label and the logged/not-logged state must be visually clear without relying on the `aria-label`).
- Add a subtle shadow (e.g. a small `box-shadow`) and/or a slightly heavier border, plus a hover state (e.g. a slight lift/darken on `:hover`, which in inline-style React typically means an `onMouseEnter`/`onMouseLeave` pair or a small CSS class — check how other buttons in this codebase handle hover, e.g. `ExercisePreviewPanel.tsx`'s play-button hover handlers before this was simplified away, for a precedent on the inline-style hover pattern used elsewhere) so the pill clearly reads as clickable at rest, not just on interaction.
- Keep the existing color logic (logged = success-colored, not-logged = neutral/border-colored) — this task changes shape and label text, not the color semantics.
- Update the "+" extra-set pip (the dashed one) to the same pill shape for consistency, keeping its "+" content and dashed-border "add" affordance.
- Keep the existing `aria-label`s exactly as they are (lines 884-902) — they already contain more detail (weight/reps/duration) than the new visible "Set N" label will, so they remain valuable for screen readers even after the visible label improves.

## Do NOT
- Do not change what happens on click (`openSetPanel` call) — this is a visual redesign only.
- Do not touch the preview-panel/thumbnail/modal work (Tasks 63-66) — no shared code beyond both being in `ActiveWorkout.tsx`.
- Do not remove or shorten the existing detailed `aria-label`s.

## Acceptance criteria
- [ ] Each pip visibly reads "Set 1", "Set 2", etc. (plus a checkmark when logged), not just a bare number.
- [ ] Pips are pill-shaped (rounded rectangle), not circular, with a shadow/border/hover treatment that reads as clickable.
- [ ] The "+" extra-set pip matches the new pill shape.
- [ ] Clicking any pip still opens the correct set-logging panel for that exercise/set number — no behavior regression.
- [ ] Existing `aria-label`s unchanged; screen-reader-relevant tests (if any exist for this component) still pass.
- [ ] Full frontend test suite passes; `npx tsc -b` clean.

## Review checklist
- [ ] Live-verify visually (screenshot) that pills look clearly clickable and that "Set N" text fits legibly at the new size, including for exercises with many sets where pills wrap onto multiple rows.
- [ ] Confirm click behavior is unchanged by opening a set panel via the redesigned pip and confirming the correct set number's inputs appear, same as before the redesign.
