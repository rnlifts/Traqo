# TRAQO UI Design System v1.0 — As Implemented

This is the authoritative reference for Traqo's visual design. It reflects the owner-approved palette (below, unedited) plus the handful of deliberate additions/deviations made while implementing it — every deviation is called out explicitly so a future agent doesn't "fix" it back to something that was already tried and rejected.

**When building any new screen or component: read this file, use the existing CSS custom properties and shared classes in `frontend/src/index.css` / `frontend/src/App.css`, don't hardcode hex values or invent new spacing/radius numbers.**

---

## Source of truth: the owner-provided palette

### Color Palette

**Primary**
| Token | Hex | Usage |
|---|---|---|
| `--accent` | `#2563EB` | Primary buttons, links, active states |
| `--accent-hover` | `#1D4ED8` | Hover state |
| `--accent-pressed` | `#1E40AF` | Active/pressed state |
| `--accent-soft` | `#EFF6FF` | Active sidebar, selected cards |

**Backgrounds**
| Token | Hex |
|---|---|
| `--bg` (App background) | `#F8FAFC` |
| `--surface` (Sidebar/Cards/Modal) | `#FFFFFF` |
| `--bg-secondary` | `#F9FAFB` |

**Text**
| Token | Hex | Usage |
|---|---|---|
| `--ink` | `#0F172A` | Headings |
| `--ink-primary` | `#334155` | Primary text |
| `--ink-soft` | `#64748B` | Secondary text |
| `--ink-faint` | `#94A3B8` | Muted text |
| `--placeholder` | `#CBD5E1` | Placeholder text, input borders |

**Borders**
| Token | Hex |
|---|---|
| `--border` (default) | `#E2E8F0` |
| `--border-hover` | `#CBD5E1` |
| `--border-focus` | `#2563EB` |

**Status**
| Token | Hex |
|---|---|
| `--success` | `#22C55E` |
| `--warning` | `#F59E0B` |
| `--danger` | `#EF4444` |
| `--info` | `#2563EB` (same as accent) |

### Typography

Font family: **Inter** throughout (headings and body — no separate display font).

| Usage | Size | Weight |
|---|---|---|
| Hero Heading | 48px | 700 |
| Page Heading (`.page-title`) | 40px | 700 |
| Section Heading | 28px | 600 |
| Card Title | 22px | 600 |
| Navigation (`.sidebar-link`) | 17px | 500 |
| Body | 16px | 400 |
| Button | 16px | 600 |
| Label (`.field-label`, `.section-label`, `.kicker`) | 14px | 500, uppercase, `0.05em` tracking |
| Small text | 13px | 400 |

Letter spacing: labels `+0.05em`, headings `-0.02em`.

### Layout
- Sidebar: 280px wide, white, `border-right: 1px solid #E2E8F0`
- Content: max-width 1440px, 40px padding (`.page-container`)

### Border Radius
| Component | Radius |
|---|---|
| Buttons / Inputs | 12px (`--radius-btn` / `--radius-input`) |
| Cards | 18px (`--radius-card`) |
| Modal | 20px (`--radius-modal`) |
| Pills (chips, badges) | 999px (`--radius-pill`) |
| Table/history rows | 16px — **note: deliberately one size down from cards**, see `.history-row` |

### Shadows
```css
--shadow-card: 0 1px 2px rgba(15,23,42,.04), 0 8px 20px rgba(15,23,42,.05);
--shadow-modal: 0 15px 40px rgba(15,23,42,.12);
```

### Spacing Scale
`--space-xs:4px --space-sm:8px --space-md:12px --space-lg:16px --space-xl:24px --space-2xl:32px --space-3xl:40px --space-4xl:48px`

### Component specs (all implemented in `App.css` — read the actual CSS for exact selectors)
- **Buttons**: Primary (`.btn-primary`) solid `--accent`, hover `--accent-hover`, active `--accent-pressed`. Secondary (`.btn-secondary`) white + border. Ghost (`.btn-ghost`) transparent + accent text, hover `--accent-soft`.
- **Inputs** (`.input-field`, `.text-input`): white bg, `--placeholder` border, focus = 2px `--border-focus` + `0 0 0 4px rgba(37,99,235,.12)` glow.
- **Cards** (`.card`, `.panel`): white, `--border` border, `--radius-card`, `--shadow-card`.
- **Navigation** (`.sidebar-link`): inactive `--ink-primary`/500; active `--accent-soft` bg + `--accent` text/600 + 14px radius; hover `--bg`.
- **Tabs** (`.day-tab`): inactive `--ink-soft` + transparent underline; active `--accent` + 2px `--accent` underline + 600 weight.
- **Week Selector** (`.week-node`) — see "Deviations" below, this needed a 4th visual state beyond the original 3-state spec.
- **Table rows** (`.history-row`, exercise grid rows): white, `--border`, 16px radius, hover `--bg-secondary`.
- **Info Card** (`.info-card`): `--accent-soft` bg, 4px `--accent` left border, 14px radius, 20px padding.

