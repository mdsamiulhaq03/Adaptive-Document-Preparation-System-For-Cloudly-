FROM node:20-alpine AS base

WORKDIR /app

# Install Python + build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++ sqlite

# ── deps ──────────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
RUN npm ci --include=dev

# ── builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js (skip if GROQ_API_KEY isn't set at build time)
ENV GROQ_API_KEY=build_placeholder
RUN npm run build

# ── runner ────────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy build artifacts
COPY --from=builder /app/public ./public 2>/dev/null || true
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Create data directory (mounted as volume)
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
