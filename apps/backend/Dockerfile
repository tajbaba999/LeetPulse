FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ── dev: src/ is mounted as a volume at runtime ───────────────────────────────
FROM deps AS dev
WORKDIR /app
COPY prisma ./prisma
COPY prisma.config.ts ./
EXPOSE 3000
CMD ["sh", "-c", "pnpm prisma generate && pnpm prisma migrate deploy && pnpm exec tsx src/index.ts"]

# ── build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY . .
RUN pnpm run build

# ── production ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS production
RUN corepack enable && corepack prepare pnpm@9 --activate
ENV NODE_ENV=production
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma
COPY prisma.config.ts ./
EXPOSE 3000
CMD ["sh", "-c", "pnpm prisma generate && pnpm prisma migrate deploy && node dist/src/index.js"]
