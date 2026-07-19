# Design Spec — UI Color Refresh

Status: proposal, not implemented. Scope: color tokens only (background, text, borders, accent + supporting semantic colors). No layout, spacing, typography, or component-structure changes are proposed here.

## 1. Grounding: how tokens are actually used today

Read from `frontend/src/index.css`, `frontend/src/App.css`, `Layout.tsx`, `PlanList.tsx`, `ActiveWorkout.tsx`, `Toast.tsx`, `ConfirmDialog.tsx`.

- `index.css` defines real CSS custom properties: `--text` (#6b6375, muted/body — this is the *default* text color set on `:root`), `--text-h` (#08060d, near-black — headings only), `--bg` (#fff), `--border` (#e5e4e7), `--accent` (#aa3bff, purple), plus `--accent-bg`/`--accent-border` tint/border pairs. Today `--accent` is used in exactly one place in components: `Layout.tsx`'s nav active-link background (`aria-current="page"`). The `--accent-bg`/`--accent-border` pair exists in the token file but isn't consumed by any component yet — i.e. there's already a "soft badge" pattern (solid / 10% tint bg / 50% border) established in the tokens, just unused. I reused that exact pattern for the new supporting colors below rather than inventing a new one.
- `App.css` defines `.btn-primary` (#007bff, a *different* blue, unrelated to `--accent`), `.btn-success` (#28a745), `.btn-danger` (#dc3545), `.btn-secondary` (#6c757d), `.error-message` (bg #f8d7da / border #f5c6cb / text #721c24) — all as raw hex, not CSS vars.
- `Toast.tsx` hardcodes success #28a745, error #dc3545, info #17a2b8 inline (not tokens).
- Lots of inline one-off grays scattered through components: `#666`, `#999`, `#333`, `#ccc`, `#e0e0e0`, `#f9f9f9` (PlanList, ActiveWorkout, ConfirmDialog).

Two things worth flagging up front because they affect the recommendation:
- **`--accent` and `.btn-primary` are already two different, unrelated colors** (purple vs blue). This redesign doesn't have to fix that, but it's the reason I didn't assume "accent" already means "primary button" in this codebase — right now it only means "current nav item."
- **None of the four new state meanings (active/done/customized) exist in code yet** except active-nav. Done and Customized are net-new — there's no legacy color debt to preserve for them, only for danger/success/error/toast-info, which the brief already says to keep.

## 2. Proposed tokens (drop-in replacement for `index.css`)

Naming keeps the existing convention (`--text`, `--text-h`, `--bg`, `--accent`, `--accent-bg`, `--accent-border`) and extends it the same way for the two new supporting colors.

```css
:root {
  /* Base */
  --bg: #ffffff;
  --text: #52525b;      /* secondary/body text — this is the default page text color (see :root color: var(--text) usage) */
  --text-h: #18181b;     /* primary/heading text — headings + any emphasized copy */
  --border: #e5e4e7;     /* unchanged — see note below */
  --code-bg: #f4f4f5;    /* unchanged in spirit, nudged neutral; not part of the explicit ask */

  /* Accent — "Active / current" state (recommended option, see §3) */
  --accent: #4f46e5;
  --accent-bg: rgba(79, 70, 229, 0.1);
  --accent-border: rgba(79, 70, 229, 0.5);

  /* Done / completed state */
  --success: #16a34a;         /* fills, dots, icons, rings — non-text UI use */
  --success-text: #15803d;    /* any actual text/label ("Completed", PR badge copy) */
  --success-bg: rgba(22, 163, 74, 0.1);
  --success-border: rgba(22, 163, 74, 0.5);

  /* Customized flag (new) */
  --customize: #b45309;       /* text/icon-safe */
  --customize-bg: rgba(180, 83, 9, 0.1);
  --customize-border: rgba(180, 83, 9, 0.5);

  /* Preserved semantics — values unchanged from current app */
  --danger: #dc3545;          /* .btn-danger */
  /* error-message: bg #f8d7da / border #f5c6cb / text #721c24 — unchanged */
  /* toast: success #28a745, error #dc3545, info #17a2b8 — unchanged */
}
```

Notes on the base tokens:
- `--text` and `--text-h` move from the current purple-tinted grays (`#6b6375`, `#08060d`) to neutral zinc grays. The brief says "dark gray" plainly — the current values are technically dark gray too, but they're desaturated purple, i.e. tinted toward the *old* accent. Since the accent is changing, keeping text neutral avoids the new palette looking like it's still built around purple. This also slightly improves contrast (`--text` goes from ~5.7:1 to ~7.7:1 against white).
- `--border` (#e5e4e7) is left as-is. At that lightness the purple tint is imperceptible, and it's used only as a 1px hairline (cards, dividers), never as a contrast-bearing element — no reason to touch it.
- `--code-bg` isn't part of the explicit ask (bg/text/border/accent). Included only for completeness since it's in the same `:root` block; low priority.

## 3. Accent color — options, contrast, and how each meaning reads

All three candidates pass **WCAG AA for normal text on white (≥4.5:1)** — the current purple (`#aa3bff`) does not (~4.4:1, fails). All three also work as a *solid fill with white text on top* (nav active pill, filled "active week" circle), which is the other place accent gets used.

| Option | Hex | Contrast vs white | Hue (°) |
|---|---|---|---|
| **1. Indigo (recommended)** | `#4f46e5` | ~6.3:1 | ~243° |
| 2. Violet (brand continuity) | `#7c3aed` | ~5.7:1 | ~258° |
| 3. Blue (safest/most conventional) | `#2563eb` | ~5.2:1 | ~221° |

**Considered and rejected: teal/cyan.** A teal accent (e.g. `#0f766e`) also clears AA (~5.5:1), but it sits too close in hue to two colors already in the app: the existing toast "info" cyan (`#17a2b8`, ~189°) and the green used for done/success (~142°). Introducing a third blue-green hue into a palette that already needs green to read clearly as its own thing is exactly the kind of collision the brief asked me to avoid, so I dropped it rather than list it as an option.

**How each option reads for the four required meanings:**
- *Active/current* (nav active link, active week circle): all three work well as a solid fill — indigo and violet read as "selected/focused," blue reads as "this is the live/clickable one," a slightly more generic convention (links, tabs).
- *Done/completed*: stays green regardless of which accent you pick (see §4) — no interaction effect.
- *Customized*: stays amber regardless of accent choice (see §4).
- *Danger/success* (existing): unaffected either way.

**Ranking / recommendation: Indigo (`#4f46e5`).**
1. **Indigo** — best contrast of the three (6.3:1, comfortably past AA, close to AAA), and it's far enough from blue (~221°) that it won't get read as "a link" the way pure blue can be, while still being clearly a "cool" color, unambiguously separate from green/amber/red. This is my recommendation.
2. **Violet** — closest to the current purple identity if the owner wants the rebrand to feel like a refinement of the existing look rather than a swap; contrast is still solid (5.7:1).
3. **Blue** — the safest, most universally-understood "primary/interactive" color (every user has seen blue = active/selected before), but it sits closest in hue to the existing toast-info cyan (32° apart) — if this option is chosen, nudge the toast "info" color further from blue to keep that distinction, or accept that info-toasts and accent will read as "the same family," which is a minor conflict since toasts are transient and accent is persistent.

## 4. Supporting colors — Done and Customized

These two are genuinely new UI (multi-week plan, next feature). No existing color debt to preserve, so I designed them to sit far around the hue wheel from the accent options above and from each other.

**Done / completed — green, ~142°.** Reuses the existing green *family* already established by `.btn-success` and the success toast (`#28a745`), rather than introducing a fifth hue — checkmarks/complete states reading "green" is also the dominant convention in comparable workout apps: Hevy (a direct competitor) uses a tappable checkmark to mark a set complete, and general status-color convention (red = error, green = success, amber = caution) is the de facto standard across design systems, including Material Design's semantic color guidance.
- `#28a745` (existing `.btn-success`/toast) only clears **~3.1:1** against white — fine for a filled button with bold white text (a widely-accepted exception, not strictly AA-for-text) but not safe if reused as colored *text*.
- New `--success` (`#16a34a`) and `--success-text` (`#15803d`, ~5.0:1) split that: use `--success` for fills/dots/icons (rings, small circle fills — non-text UI only needs 3:1 per WCAG 1.4.11), and `--success-text` for any actual label copy ("Completed", a PR badge's text).
- Recommendation: for the finished-set / completed-day indicator itself, don't put the label text in green at all — pair a green checkmark icon or filled dot with your existing neutral `--text-h` for the label (e.g. ✓ + "Day 3" in dark gray, not "Day 3" in green). This sidesteps the text-contrast question entirely and matches how Hevy/Strava/Apple Fitness do it: color carries the status via an icon/ring, the label stays neutral and legible.

**Customized flag — amber, ~29°.** New hue, not used anywhere in the app today, so no collisions. `#b45309` (~5.0:1) is safe for a small text label or icon (e.g. a "Customized" pill or an edit-pencil glyph on a week card), with `--customize-bg`/`--customize-border` for the same soft-badge treatment `--accent-bg`/`--accent-border` already establishes.

**Colorblindness caveat (important given four semantic hues live close together in a small space, e.g. a row of week circles):** roughly 8% of men have some form of red-green colorblindness, and amber sits directly between red and green — under deuteranopia/protanopia, "customized" amber can look uncomfortably close to either "danger" red or "done" green. Don't rely on hue alone to carry these four meanings. Pair each state with a persistent non-color cue: a checkmark glyph for done, a small pencil/asterisk glyph for customized, a solid ring or bold weight for active, and an `aria-label`/visually-hidden text equivalent for screen readers (e.g. `aria-label="Week 2, active"` / `"Week 3, completed"` / `"Week 4, customized"`) rather than color/icon alone. This is standard WCAG 1.4.1 (Use of Color) guidance and costs nothing structurally to add when these components get built.

## 5. Quick reference — all four states + preserved semantics

| Meaning | Token | Hex | Contrast vs white |
|---|---|---|---|
| Active / current | `--accent` | `#4f46e5` | ~6.3:1 |
| Done / completed (text) | `--success-text` | `#15803d` | ~5.0:1 |
| Done / completed (fill/icon) | `--success` | `#16a34a` | ~3.3:1 (non-text use) |
| Customized | `--customize` | `#b45309` | ~5.0:1 |
| Destructive (unchanged) | `--danger` | `#dc3545` | ~4.5:1 |
| Error message text (unchanged) | — | `#721c24` | high, unchanged |
| Toast info (unchanged) | — | `#17a2b8` | n/a, transient use only |

Hue spacing between the four "state" colors is roughly 90°+ apart in every pairing (indigo ~243° / green ~142° / amber ~29° / red ~354°), which is what makes them distinguishable at a glance rather than just different shades of the same idea.

## 6. Dark mode — decision needed from the owner

`index.css` currently ships a `@media (prefers-color-scheme: dark)` block that inverts the whole palette (dark bg, light text, brighter purple accent). The brief says "background: white" but doesn't say whether that's "the app is light-only now" or "the light theme's background is white" (implying dark mode still exists as its own inverted theme).

I'm not guessing on this — flagging it explicitly:

- **Option A — light-only.** Delete the dark-mode media query; `--bg: #ffffff` and this palette are the only theme. Simpler, and matches a literal reading of "background: white." My lean, mainly because it's less work to get right: four new state colors (active/done/customized/danger) all need their own contrast-checked dark-mode variants otherwise, which is a second full pass this task wasn't scoped for.
- **Option B — keep dark mode, inverted.** Requires designing dark-mode equivalents for `--accent`, `--success`/`--success-text`, `--customize`, and re-verifying contrast for each against a dark background (different hex values than a simple lightness-flip, since contrast math changes direction) — same accessibility rigor as this document, just for a second palette. Should be its own follow-up spec if wanted, not folded into this one.

Recommendation: go with Option A (light-only) for this pass, and treat dark mode as a separate future spec if the owner wants it back — confirm before implementation either way.

## 7. Implementation notes (non-binding, for whoever picks this up)

- `App.css`'s `.btn-primary`, `.btn-success`, `.btn-danger`, `.error-message`, `.card`, `.input-field` currently use raw hex, not `var(--token)`. Worth converting these to reference the tokens above (e.g. `.btn-danger { background-color: var(--danger); }`) so the token file is the actual single source of truth, rather than a second copy of the same colors living in App.css. Not required for this palette to work, but it's the difference between a real design-token system and a coincidence.
- `--accent` and `.btn-primary` will still be two different colors after this change (indigo `#4f46e5` vs the existing blue `#007bff`) unless someone decides to unify them. Not addressed here since it's a component-level decision (which buttons should look "accent-colored" vs generic) rather than a token-system question — flagging so it isn't mistaken for an oversight.
- Inline hardcoded grays (`#666`, `#999`, `#333`, `#e0e0e0`, `#ccc`, `#f9f9f9`) scattered across `PlanList.tsx`, `ActiveWorkout.tsx`, `ConfirmDialog.tsx` don't currently reference any token. Not in scope to change here, but they're the reason "dark gray text" won't be fully consistent app-wide just from editing `index.css` — those components would need their inline styles updated separately.

## Sources / pattern research

- Material Design semantic color convention (red = error, green = success, amber = caution) — [Color Consistency in Design Systems, UXPin](https://www.uxpin.com/studio/blog/color-consistency-design-systems/); [Material Design 3 — Advanced color customizations](https://m3.material.io/styles/color/advanced/define-new-colors)
- Hevy (direct competitor, workout tracker) uses a tap-to-complete checkmark per set as its completion affordance — [How to Use Hevy: Log Workouts, Track Progress & Socialize](https://www.hevyapp.com/hevy-tutorial/)
- Duolingo's path/circle progress pattern (distinct visual state per circle: locked/active/completed) as a reference for how a row of "week" circles can carry multiple at-a-glance states — [Introducing the new Duolingo learning path](https://blog.duolingo.com/new-duolingo-home-screen-design/); [Duolingo: Gamification as Design Language](https://blakecrosley.com/guides/design/duolingo) (note: Duolingo itself uses gold for "completed," not green — cited for the *pattern* of state-per-circle, not the specific hue choice)
- Contrast ratios calculated against WCAG 2.1 relative luminance formula (AA normal text threshold 4.5:1, AA large text / non-text UI component threshold 3:1).
