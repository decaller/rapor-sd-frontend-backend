# ── Frontend Dockerfile (Astro) ───────────────────────────────────────────────
# Stage 1: Build the Astro static site
# Stage 2: Serve the dist/ folder with a lightweight static file server

# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for layer-caching
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm install

# Copy source files
COPY . .

# Build the Astro site → outputs to ./dist
RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache dumb-init

WORKDIR /app

# Install a minimal static file server globally
RUN npm install -g serve@14

# Copy only the built output from the builder stage
COPY --from=builder /app/dist ./dist

EXPOSE 4321

ENTRYPOINT ["dumb-init", "--"]
# serve flags:
#   -l 4321   → listen on port 4321
#   --single  → SPA mode: fall back to index.html for unknown routes
CMD ["serve", "dist", "-l", "4321", "--single"]
