# CLAUDE.md — Traqo Project Context

This file holds project-specific facts for Traqo. It's read once per session by the `traqo-development` skill for context, and is not meant to be re-read on every step. It should only be edited when the project's stack, architecture, or scope actually changes — not automatically.

For *how* Claude should work (workflow, teaching style, review process), see the `traqo-development` skill — this file is facts only, not behavior.

---

## Project Overview

**Name:** Traqo
**What it is:** A fitness application for tracking workouts, exercises, sets, reps, weight, and workout history.
**Why it exists:** Both to build a professional-quality app and to learn professional software engineering principles along the way — not just to make it work.

---

## Tech Stack

- **Frontend:** React (feature-based architecture, reusable components)
- **Backend:** Python FastAPI (migrated from Flask — see `docs/migration-fastapi.md` for the migration plan and rationale)
- **Database:** PostgreSQL
- **ORM:** SQLAlchemy
- **Authentication:** JWT
- **Version Control:** Git
- **Project Management:** Jira (future)

Frontend and backend are separate applications.

---

## Architecture

Backend: **Clean Architecture** + **Modular Monolith**, organized by feature.
Frontend: feature-based architecture, reusable components.

### Dependency direction (backend)

```
Presentation → Application → Domain
```

Infrastructure implements interfaces used by the inner layers (dependency inversion).

The **Domain** layer must never depend on: Flask, SQLAlchemy, PostgreSQL, JWT, HTTP, or any external library.

### Layer responsibilities

- **Presentation** — routes, controllers, request validation, HTTP responses. No business logic.
- **Application** — use cases (e.g. Register User, Login User, Create Workout, Finish Workout). Coordinates workflow.
- **Domain** — entities, value objects, business rules, interfaces. No framework-specific code.
- **Infrastructure** — database, SQLAlchemy models, repository implementations, JWT, password hashing, external services.

### Folder structure

Every feature follows the same structure:

```
modules/
  auth/
    domain/
    application/
    infrastructure/
    presentation/
  workouts/
    domain/
    application/
    infrastructure/
    presentation/
  exercises/
    domain/
    application/
    infrastructure/
    presentation/
```

---

## API Style

REST API. Always return JSON. Use proper HTTP status codes.

```
GET    /api/workouts
POST   /api/auth/login
POST   /api/auth/register
PUT    /api/workouts/{id}
DELETE /api/workouts/{id}
```

---

## Current MVP Scope

**In scope:**
- Authentication — register/login by name + password. System auto-generates a unique username. No email or password recovery yet (planned for V2).
- Workout Plans — including day-of-week scheduling and target sets/reps/weight per plan exercise (added 2026-07-19 per `docs/ux-improvement-plan.md`; see `docs/sprints.md` for the sprint sequence)
- Workout Sessions — including previous-performance prefill (last session's actual weight/reps for an exercise)
- Exercises
- Workout History — including progress-over-time views: per-exercise history, volume trend, estimated 1RM, PR detection (added 2026-07-19, reversing the earlier "out of scope" call — see `docs/ux-improvement-plan.md` Section 3.D for rationale and `docs/requirements.md` for the updated non-goals)

**Explicitly out of scope for now** (don't build or suggest without the person expanding scope first):
- Notifications
- Social features
- Trainer portal
- AI features
- Nutrition tracking
- A shared/global exercise library

**Note on scope changes:** this file has already been formally revised once (2026-07-19) to bring in what was originally deferred. Treat that as evidence scope *can* change, not as license to reinterpret "out of scope" items yourself — always make the change explicit here and in `docs/requirements.md` when it happens, the way this one was.

---

## Coding Standards

- Keep functions small, classes focused.
- Prefer composition over inheritance.
- Use type hints where practical.
- Write docstrings for public classes and functions.
- Avoid duplicate code.

---

## Development Pipeline (PM Orchestration)

Claude acts as Project Manager (PM) for Traqo: plans, delegates, and reviews — does not write implementation code directly unless explicitly asked. Requirements come in at product/feature level; PM fills in technical gaps and implementation decisions using judgment and this file, and only escalates genuine product-level ambiguity to the person.

### Subagents (`.claude/agents/`)

- **coder** (Haiku) — implements well-specified coding tasks exactly as scoped, no re-architecting.
- **reviewer** (Sonnet) — security/correctness review after coder finishes, especially auth and password-handling changes.
- **ux-researcher** (Sonnet) — researches and designs UX/UI improvements and feature specs; produces written specs, does not implement.
- **test-writer** (Haiku) — writes and runs tests covering coder's new/changed functionality; reports pass/fail and coverage gaps, does not fix implementation code.
- **db-migration-checker** (Sonnet) — verifies schema/data migrations are safe and reversible before they run against real data; flags risk rather than approving by default.

### Pipeline order for new features/fixes

1. **ux-researcher** — produces a spec first, for anything user-facing.
2. **coder** — implements from the approved spec, via the `structured-dev-workflow` skill's 7-step process (clarify → architecture check → plan → approval → work → review → dev-log entry). PM stands in for "the person" at step 2 (clarify), step 4 (plan approval), and step 6 (review, directly or via `reviewer` for security-sensitive work) — these are not relayed to the person unless the ambiguity is genuinely product-level, not technical.
3. **test-writer** — writes and runs tests against coder's output.
4. **db-migration-checker** — only if the change touches schema or data.
5. **reviewer** — final security/correctness check.
6. Report to the person for final approval.

### Communication between steps

- Specs, plans, or anything meant to be read by a later agent or by the person directly go to a file in `docs/` (e.g. `docs/feature-spec-{name}.md`); the next agent in the chain reads that file rather than working from a summary of it.
- Short, transient handoffs (coder's implementation report, test-writer's pass/fail results, reviewer's findings) can stay verbal unless significant enough to warrant a written record.
- Every subagent reports back in the same format: what was done, files touched, deviations from spec, and a recommendation for next step.

### When to stop and ask vs. proceed automatically

Steps 1–5 run automatically without checking in, including PM approving coder's plans. Stop and surface the output to the person before proceeding if:
- The requirement itself is ambiguous at a product level (not technical)
- The change touches authentication or password handling
- The change touches payments or billing
- The change touches user data or database schema in a way that could be destructive or hard to reverse

For everything else, run the full pipeline and bring the person the final result with reviewer's sign-off.

---

*Last updated: 2026-07-19. Update this file directly (not the skill) when stack, architecture, or scope changes.*
