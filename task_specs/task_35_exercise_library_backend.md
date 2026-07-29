# Task 35 — Backend: shared exercise library (seed data, search, thumbnails)

## Objective
Build a new, separate backend module for a global, admin-curated exercise library — sourced from JSON files the product owner maintains by hand — with a fuzzy-search endpoint the frontend will use to power a "browse and add exercises" sidebar in Plan Builder. This is **read-only from the user's perspective**: they browse/search/add from it, they never edit it.

## Context — read this before writing any code

### This is a new module, not a change to the existing `exercises` module
`backend/src/modules/exercises/` is the **per-user** exercise catalog — every row has a `user_id`, enforced unique per `(user_id, name)`. It's what every `workout_exercises`/`workout_sets` row ultimately points at. **Do not modify this module.** The new library is structurally different: global, no `user_id`, admin-curated. Mirror the same Clean Architecture layout (`domain/`, `application/`, `infrastructure/`, `presentation/`) as a new sibling module, e.g. `backend/src/modules/exercise_library/` — use `backend/src/modules/exercises/` as your structural reference for how a module in this codebase is laid out.

**The connection between the two**: when a user adds a library exercise to their plan, the frontend will call the *existing* `POST /api/exercises` (unchanged) with that exercise's name — exactly as if they'd typed it manually today. You are not building a new "add to plan" endpoint here; that already exists and needs no changes.

### The source data
`exercise library/` at the repo root (note: folder name has a space) contains one JSON file per muscle group: `abs.json`, `back.json`, `biceps.json`, `calves.json`, `chest.json`, `forearm.json`, `front_delt.json`, `glutes.json`, `hamstrings.json`, `quads.json`, `rear_delt.json`, `side_delt.json`, `traps.json`, `triceps.json`. Each is a JSON array of objects shaped:
```json
{
  "name": "Flat Dumbbell Bench Press",
  "muscle_group": "chest",
  "equipment": "dumbbell",
  "video_url": "https://www.youtube.com/watch?v=YQ2s_Y7g5Qk",
  "image_url": null
}
```
- `name`, `muscle_group` are always present. `equipment`, `video_url`, `image_url` can be `null`.
- Several files are currently empty (`[]` or literally 0 bytes) — the owner hasn't filled them in yet. **Your seed script must handle empty/missing files gracefully** (skip, don't error) since more will be filled in over time and re-seeded.
- **Do not hardcode a fixed list of muscle groups anywhere** (backend or implied contract with frontend). The actual set of muscle groups in use should always be derived from whatever's actually in the seeded data, so adding a new JSON file later (or finally filling in an empty one) automatically surfaces as a new filter option with zero code changes. This is a deliberate deviation from an earlier UI mockup that showed a fixed 7-chip filter row (Chest/Back/Legs/Shoulders/Arms/Core/Cardio) — the real source data uses a more granular, different taxonomy (e.g. `front_delt`/`side_delt`/`rear_delt` instead of one "Shoulders" bucket), and that's intentional; don't try to collapse it back down to the mockup's categories.

