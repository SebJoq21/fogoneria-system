import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { ReservationsService } from './../src/modules/reservations/reservations.service.js';
import { configureApp } from './../src/bootstrap.js';
import { createPrismaMock } from './prisma-mock.js';

const MESA = '20000000-0000-4000-8000-000000000001';
const RESERVA = '30000000-0000-4000-8000-000000000201';

const validBody = {
  mesaId: MESA,
  clienteNombre: 'Familia Rojas',
  telefono: '987654321',
  nroComensales: 4,
  fechaHora: '2026-10-27T20:00:00-05:00',
};

describe('Reservations (e2e)', () => {
  let app: INestApplication;
  let meseroToken: string;
  let cocineroToken: string;
  let reservations: Record<string, ReturnType<typeof vi.fn>>;

  beforeAll(async () => {
    reservations = {
      list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
      findOne: vi.fn().mockResolvedValue({ id: RESERVA }),
      create: vi.fn().mockResolvedValue({ id: RESERVA }),
      update: vi.fn().mockResolvedValue({ id: RESERVA }),
      updateStatus: vi.fn().mockResolvedValue({ id: RESERVA, estado: 'CONFIRMADA' }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createPrismaMock())
      .overrideProvider(ReservationsService)
      .useValue(reservations)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    const jwt = app.get(JwtService);
    const base = {
      email: 'mesero@mirestaurante.com',
      nombre: 'Mesero',
      empresaId: '11111111-1111-4111-8111-111111111111',
      sucursalId: '22222222-2222-4222-8222-222222222222',
    };
    meseroToken = await jwt.signAsync({ ...base, sub: 'u-mesero', rol: 'MESERO' });
    cocineroToken = await jwt.signAsync({
      ...base,
      sub: 'u-cocina',
      rol: 'COCINERO',
      email: 'cocina@mirestaurante.com',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    Object.values(reservations).forEach((fn) => fn.mockClear());
  });

  it('crea una reserva válida', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${meseroToken}`)
      .send(validBody)
      .expect(201);
    expect(reservations.create).toHaveBeenCalledTimes(1);
  });

  it('devuelve 400 si la fecha no es ISO', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${meseroToken}`)
      .send({ ...validBody, fechaHora: '27/10/2026 20:00' })
      .expect(400);
  });

  it('devuelve 400 si no hay comensales', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${meseroToken}`)
      .send({ ...validBody, nroComensales: 0 })
      .expect(400);
  });

  it('devuelve 400 si la mesa no es UUID', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${meseroToken}`)
      .send({ ...validBody, mesaId: 'mesa-1' })
      .expect(400);
  });

  it('rechaza el filtro de fecha con formato inválido', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/reservations?fecha=2026-13-99')
      .set('Authorization', `Bearer ${meseroToken}`)
      .expect(400);
  });

  it('rechaza un estado fuera del enum', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/reservations/${RESERVA}/status`)
      .set('Authorization', `Bearer ${meseroToken}`)
      .send({ estado: 'SENTADA' })
      .expect(400);
  });

  it('no deja que cocina cree reservas', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${cocineroToken}`)
      .send(validBody)
      .expect(403);
  });

  it('exige autenticación para listar', async () => {
    await request(app.getHttpServer()).get('/api/v1/reservations').expect(401);
  });
});
