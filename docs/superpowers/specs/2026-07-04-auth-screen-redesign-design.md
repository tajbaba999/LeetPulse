# Auth Screen Redesign — Design Spec

Date: 2026-07-04

## Problem

The current `AuthScreen.tsx` (rendered at `/`, split-screen marketing + form) has three issues:

1. The 3-line hero headline ("Know your coding trajectory, not just your streak.") reads awkwardly and doesn't communicate the product's actual value: AI-powered chat/analysis over your own LeetCode profile.
2. It shows fabricated stats ("743 problems solved", "47d streak") that aren't real user data.
3. The signup form collects a "LeetCode username" field, but the backend (`apps/backend/src/api/codingprofile/codingprofile.ts:43,414`) already falls back to a `LEETCODE_USERNAME` value in `.env` when no username is supplied — the field is redundant for this single-user/personal-project phase.

Separately, the user supplied a shadcn-registry-style `AuthUI` component (form + image/typewriter-quote split panel, Google sign-in button, "EaseMize UI" branding) to use as the new visual basis for sign-in/sign-up, with Google sign-in and the placeholder branding removed.

## Non-goals

- No multi-tenant LeetCode-username-per-user flow. Username resolution continues to rely on the existing `.env` fallback.
- No shadcn CLI installation (`components.json`, full primitive migration). Only the specific primitives this screen needs get added to `src/components/ui/`.
- No changes to `/dashboard`, `/sync` progress UI, or any other route beyond the one `SyncClient.tsx` guard described below.

## Current state (verified)

- Frontend: Tailwind v4, hand-rolled CSS variables in `globals.css` (`--bg`, `--surface`, `--border`, `--text`, `--text-dim`, `--accent` = brand blue, `--easy`/`--medium`/`--hard`). No shadcn CLI setup (no `components.json`), no Radix/CVA/clsx/tailwind-merge/lucide-react installed. `src/components/ui/` exists but is empty.
- `apps/frontend/src/app/page.tsx` renders `<AuthScreen />` at `/` when there's no session cookie.
- `AuthScreen.tsx` currently: tab-bar toggle (Sign in / Create account), Name/Email/Password/LeetCode-username fields, plain `<button>` submit, calls `signup()`/`signin()` from `lib/api-client.ts`, then `router.push` to `/sync?mode=initial&leetcode=...` or `/dashboard`.
- `SyncClient.tsx:23-26` currently hard-errors ("Missing LeetCode username — go back and sign up again.") when `mode === "initial" && !leetcode`. This must change since `leetcode` will now always be `undefined`.
- Backend `initial-sync` route (`codingprofile.ts:50-57`) calls `resolveUsername(raw?.leetcode)`, which falls back to `env.LEETCODE_USERNAME`. `streamSync()` in `api-client.ts:86` already sends `{ leetcode }` where `leetcode` can be `undefined` — no frontend change needed there.

## Design

### File plan

| File | Change |
|---|---|
| `apps/frontend/src/lib/utils.ts` | New. `cn()` helper (`clsx` + `tailwind-merge`). |
| `apps/frontend/src/components/ui/button.tsx` | New. `Button` + `buttonVariants` (CVA), tokens mapped per below. |
| `apps/frontend/src/components/ui/input.tsx` | New. `Input`. |
| `apps/frontend/src/components/ui/label.tsx` | New. `Label` (Radix `LabelPrimitive`). |
| `apps/frontend/src/components/ui/password-input.tsx` | New. Password field with show/hide toggle (`lucide-react` `Eye`/`EyeOff`). |
| `apps/frontend/src/components/ui/typewriter.tsx` | New. Typewriter-effect text component (as pasted, unmodified logic). |
| `apps/frontend/src/app/components/AuthScreen.tsx` | Rewritten. Replaces tab-bar + stat cards with form-left/image-right layout, dual quote/image per mode. |
| `apps/frontend/src/app/sync/SyncClient.tsx` | Edit. Remove the `!leetcode` early-return guard for `mode === "initial"`. |
| `apps/frontend/package.json` | Add `clsx`, `tailwind-merge`, `@radix-ui/react-slot`, `@radix-ui/react-label`, `class-variance-authority`, `lucide-react`. |

`HighlightCard`, `TabButton`, and the `leetcode` field/state in the old `AuthScreen.tsx` are deleted outright (not commented out, not kept behind a flag).

### Token adaptation

The pasted component's CSS block is **not** used — it defines shadcn's `--accent` as a light hover-gray, which would silently override this project's real `--accent` (brand blue, used app-wide). No new CSS variables are added to `globals.css`. Every shadcn-style class in the pasted component is re-mapped to existing tokens:

