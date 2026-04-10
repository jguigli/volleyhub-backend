# --- Stage 1: dev dependencies + source (used directly in dev mode) ---
FROM node:20-alpine AS builder

WORKDIR /app

COPY api/package*.json ./
RUN npm install

COPY api/ .

EXPOSE 3000

# Default CMD for dev (overridden by docker-compose.override.yml)
CMD ["npm", "run", "start:dev"]

# --- Stage 2: compile for production ---
FROM builder AS compile

RUN npm run build

# --- Stage 3: lean production image ---
FROM node:20-alpine AS production

WORKDIR /app

COPY api/package*.json ./
RUN npm install --omit=dev

COPY --from=compile /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]
