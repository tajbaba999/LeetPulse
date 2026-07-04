FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Build stage
FROM base AS builder
WORKDIR /app

# Copy workspace config and package files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/db/package.json ./packages/db/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/backend ./apps/backend
COPY packages/db ./packages/db
COPY packages/typescript-config ./packages/typescript-config
COPY packages/eslint-config ./packages/eslint-config

# Generate Prisma client and build
WORKDIR /app/packages/db
RUN npx prisma generate
WORKDIR /app/apps/backend
RUN pnpm run build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy workspace config
COPY pnpm-workspace.yaml package.json ./

# Copy built packages
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/packages/typescript-config ./packages/typescript-config

# Copy backend dist and node_modules
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder /app/apps/backend/package.json ./apps/backend/

# Copy root node_modules (workspace hoisting)
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

WORKDIR /app/apps/backend
CMD ["node", "dist/src/index.js"]
