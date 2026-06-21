# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (`pnpm-lock.yaml` is the lockfile).

```sh
pnpm install              # install deps
pnpm run dev               # tsx watch, loads .env, http://localhost:3000
pnpm run build              # tsc -> dist/
pnpm start                  # run compiled dist/src/index.js (needs .env)
pnpm run lint               # eslint --fix src test
pnpm run typecheck          # tsc --noEmit
pnpm run test                # vitest run
```

Run a single test file: `pnpm vitest run test/api.test.ts`
Run a single test by name: `pnpm vitest run -t "responds with a json message"`

Prisma: `pnpm prisma migrate dev`, `pnpm prisma generate` (schema at `prisma/schema.prisma`, migrations in `prisma/migrations/`).

### Known gotcha: `pnpm test` currently fails standalone

`src/env.ts` validates env vars at import time with zod and calls `process.exit(1)` if `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` are missing. `dev` and `start` pass `--env-file=.env`, but the `test` script (`vitest run`) does not, so a plain `pnpm test` aborts unless those vars are already exported in the shell. Run it as `node --env-file=.env ./node_modules/.bin/vitest run` (or export the vars first) when verifying test changes. Separately, `test/api.test.ts` expects `GET /api/v1/emojis` (`src/api/emojis.ts`) to return 200, but that router is not currently mounted in `src/api/index.ts` — that test fails until it's wired up. The committed `dist/` directory also contains stale compiled test files that vitest's default glob picks up and fails on (CJS/ESM mismatch); ignore those, they're build output, not source.

## Architecture

Express v5 + TypeScript "API starter" (see README.md), structured around a single Express app:

- `src/index.ts` boots the HTTP server (`env.PORT`) on top of `src/app.ts`.
- `src/app.ts` wires global middleware (`morgan`, `helmet`, `cors`) and mounts the feature router from `src/api/index.ts` at `/api/v1`. 404 and error handling middleware (`src/middlewares.ts`) are mounted last.
- `src/api/index.ts` is the central router: `/signup`, `/signin`, and `/refresh-token` are mounted **before** `authenticateToken`, so they stay public. `authenticateToken` is then applied with `router.use(...)`, so every route registered after it in this file is protected automatically — add new protected feature routers below that line, public ones above it.

### Auth model (JWT access + refresh)

- `src/utils/tokens.ts` generates/verifies access tokens (15m, `JWT_ACCESS_SECRET`) and refresh tokens (7d, `JWT_REFRESH_SECRET`) via `jsonwebtoken`. Payload shape is `{ userId, email }` (`TokenPayload`).
- `src/api/auth/singup.ts` and `src/api/auth/signin.ts` hash/verify passwords with `bcrypt` and return both tokens as `{ accessToken, refreshToken }` on success.
- `authenticateToken` in `src/middlewares.ts` only validates the access token from the `Authorization: Bearer <token>` header — valid → sets `req.user = { userId, email }` and calls `next()`; missing/invalid/expired → `401` with a `{ message }` body (no auto-refresh inside the middleware; that was tried and deliberately removed as non-standard).
- `src/api/auth/refresh-token.ts` (`POST /api/v1/refresh-token`, public) is the standard way to renew: client posts `{ refreshToken }`, the route verifies it with `verifyRefreshToken` and responds `{ accessToken }` (or `401 { error }` if the refresh token is invalid/expired). The client then retries the original request with the new access token. Validated by `refreshTokenSchema` in `src/validators/refreshtoken.validator.ts`.
- `req.user` typing comes from the ambient augmentation in `src/types/express.d.ts`.

### Validation & response conventions

- Request bodies are validated with `zod` schemas under `src/validators/*.validator.ts`, re-exported via `src/validators/index.ts`. Routes call `.safeParse` and on failure respond `422` with `z.prettifyError(result.error)`.
- There are two different error envelope shapes in use — route handlers (signup/signin) return `{ error: string }`, while the global `errorHandler` and `authenticateToken` middleware return `{ message: string, stack? }` (per `src/interfaces/error-response.ts`). Match whichever convention the surrounding code uses rather than introducing a third.
- Request/response types for each route live in `src/interfaces/*.ts` and are passed as generics to `express.Router()` handlers (e.g. `router.post<SinginRequest, SigninResponse>`).

### Env & DB

- `src/env.ts` is the single source of validated env vars (`NODE_ENV`, `PORT`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) — import `{ env }` from here rather than reading `process.env` directly (the `node/no-process-env` eslint rule enforces this). Note `DATABASE_URL` is the exception: it's read directly via `process.env` in `src/db.ts` and `prisma.config.ts`, not part of the `env.ts` schema.
- `src/db.ts` creates a single `PrismaClient` (using the `@prisma/adapter-pg` driver adapter) cached on `globalThis.prismaGlobal` outside production, to avoid creating new clients on every hot-reload during `pnpm run dev`.

## Code style

- Local imports must use explicit `.js` extensions even from `.ts` source (`import x from "./foo.js"`) — enforced by `node/file-extension-in-import` in `eslint.config.mjs` (antfu config base). Filenames are kebab-case (`unicorn/filename-case`).
- Types use `type X = {}` rather than `interface` (`ts/consistent-type-definitions`).
