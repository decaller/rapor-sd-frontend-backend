# ── Backend Dockerfile ────────────────────────────────────────────────────────
# Node 22 LTS (Alpine for small image size).
# google-service-account.json is NOT baked in; it is bind-mounted at runtime.

FROM node:22-alpine

# Install dumb-init for proper signal handling (clean shutdown of Node)
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy dependency manifests first for layer-caching
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy application source
COPY . .

# Create the database directory that will be volume-mounted
RUN mkdir -p /app/database

EXPOSE 3000

# Use dumb-init so SIGTERM is properly forwarded to Node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
