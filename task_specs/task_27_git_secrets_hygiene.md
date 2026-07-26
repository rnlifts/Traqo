# Task 27 — Git and secrets hygiene pass

## Objective
Close the small remaining gaps in git hygiene before this repo is treated as production-facing: add a root-level `.gitignore` safety net, and do a final confirming sweep for anything sensitive that shouldn't be tracked.

## Context (already checked — good news first)
- This is already a real git repo with a GitHub remote (`origin` → `rnlifts/Traqo`), currently 3 commits ahead of `origin/main`.
- `backend/.env` and `frontend/.env.local` are correctly gitignored (`backend/.gitignore` excludes `.env`; `frontend/.gitignore` excludes `*.local`) and were confirmed via full git history search (`git log --all --diff-filter=A --name-only | grep -i "\.env$"`) to have **never** been committed — no secret rotation is needed, nothing leaked historically.
- Dependencies (`requirements.txt`) are version-pinned; `node_modules`/`venv`/`__pycache__` are correctly excluded.
- A search across `backend/src` and `frontend/src` for hardcoded credentials/connection-string patterns (`postgresql://user:pass@`, AWS-style keys, private key blocks) found none.
- The **root** `.gitignore` exists but is empty — `backend/.gitignore` and `frontend/.gitignore` already cover their own directories, so this isn't an active leak, just a missing safety net for anything created at the repo root in the future (e.g. a root-level `.env`, editor config, OS files).

## Requirements
1. Populate the root `.gitignore` with common cross-cutting ignores that aren't already covered by the subdirectory ones:
   ```
   .env
   .env.local
   .env.*.local
   .DS_Store
   Thumbs.db
   *.log
   ```
2. Do a final manual sweep: run `git status` and `git diff --stat` and read through the list of currently modified/untracked files (this repo has uncommitted changes sitting from this session's work) — confirm nothing in that list is a credentials file, a database dump, or anything containing real user data before it eventually gets committed. Flag anything suspicious in your completion report rather than deciding unilaterally to commit or discard it.
3. Do NOT commit anything as part of this task — this is a hygiene/config task only. Committing and pushing is a separate, explicit step the owner does themselves (per this project's standing rule: only commit when explicitly asked).

## Do NOT
- Do not run `git add` / `git commit` / `git push` — outside this task's scope, and the owner should review and commit their own work.
- Do not rotate or regenerate any secrets — nothing leaked, so there's nothing to rotate. (If the sweep in step 2 finds something unexpected, stop and report it rather than acting on it.)
- Do not delete or modify `backend/.env` or `frontend/.env.local` — they're correctly untracked already, leave their contents alone.

## Acceptance criteria
- [ ] Root `.gitignore` exists with the patterns listed above.
- [ ] `git status` after this change shows no previously-untracked sensitive files becoming newly ignored in a way that would hide something already meant to be tracked (i.e., double check the new root `.gitignore` doesn't accidentally start ignoring a file that's currently tracked and shouldn't be).
- [ ] Completion report includes the full current `git status` output and explicitly states whether anything suspicious was found in the sweep.

## Review checklist
- [ ] Confirm no `git add`/`commit`/`push` was run.
- [ ] Confirm the sweep in requirement 2 was actually done (not skipped) and its findings are reported.
