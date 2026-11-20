import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

/** Configuración OpenAPI compartida por Swagger UI y `scripts/export-openapi.mjs`. */
export function buildSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('Fogonería API')
    .setDescription(
      'ERP gastronómico multitenant: auth JWT, RLS por empresa/sucursal, catálogo, precios y consola SaaS.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
}

/** Documento OpenAPI de la app (sin levantar un puerto). */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  return SwaggerModule.createDocument(app, buildSwaggerConfig());
}

export function setupSwagger(app: INestApplication): void {
  const document = createOpenApiDocument(app);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