### YouTube thumbnails — derive, don't store
Don't add a step that fetches/stores thumbnail images. Instead, write a small pure function that takes a `video_url` and returns `https://img.youtube.com/vi/{VIDEO_ID}/hqdefault.jpg`, handling both common YouTube URL shapes (`https://www.youtube.com/watch?v=XXXX` and `https://youtu.be/XXXX`). Apply it when building API responses, not at seed/storage time — it's cheap string parsing, not worth persisting or caching. If `video_url` is null or unparseable, thumbnail is null (frontend shows a placeholder — that's a Task 36 concern, not yours).

### A known landmine in this codebase — read this or you'll repeat a bug that already happened once
`backend/src/infrastructure/rate_limiter.py` configures `Limiter(key_func=get_remote_address, headers_enabled=True)`. **Any route decorated with `@limiter.limit(...)` MUST include a `response: Response` parameter in its function signature**, or every single call to it will 500 with `Exception: parameter response must be an instance of starlette.responses.Response` — this already happened once this project (Task 33's `check-username` endpoint shipped without it and was completely non-functional until caught in review). Look at `backend/src/modules/auth/presentation/routes.py`'s `register`/`login`/`check_username` routes for the correct pattern before adding rate limiting here (if you add it — see requirement 4).

## Requirements

### 1. New table + migration
New model, e.g. `ExerciseLibraryItemModel` (`exercise_library_items` table): `id`, `name` (string), `muscle_group` (string, indexed — this is filtered on), `equipment` (string, nullable), `video_url` (string, nullable), `created_at`. No `image_url` column needed if you're deriving thumbnails from `video_url` per above — but do keep a nullable `image_url` column as a manual override slot for entries with no video (matches the JSON schema already having it; just don't feel obligated to populate it programmatically). New Alembic migration, revision id ≤32 characters (learned the hard way earlier this project — longer ids silently roll back the whole migration on Postgres's version-bookkeeping step).

### 2. Seed script (not a migration)
A standalone, **re-runnable, idempotent** script (e.g. `backend/scripts/seed_exercise_library.py`) — not baked into an Alembic migration, since this data will be edited and re-seeded repeatedly as the owner fills in more JSON files, and migrations are meant to run once. It should:
- Read every `*.json` file in `exercise library/` (relative to repo root — resolve this robustly regardless of the script's invocation directory, similar in spirit to how `backend/migrations/env.py` had to be fixed earlier this project to not depend on cwd).
- Skip empty files/arrays without error.
- Upsert each entry by `(name, muscle_group)` — insert if new, update if the name+muscle_group pair already exists (so editing an existing entry's `video_url`/`equipment` and re-running updates it rather than creating a duplicate).
- **Validation safety net**: for each file, check that the `muscle_group` values inside it look consistent with the filename (e.g. a file named `back.json` containing entries tagged with some other muscle group should print a loud warning, not silently seed mislabeled data). No such mismatch exists in the data today, but this is a cheap guard against future copy-paste mistakes as more files get filled in.
- Print a summary when done (how many entries loaded per file, any warnings).

### 3. Fuzzy search endpoint: `GET /api/exercise-library`
Query params: `q` (optional search string), `muscle_group` (optional exact-match filter). Requires authentication (`get_current_user_id`, same as other in-app data endpoints — this isn't part of the pre-login registration flow like Task 33's check-username was, it's only ever used from inside the logged-in Plan Builder).

Search behavior when `q` is provided — **token-overlap fuzzy matching**, not prefix/substring matching:
- Split `q` into lowercase words.
- For each library entry, split its `name` into lowercase words, score by how many query words appear in the name's words (exact word match is fine — you don't need full fuzzy/typo-tolerant string distance, just word-set overlap).
- Rank by score descending; entries with zero overlapping words are excluded.
- Concrete test case to satisfy: searching `"lat pull down"` must return an entry named `"Bar Pull Down"` (shares "pull" and "down") ranked above or alongside entries sharing fewer words, even though "lat" doesn't appear in "Bar Pull Down" at all.
- Given the whole library is small (currently under a thousand rows even fully filled in), just query the (optionally muscle-group-filtered) rows from the DB and score them in Python in-process — no need for a Postgres full-text/trigram search extension or any caching layer for this data size.

When `q` is absent, just return entries (optionally filtered by `muscle_group`), ordered by name.

Response per item: `{id, name, muscle_group, equipment, thumbnail_url}` (`thumbnail_url` = the derived YouTube thumbnail, or the manual `image_url` override if set, or null).

### 4. `GET /api/exercise-library/muscle-groups`
Returns the distinct `muscle_group` values currently present in the table (`SELECT DISTINCT muscle_group ...`), sorted alphabetically. This is what the frontend uses to render filter chips — it must reflect real seeded data, not a hardcoded list (see Context above).

Neither endpoint needs rate limiting particularly (they're behind auth, used by an already-logged-in user browsing a UI panel) — skip `@limiter.limit(...)` here unless you have a specific reason to add it. If you do add it, you must include `response: Response` per the landmine note above.

## Do NOT
- Do not modify anything in `backend/src/modules/exercises/`.
- Do not create a new "add exercise to plan" endpoint — the frontend reuses the existing `POST /api/exercises` unchanged.
- Do not hardcode the muscle-group taxonomy anywhere.
- Do not store/cache derived thumbnail URLs in the database.
- Do not silently "fix" `back.json`'s data yourself — flag it via the seed script's validation warning and let the product owner fix the source file.

## Acceptance criteria
- [ ] Migration creates `exercise_library_items` with the columns above; revision id ≤32 chars; `alembic downgrade -1` works cleanly.
- [ ] Running the seed script against the current `exercise library/` folder loads `chest.json`, `back.json`, `biceps.json`, `rear_delt.json`'s real entries correctly, and skips the empty files without error.
- [ ] The filename-vs-muscle_group validation warning actually fires when tested against a deliberately mismatched fixture file (since no real mismatch exists in the current data to test against naturally).
- [ ] Running the seed script a second time without changing the JSON does not create duplicate rows (verify row counts before/after are identical).
- [ ] Editing one entry's `video_url` in a JSON file and re-running the seed script updates that row in place (verify via a DB query), rather than inserting a duplicate.
- [ ] `GET /api/exercise-library?q=lat+pull+down` returns a `"Bar Pull Down"`-style entry if one exists in the seeded data sharing "pull"/"down" — verify with a real entry from the seeded data that shares partial words with a plausible alternate-name query.
- [ ] `GET /api/exercise-library?muscle_group=chest` returns only chest entries.
- [ ] `GET /api/exercise-library/muscle-groups` returns exactly the distinct values present in the DB — add a brand-new muscle_group value via the seed data, re-seed, and confirm it appears without any code change.
- [ ] Every returned item includes a correctly-derived `thumbnail_url` for entries with a `video_url`, and `null` for entries without one.
- [ ] Both endpoints reject unauthenticated requests (401/403, matching how other authenticated routes in this codebase behave).

## Review checklist
- [ ] No route in this module is missing `response: Response` if it uses `@limiter.limit(...)` (see landmine note).
- [ ] Seed script path resolution doesn't depend on the invoking process's current working directory.
- [ ] New migration doesn't touch any existing table.
- [ ] Search scoring is a plain in-process function you can unit-test directly (pure function taking a query string and a list of names, returning ranked results) — not something entangled with the route handler, so it's testable without spinning up the DB.
