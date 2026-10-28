import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { TablesService } from './../src/modules/tables/tables.service.js';
import { configureApp } from './../src/bootstrap.js';
import { createPrismaMock } from './prisma-mock.js';

const MESA = '20000000-0000-4000-8000-000000000001';

describe('Tables (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let meseroToken: string;
  let tables: Record<string, ReturnType<typeof vi.fn>>;

  beforeAll(async () => {
    tables = {
      list: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue({ id: MESA }),
      create: vi.fn().mockResolvedValue({ id: MESA }),
      update: vi.fn().mockResolvedValue({ id: MESA }),
      updateStatus: vi.fn().mockResolvedValue({ id: MESA, estado: 'MANTENIMIENTO' }),
      remove: vi.fn().mockResolvedValue({ id: MESA }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createPrismaMock())
      .overrideProvider(TablesService)
      .useValue(tables)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    const jwt = app.get(JwtService);
    const base = {
      email: 'admin@mirestaurante.com',
      nombre: 'Admin',
      empresaId: '11111111-1111-4111-8111-111111111111',
      sucursalId: '22222222-2222-4222-8222-222222222222',
    };
    adminToken = await jwt.signAsync({ ...base, sub: 'u-admin', rol: 'ADMIN_GLOBAL' });
    meseroToken = await jwt.signAsync({ ...base, sub: 'u-mesero', rol: 'MESERO' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    Object.values(tables).forEach((fn) => fn.mockClear());
  });

  it('crea una mesa válida', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/tables')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ numero: '12', capacidad: 4, zona: 'Terraza' })
      .expect(201);
    expect(tables.create).toHaveBeenCalledTimes(1);
  });

  it('devuelve 400 si falta el número', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/tables')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ capacidad: 4 })
      .expect(400);
  });

  it('devuelve 400 si la capacidad es 0', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/tables')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ numero: '3', capacidad: 0 })
      .expect(400);
  });

  it('rechaza crear mesas con rol MESERO', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/tables')
      .set('Authorization', `Bearer ${meseroToken}`)
      .send({ numero: '3', capacidad: 2 })
      .expect(403);
  });

  it('solo acepta LIBRE o MANTENIMIENTO en el estado manual', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/tables/${MESA}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ estado: 'OCUPADA' })
      .expect(400);
  });

  it('valida el estado del filtro', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tables?estado=VOLANDO')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('rechaza un id que no es UUID', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tables/abc')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('exige autenticación', async () => {
    await request(app.getHttpServer()).get('/api/v1/tables').expect(401);
  });
});
