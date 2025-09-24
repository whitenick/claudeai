FROM oven/bun:1 as base

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Production image
FROM oven/bun:1-slim as production

WORKDIR /app

# Create nodejs group and use existing bun user
RUN addgroup --system --gid 1001 nodejs && \
    usermod -a -G nodejs bun

# Copy built application
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./

# Change ownership
RUN chown -R bun:nodejs /app

# Switch to non-root user
USER bun

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Expose port
EXPOSE 3000

# Start the application
CMD ["bun", "start"]