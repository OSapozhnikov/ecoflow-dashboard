# Stage 1: Build Shared
FROM node:22-alpine AS shared-builder
WORKDIR /app/shared
COPY shared/package*.json ./
COPY shared/tsconfig.json ./
COPY shared/src ./src
RUN npm ci && npm run build

# Stage 2: Build Client
FROM node:22-alpine AS builder
WORKDIR /app
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
# Copy built shared package
COPY --from=shared-builder /app/shared/dist ./shared/dist
COPY --from=shared-builder /app/shared/src ./shared/src
RUN npm run build

# Stage 3: Production
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
