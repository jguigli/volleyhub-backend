# --- Stage 1: build ---
FROM node:20-alpine AS builder

WORKDIR /app

COPY api/package*.json ./
RUN npm install

COPY api/ .

RUN npm run build

# --- Stage 2: production ---
FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]
