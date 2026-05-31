# ─── Build Stage ───
FROM node:20-alpine AS builder
WORKDIR /app
COPY worker/package*.json ./
RUN npm ci --only=production
COPY worker/ .

# worker shares Prisma schema from backend
COPY backend/prisma ./prisma
RUN npx prisma generate

# ─── Production Stage ───
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache dumb-init
COPY --from=builder /app .
USER node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
