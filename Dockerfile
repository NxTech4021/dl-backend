FROM node:20-alpine3.17 AS base
WORKDIR /app
COPY package.json ./
COPY package-lock.json ./

FROM base AS development
ENV NODE_ENV=development
RUN npm ci
COPY . .
RUN npm install -g prisma
RUN npx prisma generate
EXPOSE 3001
# CMD ["sh", "-c", "echo 'Waiting for database...' && sleep 5 && echo 'Running Prisma migrations...' && npx prisma migrate deploy && echo 'Prisma migration complete' && echo 'Starting development server...' && npm run dev"]
CMD ["sh", "-c", "until pg_isready -h dl-postgres -p 5432 -U postgres; do echo 'Waiting for database...'; sleep 2; done && echo 'DB ready!' && npx prisma migrate deploy || npx prisma db push && npm run dev"]

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
