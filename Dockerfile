# ─── Build stage ───
FROM node:22-alpine AS builder
WORKDIR /app

# Install all deps (incl. dev) for the build
COPY package.json package-lock.json ./
RUN npm ci

# Build server + client bundles into dist/
COPY tsconfig.json tsdown.config.ts ./
COPY scripts ./scripts
COPY src ./src
COPY public ./public
RUN npm run build

# ─── Runtime stage ───
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Production deps only (qrcode, ws)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Built output + seed data (questions live under data/questions)
COPY --from=builder /app/dist ./dist
COPY data ./data

EXPOSE 3000

# Graceful shutdown: the server handles SIGTERM (saves games) — run node as PID 1
CMD ["node", "dist/server/index.js"]