| shadcn class | Replacement |
|---|---|
| `bg-primary text-primary-foreground hover:bg-primary/90` | `bg-accent text-white hover:opacity-90` |
| `border-input`, `bg-background` | `border-border`, `bg-surface` |
| `hover:bg-accent hover:text-accent-foreground` (shadcn's gray-hover meaning, `outline` variant) | `hover:bg-surface-2` |
| `bg-secondary text-secondary-foreground hover:bg-secondary/80` | `bg-surface-2 text-text hover:bg-surface-2/80` |
| `ring-ring`, `ring-offset-background`, `focus-visible:ring-2` | Dropped. Use `focus-visible:border-accent focus-visible:outline-none` (matches existing `Field` component's current focus style). |
| `text-destructive`, `bg-destructive` | `text-hard`, `bg-hard` (existing difficulty-red token) |
| `text-primary-foreground/60` (link variant) | `text-accent` |
| Label: `text-sm font-medium` | `text-xs font-semibold text-text-dim` (matches existing `Field` label style) |

Submit buttons use the `default` (accent-filled) variant, not the pasted code's `outline` variant — matches the existing app's actual CTA style (`AuthScreen.tsx`'s current `bg-accent ... text-white` submit button).

### Layout

Two-column grid, form panel first (left), image+quote panel second (right) — per approved layout choice, matching the pasted component's own column order:

```
┌───────────┬──────────────────┐
│ LeetPulse │                  │
│  logo     │                  │
│           │  [image + quote] │
│ Sign in/  │                  │
│ Create    │                  │
│ account   │                  │
│  [form]   │                  │
│           │  © footer        │
└───────────┴──────────────────┘
```

- Left panel: small `LeetPulse` logo + wordmark above the form (reusing the existing `Logo()` SVG mark). Below it, the sign-in/sign-up form. Toggle between modes uses a text link ("Don't have an account? Sign up") below the form, replacing the current tab bar.
- Right panel: full-bleed background image, bottom gradient overlay, typewriter-effect quote + attribution, swapping per mode (image and quote both change when toggling sign-in/sign-up, matching the pasted component's `key`-based re-animation).
- No stat cards or feature-bullet replacement — panel stays clean per approved choice.

### Content

- Removed entirely: Google sign-in button + its divider, "LeetCode username" field, fake stat cards, all "EaseMize UI" branding/attribution.
- Sign-in state:
  - Image: `https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80` (verified HTTP 200)
  - Quote: *"Pick up right where your last submission left off."* — attributed to **LeetPulse**
  - Form sub-line: "Sign in to see your latest progress." (unchanged, already clear)
- Sign-up state:
  - Image: `https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80` (verified HTTP 200)
  - Quote: *"Ask your LeetCode profile anything. Get answers, not just numbers."* — attributed to **LeetPulse**
  - Form sub-line: "Link your LeetCode profile to get personalized analytics." (kept — still accurate without the username field, since linking happens automatically via `.env` + the `/sync` step)
- Fields:
  - Sign-in: Email, Password (via new `PasswordInput`, autocomplete `current-password`)
  - Sign-up: Full Name, Email, Password (via new `PasswordInput`, autocomplete `new-password`) — no LeetCode username field
- Post-submit routing unchanged in kind, just drops the query param: signup → `signup()` then `router.push("/sync?mode=initial")`; signin → `signin()` then `router.push("/dashboard")`.

### SyncClient.tsx fix

Remove the block:
```ts
if (mode === "initial" && !leetcode) {
  setError("Missing LeetCode username — go back and sign up again.");
  return;
}
```
`streamSync` already sends `leetcode: undefined` safely to `/api/backend/codingprofile/initial-sync`, which the backend resolves via `.env`. No replacement guard needed — if `.env`'s `LEETCODE_USERNAME` is genuinely unset, the backend's existing 400 response ("username query param is required...") surfaces through the existing SSE `error` event/`catch` path already wired in `SyncClient.tsx`.

## Testing / verification

1. `pnpm run check-types` (whole monorepo)
2. `pnpm run build`
3. Boot `pnpm run --filter @leetplus/frontend dev` (or the existing docker-compose frontend service, rebuilt), manually exercise in a browser:
   - Load `/`, confirm no session redirects to `/dashboard`
   - Toggle sign-in ↔ sign-up, confirm image/quote swap and no Google button/LeetCode field appear
   - Submit sign-up with a real backend running, confirm redirect to `/sync?mode=initial` (no `leetcode` param) and that sync starts without the old "Missing LeetCode username" error
   - Submit sign-in, confirm redirect to `/dashboard`
   - Password show/hide toggle works on both forms

## Open questions

None — all decisions confirmed with the user during brainstorming (panel order, marketing panel content, dependency approach, LeetCode-username resolution via `.env` fallback).
