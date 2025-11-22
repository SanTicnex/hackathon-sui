# syntax=docker/dockerfile:1
# Build and run the identity backend in production

FROM node:20-alpine AS base
WORKDIR /app

FROM base AS builder
# Install dependencies (no lockfile present, defaulting to npm)
COPY package.json ./
RUN npm install

# Copy source and build TypeScript to dist/
COPY . .
RUN npm run build

# Remove dev dependencies for a slimmer runtime image
RUN npm prune --omit=dev

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# These envs should be provided via docker-compose or runtime env vars
# ENV EUID_PACKAGE_ID=
# ENV AUTHORITY_ADDRESS=
ENV USE_REAL_WALLET=false

# Copy built assets and production deps
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 4000
CMD ["npm", "run", "start"]
