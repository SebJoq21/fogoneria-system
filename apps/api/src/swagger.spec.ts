import { describe, expect, it, vi } from 'vitest';
import { SwaggerModule } from '@nestjs/swagger';
import { buildSwaggerConfig, createOpenApiDocument, setupSwagger } from './swagger.js';

const app = {} as never;
const document = { openapi: '3.0.0', info: { title: 'x', version: '1' } };

describe('swagger', () => {
  it('buildSwaggerConfig describe la API y declara Bearer', () => {
    const config = buildSwaggerConfig();

    expect(config.info?.title).toBe('Fogonería API');
    expect(config.info?.version).toBe('1.0.0');
    expect(config.components?.securitySchemes).toHaveProperty('bearer');
  });

  it('createOpenApiDocument delega el documento en Nest', () => {
    const createDocument = vi
      .spyOn(SwaggerModule, 'createDocument')
      .mockReturnValue(document as never);

    expect(createOpenApiDocument(app)).toBe(document);
    expect(createDocument).toHaveBeenCalledWith(app, expect.any(Object));

    createDocument.mockRestore();
  });

  it('setupSwagger monta la UI en /api/docs', () => {
    const createDocument = vi
      .spyOn(SwaggerModule, 'createDocument')
      .mockReturnValue(document as never);
    const setup = vi.spyOn(SwaggerModule, 'setup').mockImplementation(() => undefined);

    setupSwagger(app);

    expect(setup).toHaveBeenCalledWith('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    setup.mockRestore();
    createDocument.mockRestore();
  });
});
