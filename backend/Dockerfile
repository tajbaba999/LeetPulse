FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN bun install

# ── dev: src/ is mounted as a volume at runtime ───────────────────────────────
FROM deps AS dev
WORKDIR /app
COPY prisma ./prisma
COPY prisma.config.ts ./
EXPOSE 3000
CMD ["sh", "-c", "bunx prisma generate && bunx prisma migrate deploy && bun --watch src/index.ts"]

# ── production ────────────────────────────────────────────────────────────────
FROM deps AS production
ENV NODE_ENV=production
WORKDIR /app
COPY . .
EXPOSE 3000
CMD ["sh", "-c", "bunx prisma generate && bunx prisma migrate deploy && bun src/index.ts"]
