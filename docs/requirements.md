# Traqo Requirements (MVP)

This document reflects what was actually specified and built through Sprint 6. It supersedes any earlier informal planning — where this disagrees with `docs/api.md` or `docs/database.md` on a detail, this file and the actual code are authoritative, since those two docs were written before implementation and weren't always updated for small deviations discovered along the way (e.g. response shapes that ended up richer than the original examples).

## 1. Purpose

A personal fitness-tracking web application. A user creates an account, defines their own exercises, assembles them into named workout plan templates, and logs actual performance (weight, reps, notes) each time they work out. Built both as a real tool and as a deliberate exercise in professional software engineering practice — see `CLAUDE.md`.

## 2. Functional Requirements

### 2.1 Authentication
- A person registers with a display name and password only — no email, no phone number.
- The system auto-generates a unique username from the display name (lowercased, non-alphanumeric characters stripped, a random numeric suffix appended on collision).
- Password minimum 8 characters, maximum 128 (the maximum exists to fail cleanly rather than hit bcrypt's internal 72-byte input limit with a confusing error).
- Login by username + password returns a JWT, used as a Bearer token on all subsequent requests.
- No password recovery, no email verification, no OAuth — explicitly deferred to V2.

### 2.2 Exercises
- A logged-in user creates, lists, and deletes exercises they own.
- Exercises are personal — no shared/global exercise library in this MVP.
- A user can never see, modify, or delete another user's exercises.

### 2.3 Workout Plans
- A logged-in user creates, renames, and deletes named workout plan templates.
- Exercises (owned by the same user) can be added to a plan, removed from it, and reordered within it.
- A plan cannot be deleted while any workout session (finished or in-progress) references it — see `docs/architecture.md` §4 for why.
- A user can never access, modify, or delete another user's plans, and cannot add another user's exercise to their own plan (validated even if the exercise ID is guessed).

### 2.4 Workout Sessions
- A logged-in user starts a session from one of their own plans.
- While a session is active, the user logs sets (exercise, weight, reps, optional notes) against it. Set numbers increment per exercise within a session (not a single counter across the whole session) — e.g. Bench Press Set 1, Set 2, independent of any other exercise's set numbering in the same session.
- A set cannot be logged against a session that has already been finished.
- A session can be finished exactly once; finishing an already-finished session is rejected.
- A user can never act on another user's session, and cannot log a set using an exercise they don't own even against their own session.

### 2.5 Workout History
- A logged-in user sees a list of their own **finished** sessions only — in-progress sessions don't appear.
- Each entry shows the date, the plan name, and the session duration.
- If the plan a historical session was based on no longer exists (see §2.3 — in practice this shouldn't happen since deletion is blocked, but the read path handles it defensively rather than crashing), the entry falls back to a placeholder plan name rather than failing.
- Most recent session first.

## 3. Non-Functional Requirements

- **Architecture:** clean architecture + modular monolith, enforced per `CLAUDE.md` — see `docs/architecture.md` for the full breakdown. This is a stated project goal in its own right (learning the pattern properly), not just an implementation detail.
- **Security:** passwords hashed (bcrypt, never stored or logged in plaintext — this was violated accidentally during early debugging in Sprint 0/1 and corrected; see `dev-log.md`). JWT-based auth on every protected endpoint. Ownership checks on every resource-scoped operation, verified via real HTTP calls against a live server, not just unit-tested in isolation — this became the standard verification bar starting Sprint 2 after early sprints shipped bugs that static/unit testing missed.
- **API style:** REST, JSON, standard HTTP status codes, consistent `{"error": "..."}` shape on failure (see `docs/api.md`).
- **Data integrity:** destructive operations that would silently lose a user's data (e.g. deleting a plan with recorded history) are blocked with a clear error rather than allowed to cascade or fail with an opaque 500.

## 4. Explicitly Out of Scope (V2+)

Per `CLAUDE.md` — do not build or suggest without the project owner expanding scope first:
- Email or phone authentication, password recovery, OAuth/social login
- Notifications
- Social features (following other users, sharing workouts, etc.)
- Trainer/coach accounts or a trainer portal
- AI-driven features (recommendations, form analysis, etc.)
- A shared/global exercise library or exercise categorization (muscle groups, equipment, etc.)
- Nutrition tracking

**Revised 2026-07-19:** "Analytics or progress-tracking beyond the raw history list" and "Personal records tracking" were previously listed here and are **no longer out of scope** — see §2.4 and §2.5 below, and `docs/ux-improvement-plan.md` Section 3.D for the rationale (competitor research showed this is table-stakes, not a nice-to-have, for this category of app). This is the kind of explicit, written scope change this document exists to track — don't let future scope decisions happen only in chat.

### 2.4 Workout Plans (revised 2026-07-19)
- A plan can optionally be assigned to one or more days of the week.
- Each exercise added to a plan can optionally have a target number of sets, target reps, and target weight — used to prefill and checklist the logging screen.

### 2.5 Progress Over Time (new, 2026-07-19)
- A logged-in user can view, per exercise, their history of sets across all finished sessions: best set per session, computed volume, and an estimated one-rep max.
- The system detects and can surface new personal records (heaviest weight, best estimated 1RM, best volume, most reps) as they happen.
- A consistency view (calendar/streak) shows which days had a finished workout, derived from existing session data — no new backend query required for this specific piece.

## 5. Acceptance Standard

A feature is not "done" until it has been verified with real HTTP requests against a live running instance (or, for frontend work, an actual browser click-through) — not static checks (import linting, git status, a health-check ping) and not a claim based on reading the code. This became the project's working standard starting Sprint 3, after multiple sprints shipped real, user-visible bugs that only static verification had missed. See `dev-log.md` for the specific incidents that established this.
