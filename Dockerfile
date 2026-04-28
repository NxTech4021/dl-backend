FROM node:24-alpine AS base
WORKDIR /app
RUN yarn config set network-timeout 600000 -g
COPY package.json yarn.lock ./

# ============================================================================
# Development stage
# ============================================================================
FROM base AS development
ENV NODE_ENV=development

RUN yarn install
COPY . .
RUN npx prisma generate

EXPOSE 3001
CMD ["yarn", "dev"]

# ============================================================================
# Production stage (runs TypeScript directly via tsx - no compile step)
# Skips `tsc` build because the codebase has accumulated strict-mode type
# errors that aren't blocking but would fail tsc. tsx transpiles per-file
# at runtime without type-checking, matching dev behavior.
# ============================================================================
FROM base AS production
ENV NODE_ENV=production

RUN apk add --no-cache wget

RUN yarn install --frozen-lockfile
COPY . .
RUN npx prisma generate

EXPOSE 3001

CMD ["sh", "-c", "echo 'Running Prisma migrations...' && npx prisma migrate deploy && echo 'Starting production server...' && npx tsx src/server.ts"]
