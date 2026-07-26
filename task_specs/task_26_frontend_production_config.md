# Task 26 — Frontend production build configuration

## Objective
Confirm and lock in the frontend's production build settings: no source maps shipped, the API base URL is correctly driven by environment at build time, and the build actually produces a clean static bundle ready to deploy.

## Context
- `frontend/vite.config.ts` currently has no explicit `build` config — Vite's default (`build.sourcemap: false`) already means no source maps ship today, but it's implicit; make it explicit so a future contributor doesn't accidentally flip it on for "debugging" and ship it.
- `frontend/src/api/client.ts` already reads `VITE_API_BASE_URL` from the environment (`const apiBaseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';`) — this is correct and doesn't need to change, just needs the right value set at deploy time (that's a hosting-dashboard step, not a code change — noted here for context, not as a requirement of this task).
- `frontend/package.json`'s `build` script is `tsc -b && vite build` — this already fails the build on TypeScript errors, which is good (don't want to deploy a build with type errors silently ignored). No change needed there, just confirm it stays that way.
- Check `frontend/package.json` dependencies for anything that looks like a leftover dev/testing tool listed as a production `dependency` rather than `devDependency` (e.g. `puppeteer` was spotted in `dependencies` — if it's only used for local testing/scripts and never imported by app code that ships to the browser, it should be moved to `devDependencies` so it's not treated as a runtime requirement, though Vite will still tree-shake it out of the browser bundle if unused either way — this is a hygiene fix, not a functional bug).

## Requirements
1. In `frontend/vite.config.ts`, add an explicit `build` section:
   ```ts
   export default defineConfig({
     plugins: [react()],
     build: {
       sourcemap: false,
     },
   })
   ```
2. Audit `frontend/package.json`: for each entry in `dependencies`, confirm it's actually imported somewhere under `frontend/src` (i.e., genuinely needed in the browser bundle). Anything that's only used by scripts/tooling (e.g. `puppeteer`, if unused by `src/`) should move to `devDependencies`. Don't remove any package — just correct which list it's in. If everything in `dependencies` is genuinely used by `src/`, no changes needed here — verify first, don't move things speculatively.
3. Run `npm run build` and confirm the output in `frontend/dist/` contains no `.map` files.
4. Confirm `.gitignore` already excludes `dist/` (it does, confirmed: `frontend/.gitignore` has `dist` and `dist-ssr`) — no change needed, just verify as part of this task's review.

## Do NOT
- Do not change `client.ts`'s environment-variable logic — it's already correct.
- Do not add environment-specific API URLs hardcoded anywhere in source — the existing `VITE_API_BASE_URL` env-var approach is the right pattern, keep it as the only mechanism.
- Do not remove or downgrade any dependency — this task only corrects `dependencies` vs `devDependencies` placement, nothing more.

## Acceptance criteria
- [ ] `npm run build` completes successfully and `frontend/dist/` contains no `.map` files.
- [ ] `npm run build` still fails (non-zero exit) if a deliberate TypeScript error is introduced temporarily — confirms `tsc -b` is still gating the build (then revert the deliberate error).
- [ ] `package.json`'s `dependencies` list only contains packages actually imported under `frontend/src`.

## Review checklist
- [ ] Verified live: ran the actual build, inspected `dist/` contents, confirmed no source maps.
