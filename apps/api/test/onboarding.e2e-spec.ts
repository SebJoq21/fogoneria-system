import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { OnboardingService } from './../src/modules/onboarding/onboarding.service.js';
import { configureApp } from './../src/bootstrap.js';
import { createPrismaMock } from './prisma-mock.js';

const payload = {
  nombreLegal: 'Parrilla El Fuego S.A.C.',
  ruc: '20123456786',
  nombreAdmin: 'María Torres',
  emailAdmin: 'admin@elfuego.pe',
  password: 'Fogoneria123!',
};

describe('Onboarding público (e2e)', () => {
  let app: INestApplication;
  let submit: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    submit = vi.fn().mockResolvedValue({ id: 'e1', ruc: payload.ruc });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createPrismaMock())
      .overrideProvider(OnboardingService)
      .useValue({ submit })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => submit.mockClear());

  it('rechaza un payload sin razón social', async () => {
    const { nombreLegal: _omitido, ...resto } = payload;
    await request(app.getHttpServer())
      .post('/api/v1/onboarding')
      .send(resto)
      .expect(400);
  });

  it('no acepta un plan pagado en el alta pública', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/onboarding')
      .send({ ...payload, plan: 'PROFESIONAL' })
      .expect(400);
  });

  it('acepta el alta y limita los intentos por IP', async () => {
    const server = app.getHttpServer();
    // Ya se consumieron 2 intentos en los tests anteriores (límite = 5).
    await request(server).post('/api/v1/onboarding').send(payload).expect(201);
    await request(server).post('/api/v1/onboarding').send(payload).expect(201);
    await request(server).post('/api/v1/onboarding').send(payload).expect(201);
    await request(server).post('/api/v1/onboarding').send(payload).expect(429);
  });
});
