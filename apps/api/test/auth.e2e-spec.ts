import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { AuthService } from './../src/modules/auth/auth.service.js';
import { SaasService } from './../src/modules/saas/saas.service.js';
import { configureApp } from './../src/bootstrap.js';
import { createPrismaMock } from './prisma-mock.js';

const loginResponse = {
  accessToken: 'jwt-token',
  tokenType: 'Bearer',
  expiresIn: '8h',
  user: {
    id: 'u1',
    nombre: 'Ana',
    email: 'ana@fuego.pe',
    rol: 'ADMIN_GLOBAL',
    empresaId: 'e1',
    sucursalId: 's1',
  },
  tenant: { id: 'e1', nombre: 'El Fuego', estado: 'ACTIVE', plan: 'PROFESIONAL', trialFin: null },
};

describe('Auth y RBAC (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createPrismaMock())
      .overrideProvider(AuthService)
      .useValue({
        login: vi.fn().mockResolvedValue(loginResponse),
        me: vi.fn(),
      })
      .overrideProvider(SaasService)
      .useValue({ metrics: vi.fn().mockResolvedValue({ mrr: 0 }) })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/auth/login devuelve token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'ana@fuego.pe', password: 'Fogoneria123!' })
      .expect(200);

    expect(response.body.accessToken).toBe('jwt-token');
  });

  it('rechaza un login con email inválido', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'no-es-email', password: 'Fogoneria123!' })
      .expect(400);
  });

  it('protege las rutas privadas sin token', async () => {
    await request(app.getHttpServer()).get('/api/v1/saas/metrics').expect(401);
  });

  it('rechaza por rol a un usuario que no es SUPERADMIN', async () => {
    const token = await jwt.signAsync({
      sub: 'u1',
      email: 'ana@fuego.pe',
      nombre: 'Ana',
      rol: 'MESERO',
      empresaId: 'e1',
      sucursalId: 's1',
    });

    await request(app.getHttpServer())
      .get('/api/v1/saas/metrics')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('permite la consola SaaS a SUPERADMIN', async () => {
    const token = await jwt.signAsync({
      sub: 'super',
      email: 'super@fogoneria.com',
      nombre: 'Super',
      rol: 'SUPERADMIN',
      empresaId: null,
      sucursalId: null,
    });

    await request(app.getHttpServer())
      .get('/api/v1/saas/metrics')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
