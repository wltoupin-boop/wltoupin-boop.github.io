# ============================================================
# Stage 1: Builder — Node 20, install deps, build React app
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

# Copy source and build
COPY . .

# Build args allow CI to inject environment-specific values
ARG VITE_API_URL=""
ARG VITE_ENVIRONMENT="production"
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ENVIRONMENT=$VITE_ENVIRONMENT

RUN npm run build

# ============================================================
# Stage 2: Runtime — nginx serving the static bundle
# ============================================================
FROM nginx:1.27-alpine AS runtime

LABEL maintainer="Cell & Gene Therapy Platform <platform@example.com>"

# Remove default nginx config and replace with our SPA config
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the React build output from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx runs as root by default; for Cloud Run this is fine.
# For extra hardening in other environments, use a non-root setup.

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
