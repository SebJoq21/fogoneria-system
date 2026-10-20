import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import { setupSwagger } from './swagger.js';

/**
 * El alta pública manda el logo como data URL (hasta ~2 MB), por eso solo esa
 * ruta sube el límite del body; el resto se queda con los 100 KB por defecto.
 */
const ONBOARDING_BODY_LIMIT = '4mb';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use('/api/v1/onboarding', json({ limit: ONBOARDING_BODY_LIMIT }));
  app.use(json());
  app.use(urlencoded({ extended: true }));
  configureApp(app);
  setupSwagger(app);
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') ?? 3001;

  await app.listen(port);
  console.log(`API Fogonería escuchando en http://localhost:${port}/api/v1`);
  console.log(`Swagger en http://localhost:${port}/api/docs`);
}

await bootstrap();
