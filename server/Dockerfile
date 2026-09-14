# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Build Shared
FROM node:22-alpine AS shared-builder
WORKDIR /app/shared
COPY shared/package*.json ./
COPY shared/tsconfig.json ./
COPY shared/src ./src
RUN npm ci && npm run build

# Stage 3: Build Server
FROM node:22-alpine AS builder
WORKDIR /app
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
# Copy built shared package
COPY --from=shared-builder /app/shared/dist ./shared/dist
COPY --from=shared-builder /app/shared/src ./shared/src
RUN npm run build

# Stage 4: Runtime
FROM node:22-alpine AS runtime
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
WORKDIR /app
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --chown=nodejs:nodejs server/package*.json ./
# Bundled contract defaults (seeded into DATA_DIR/contracts when empty)
COPY --chown=nodejs:nodejs server/src/contracts/defaults ./contracts/defaults
# Writable data dir for SQLite / settings (compose mounts ./data → /app/data)
RUN mkdir -p /app/data/contracts && chown -R nodejs:nodejs /app/data
USER nodejs
ENV DATA_DIR=/app/data
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
CMD ["node", "dist/index.js"]
