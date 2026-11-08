# ── Stage 1: build React client ──────────────────────────────────
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# ── Stage 2: production server ────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/ ./
# Copy built React app to be served by Express (optional static serving)
COPY --from=client-build /app/client/build ./public

EXPOSE 5000
CMD ["node", "index.js"]
