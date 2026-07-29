# Task 34 — Frontend: username picker with live availability check

## Objective
Add a "Username" field to registration where the user types their own username and gets instant, cheap feedback on whether it's available — instead of the system generating one for them. Relabel the existing free-text field to "Nickname" (used only for greeting the user, e.g. Dashboard's "Welcome back"). Remove the "Login Username" card from the Dashboard, since usernames are now self-chosen and memorable.

Depends on Task 33 (backend `GET /api/auth/check-username` and the updated `/api/auth/register` contract).

## Context
- `frontend/src/features/auth/RegisterPage.tsx` is the only file with real logic changes. It currently has one text field (`displayName`) and one password field, submits via `authApi.register(displayName, password)`, and on success shows `RegistrationSuccessDialog`.
- `frontend/src/api/authApi.ts` — `RegisterRequest` currently has `{ display_name, password }`; `register()` takes `(displayName, password)`. Both need a `username` added. Add a new `checkUsernameAvailability(username: string): Promise<{available: boolean; reason?: string}>` calling `GET /auth/check-username?username=...` (see `client.ts` for the existing axios instance pattern other API files use).
- `frontend/src/features/auth/RegistrationSuccessDialog.tsx` — **needs no changes**. It only ever receives and displays whatever `username` string it's given (see its props: `{ username, password }`) — it has no idea whether that username was generated or typed by the user, so nothing here depends on how it was chosen.
- `frontend/src/pages/Dashboard.tsx` lines ~57-68 — the "Login Username" pill card to remove:
  ```tsx
  <div style={{ textAlign: 'right' }}>
    <p style={{ ... }}>Login Username</p>
    <div style={{ ...border etc... }}>
      <UserIcon .../> <span>@{currentUser?.username}</span> <ChevronDownIcon .../>
    </div>
  </div>
  ```
  This whole right-hand block goes away. Check afterward whether `UserIcon`/`ChevronDownIcon` are still used elsewhere in `Dashboard.tsx` — if not, remove the now-unused imports too.

## Requirements

### 1. Relabel the existing field
Change the "Display Name" label/id/placeholder to "Nickname" (e.g. label "Nickname", placeholder "What should we call you?"). No change to the underlying state variable's *behavior* — it's still free text, still sent as `display_name` in the request body (backend field name is unchanged per Task 33 — only the UI-facing label changes).

### 2. Add the Username field, with live availability checking
Add a new required text input for `username`, positioned between Nickname and Password. Implement:
- **Client-side format pre-check, before any network call**: 3-20 characters, must start with a letter, only lowercase letters/digits/underscore after that (mirror the exact rule from Task 33's backend validator so the two never disagree). Auto-lowercase the input as the user types (transform on each keystroke, or on blur — pick whichever feels less jarring while typing; auto-lowercasing on every keystroke is simplest and matches the backend's own normalization). If the current value fails this check, show the specific format problem inline immediately and skip the network call entirely — this is the "don't waste a request on obviously-bad input" optimization from the plan.
- **Debounce**: only fire `checkUsernameAvailability()` ~400ms after the user stops typing a plausibly-valid candidate. Use a standard debounce pattern (a `useEffect` with a `setTimeout`/`clearTimeout` keyed on the username value, or a small debounce hook if one already exists in the codebase — check `frontend/src/utils/` first before writing a new one).
- **Stale-response guard**: if the user keeps typing while a check is in flight, the eventual response for an older value must not overwrite the UI state for whatever the user has since typed. Track the username the in-flight request was for (e.g. a ref or closure variable) and ignore the response if it no longer matches the current input value.
- **Inline status text** below the field, updating live:
  - Empty/untouched: no message.
  - Invalid format: the specific reason (e.g. "Must be 3-20 characters", "Only lowercase letters, numbers, and underscores allowed", "Must start with a letter") — shown instantly, no network round-trip.
  - Checking (valid format, request in flight): "Checking availability…"
  - Available: "✓ Username available" (success styling, e.g. `var(--success)`).
  - Taken: "✗ Username already taken" (error styling).
- **Block submission** until the current username has been confirmed available (soft-disable the Register button, or validate on submit and show an error, matching whatever pattern `CreatePlanStep1.tsx`'s `isValid`/soft-disabled button already uses elsewhere in this codebase for consistency).

### 3. Update `authApi.ts`
- `RegisterRequest`: add `username: string`.
- `register()`: add a `username` parameter, include it in the POST body.
- New function `checkUsernameAvailability(username: string): Promise<{ available: boolean; reason?: string }>` — a plain `GET` with the username as a query param, no auth header needed (matches the backend route having no auth dependency).

### 4. Update the registration submit handler in `RegisterPage.tsx`
Pass the username through to `authApi.register(nickname, username, password)` (or however the updated signature ends up ordered — keep it consistent with the schema change in Task 33). On a `409` from the server (race-condition case — someone else took the name in the last few seconds), surface it as a normal form error (reuse the existing `error`/dismiss-button pattern already in this file) rather than crashing or showing a generic message — the user should be able to just try a different username and resubmit.

### 5. Dashboard cleanup
Remove the "Login Username" card block described in Context above. Clean up now-unused icon imports if applicable.

## Do NOT
- Do not change `RegistrationSuccessDialog.tsx` — confirmed above it needs no edits.
- Do not change the `/login` flow, `LoginPage.tsx`, or anything about how login works — only registration and the Dashboard card change.
- Do not let the availability check fire on every keystroke without debouncing — that defeats the entire point of keeping this cheap.
- Do not treat a client-side "available" result as final — the actual `POST /auth/register` call can still come back with a 409 (race condition), and that must be handled gracefully, not treated as impossible.
- Do not duplicate the format-validation regex/rules in a way that could drift from the backend's rules — keep them written once, clearly, and identical in spirit to Task 33's validator (character set, length, starts-with-letter).

## Acceptance criteria
- [ ] Typing a too-short or invalid-character username shows the specific format error instantly, with no network request fired (verify via network tab/dev tools — no `check-username` call for invalid input).
- [ ] Typing a valid-format, already-taken username shows "Checking availability…" briefly, then "✗ Username already taken."
- [ ] Typing a valid-format, available username shows "Checking availability…" then "✓ Username available."
- [ ] Typing fast (multiple keystrokes within the debounce window) results in only one network request firing for the final value, not one per keystroke.
- [ ] Register button is blocked/soft-disabled while username is invalid, unchecked, or taken; enabled once available.
- [ ] Registering successfully with a valid, available username and nickname still works end-to-end, still shows `RegistrationSuccessDialog` with the chosen username, still allows continuing to login with it pre-filled.
- [ ] Dashboard no longer shows the "Login Username" pill card; the rest of the Dashboard header layout still looks correct without it (no leftover empty space/broken flex layout).
- [ ] No TypeScript errors.

## Review checklist
- [ ] Debounce and stale-response-guard logic is actually present and testable (not just "usually works because requests are fast in dev") — verify by simulating a slow/delayed response if possible, or at minimum by reasoning through the code that an out-of-order response can't win.
- [ ] Format validation rule (character set, length, starts-with-letter) matches Task 33's backend rule exactly, so a username that passes client-side never gets rejected server-side for format reasons (only for availability/race-condition reasons).
- [ ] No dead imports left in `Dashboard.tsx` after removing the username card.
