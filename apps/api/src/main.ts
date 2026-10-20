import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import { setupSwagger } from './swagger.js';

/** El onboarding manda el logo como data URL; 100 KB por defecto no alcanza. */
const BODY_LIMIT = '4mb';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: BODY_LIMIT }));
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
