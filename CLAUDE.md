# CLAUDE.md

Guidance for AI agents working in this repository.

## Project Overview

LeetPlus is a LeetCode analytics platform with AI-powered RAG (Retrieval-Augmented Generation) for answering coding questions.

It is a **pnpm**-managed **Turborepo** monorepo.

- `apps/backend` — Express + TypeScript API. Auth (JWT), LeetCode data fetching, RAG pipeline, BullMQ workers.
- `apps/frontend` — Next.js 16 + React 19 SPA. Dashboard for LeetCode analytics.
- `packages/db` — Prisma schema + client (`@leetplus/db`). Shared Postgres data layer.
- `packages/typescript-config` — Shared `tsconfig` presets.
- `packages/eslint-config` — Shared ESLint config.

## Conventions

- Package manager is **pnpm**. Use `pnpm install`, `pnpm run <script>`.
- Backend imports use `.js` extensions (NodeNext).
- Frontend uses the `@/` alias for `src/`.
- Keep all Prisma access in the `@leetplus/db` package.
- Commit messages follow conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `db:`, `docs:`.

## Common Commands

```sh
pnpm install                 # install all workspace deps
pnpm run db:generate         # generate the Prisma client
pnpm run db:migrate          # apply Prisma migrations
pnpm run dev                 # run all apps with hot reload (turbo)
pnpm run build               # build everything
pnpm run check-types         # type-check the whole monorepo
pnpm run lint                # lint
```

Per app:

```sh
pnpm run --filter @leetplus/backend dev
pnpm run --filter @leetplus/frontend dev
```

## Verification

Before considering a change complete:

1. `pnpm run check-types` (must pass).
2. `pnpm run build` (must pass).
3. For backend logic, smoke-test by booting `pnpm run --filter @leetplus/backend dev`
   and hitting `http://localhost:3000/api/v1/`.

## Environment

Secrets are configured via `.env` files in each app. See `.env.example` at the repo root.
