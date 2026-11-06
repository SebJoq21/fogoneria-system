-- Base auxiliar para `prisma migrate dev`.
-- Este script solo corre la primera vez que se inicializa el volumen `pgdata`.
-- Si cambias POSTGRES_DB, ajusta también SHADOW_DATABASE_URL en apps/api/.env.
CREATE DATABASE fogoneria_shadow;
