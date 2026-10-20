import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import { setupSwagger } from './swagger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
