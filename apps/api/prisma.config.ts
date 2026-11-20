import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
    // Prisma 7 usa esta URL para `migrate diff --from-migrations` (el flag
    // --shadow-database-url ya no existe). Debe ser una base aparte, nunca la
    // de negocio: el comando la vacía al aplicar las migraciones.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL?.trim() || undefined,
  },
});
