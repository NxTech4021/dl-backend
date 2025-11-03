FROM node:20-alpine3.17 AS base
WORKDIR /app
COPY package.json ./
COPY package-lock.json ./

FROM base AS development
ENV NODE_ENV=development
RUN npm i
COPY . .
RUN npm install -g prisma tsx nodemon
RUN npx prisma generate

EXPOSE 3001
# Use nodemon with legacy-watch (polling) for Windows Docker compatibility
# --legacy-watch: Use polling instead of file system events (fixes Windows/WSL2 issues)
# --poll-interval 1000: Check for changes every 1 second
# -e ts: Watch TypeScript files
CMD ["sh", "-c", "echo 'Waiting for database...' && sleep 5 && echo 'Starting server with nodemon + tsx (polling mode)...' && npx nodemon --legacy-watch -e ts --exec tsx src/server.ts"]

FROM node:20-alpine3.17 AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source files
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

FROM node:20-alpine3.17 AS production
ENV NODE_ENV=production

WORKDIR /app

# Copy package files and install production dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy built files and necessary folders
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Generate Prisma client in production environment
RUN npx prisma generate

EXPOSE 3001

# Debug: Show the final directory structure (excluding node_modules)
RUN echo "Final directory structure (excluding node_modules):" && \
    find /app -not -path "*/node_modules/*" -not -name "node_modules"

# Debug: Check file permissions
RUN ls -l /app/dist/server.js

# Debug: Print current working directory
RUN pwd

WORKDIR /app

# Use shell command for production startup with migrations
CMD ["sh", "-c", "echo 'Waiting for database...' && sleep 5 && echo 'Running Prisma migrations...' && npx prisma migrate deploy && echo 'Prisma migration complete' && echo 'Starting production server...' && cd dist && node server.js"]
