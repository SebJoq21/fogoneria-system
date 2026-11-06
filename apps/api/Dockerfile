# syntax=docker/dockerfile:1
# Imagen de la API NestJS (Fogonería). Construye el monorepo con pnpm y deja
# solo lo necesario para ejecutar `dist/main.js` y Prisma (migraciones/seed).

FROM node:24-bookworm-slim AS build
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@11.25.0
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile --filter api...

COPY . .
# `prisma generate` (prebuild) valida el config y exige la variable, aunque no
# se conecta a la base durante el build.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=fogoneria"
RUN pnpm --filter api build

FROM node:24-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=build /app/apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY --from=build /app/apps/api/src/generated ./apps/api/src/generated

WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
