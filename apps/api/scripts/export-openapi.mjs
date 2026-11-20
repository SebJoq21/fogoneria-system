/**
 * Exporta el contrato OpenAPI a `docs/openapi.json` sin levantar el puerto.
 *
 * Corre sobre `dist/` (el mismo artefacto que se despliega) porque `tsx`/esbuild
 * no emite `design:paramtypes` y Nest no puede resolver la inyección de
 * dependencias desde TypeScript. `pnpm openapi:export` compila antes.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';
import { createOpenApiDocument } from '../dist/swagger.js';

console.log('Exportando OpenAPI…');
const app = await NestFactory.create(AppModule, { logger: ['error'], abortOnError: false });
try {
  const document = createOpenApiDocument(app);
  const target = resolve(dirname(fileURLToPath(import.meta.url)), '../../../docs/openapi.json');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  console.log(`OpenAPI exportado en ${target}`);
} finally {
  await app.close();
}