### Animation
200ms `ease`. Buttons scale to `1.01` on hover (`transform: scale(1.01)`).

---

## Deviations from the literal spec — deliberate, with reasons

1. **Icon library: hand-rolled SVGs (`frontend/src/components/icons.tsx`), not `lucide-react`.** The spec calls for Lucide React. It was installed and caused a hard, reproducible "Invalid hook call" React error that survived a full Vite cache clear and dev-server restart. The resolved version (`1.25.0`) didn't match what the real published package normally versions as (typically `0.4xx.x`), pointing to a genuine registry/resolution problem in this environment, not a code bug. The hand-rolled set uses the same simple 2px-stroke line-icon visual language and covers the same icons (grid, dumbbell, clipboard, history, calendar, clock, arrows, save, info, logout, plus, close). **If someone wants to retry `lucide-react` specifically, treat it as its own isolated task with its own verification — don't assume it'll just work this time.**

2. **A 4th "customized week" indicator color, distinct from `--accent`.** The owner's spec defines a Week Selector with exactly 3 states (default / active / completed), designed for a linear progress-tracking use case. Traqo's actual Plan Builder has a different domain concept — a week can independently be "currently being viewed" (`active`) AND "customized" (has its own content vs. being linked to another week) — these are two independent booleans, not one 3-state enum. Originally `--customize` was aliased directly to `--accent` (solid blue), which meant a customized-but-not-currently-selected week and the currently-selected week could render identically — a real ambiguity bug, caught and fixed during implementation. Resolution: `--customize: #7C3AED` / `--customize-bg: #F3E8FF` (violet) — visually distinct from blue `--accent`, used only for "this week has custom content" regardless of whether it's the one currently being viewed.

3. **`--code-bg`, `--nav-bg`, and other pre-existing alias variables** are kept for backward compatibility with code that hasn't been touched yet in this reskin — they're mapped to sensible equivalents in the new palette (see `index.css`) rather than deleted, so untouched pages don't break. As each remaining page gets its reskin pass, prefer using the real token names (`--border`, `--bg-secondary`, etc.) directly over these aliases.

---

## What's been implemented against this system (verified live, not just written)

- Design tokens, fonts, spacing, shadows — `frontend/src/index.css`
- Shared component classes (buttons, inputs, cards, chips, tabs, nav, info-card, week-selector, history rows, icon badges) — `frontend/src/App.css`
- Icon set — `frontend/src/components/icons.tsx`
- Sidebar (`frontend/src/components/Layout.tsx`)
- Dashboard, Create Plan (Step 1), Workout Plans (list), Workout History, Plan Builder (week rail / day tabs / info card — exercise table grid still needs a final polish pass)

## What's still pending a reskin pass

Session Setup, Active Workout, Session Summary, Exercises (list + create form), Session Detail (history drill-down), Exercise Progress (stat tiles + `TrendChart`). See `docs/sprints.md` for the tracked handoff for this work.

---

## Styling direction going forward: Tailwind for new work only

Starting after Sprint 13, **all new pages/components should be built with Tailwind CSS**, configured to use the exact token values above (mapped into `tailwind.config.js` theme, not re-invented). This is an owner decision (2026-07-21) to get enforced consistency (no more hardcoded hex/px values slipping into inline styles — the exact bug class fixed repeatedly in Sprint 13) without touching what's already built.

**Rules for this transition:**
1. **Do not migrate or touch any of the 7 pages already reskinned in Sprint 13** (or any other existing page/component). They keep using the CSS-variable + shared-class system as-is. No regression risk, no need to re-verify them.
2. **Tailwind's `preflight` base reset must be scoped or disabled** so it doesn't change how existing (non-Tailwind) pages render (default margins/borders/form-element styling). Verify this explicitly after install by loading an existing page (e.g. Dashboard) and confirming it looks pixel-identical to before, using the same live-verification discipline as Sprint 13 — not just "npm run build succeeded."
3. **`tailwind.config.js` colors/radii/spacing must be mapped 1:1 to the existing tokens** in this doc (e.g. `accent: '#2563EB'`, `radius.card: '18px'`) so a new Tailwind page and an old CSS-variable page are visually indistinguishable in palette — never introduce a second, slightly-different blue.
4. Document which pages are Tailwind vs. legacy CSS somewhere visible (this file or `docs/sprints.md`) as new pages get built, so it's always clear which system a given file uses.
