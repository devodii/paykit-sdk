FROM node:20-alpine AS builder
WORKDIR /app
COPY apps/telemetry/package.json ./
RUN npm install -g pnpm && pnpm install
COPY apps/telemetry/tsconfig.json ./
COPY apps/telemetry/src ./src
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY apps/telemetry/package.json ./
RUN npm install -g pnpm && pnpm install --prod
CMD ["node", "dist/index.js"]
