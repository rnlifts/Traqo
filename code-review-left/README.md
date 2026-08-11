# Code review — deferred items

Findings from the senior-reviewer pass (2026-08-08) that were confirmed valid but
deliberately **not** fixed yet, because each one is either too large or too risky to
bundle into a quick fix pass. See `dev-log.md` for the full session history of what
*was* fixed (2.1, 2.2, 2.3, 2.4, 3.1, 3.3).

Each item below has its own file with full context: what was found, why it's real,
why it wasn't fixed immediately, and what a correct fix would need to consider.

## Open items

- [`2.5-repository-unit-of-work.md`](./2.5-repository-unit-of-work.md) — repositories
  commit individually instead of using a request-scoped transaction. Confirmed real
  and already causing pain elsewhere in the codebase. Large blast radius (29
  `commit()` calls across 8 files).
- [`3.2-optional-auth-token-distinction.md`](./3.2-optional-auth-token-distinction.md)
  — `get_optional_user_id` can't distinguish "no token" from "invalid/expired token".
  Confirmed real, but the reviewer's suggested fix would break a different, already
  deliberate design decision in the sharing feature. Needs a smarter fix, not the
  literal one suggested.

## When picking one of these up

Re-verify the claim against the current code before starting — this list was written
at a point in time and the surrounding code may have moved since.
