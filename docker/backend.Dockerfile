# ─── Build Stage ───
FROM node:20-alpine AS builder
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/ .
RUN npx prisma generate

# ─── Production Stage ───
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache dumb-init
COPY --from=builder /app .
USER node
EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=10s --retries=3 --start-period=30s \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
