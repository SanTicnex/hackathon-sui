# syntax=docker/dockerfile:1
# Build and run the Next.js frontend in production

FROM node:20-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm" \
    PNPM_STORE_PATH="/pnpm-store" \
    PATH="$PNPM_HOME:$PATH"
RUN corepack enable && mkdir -p "$PNPM_HOME" "$PNPM_STORE_PATH"

FROM base AS deps
# Install dependencies with pnpm using the lockfile for reproducibility
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
# Copy deps and source, then build Next.js
COPY --from=deps /pnpm-store /pnpm-store
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

# Trim dev dependencies for the runtime image
RUN pnpm prune --prod

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000
# NEXT_PUBLIC_IDENTITY_BACKEND_URL should be provided via environment variables at runtime

# Copy production artifacts and deps
COPY --from=builder /pnpm-store /pnpm-store
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["pnpm", "start"]
