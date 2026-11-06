import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { CashService } from './../src/modules/cash/cash.service.js';
import { configureApp } from './../src/bootstrap.js';
import { createPrismaMock } from './prisma-mock.js';

const SUCURSAL = '22222222-2222-4222-8222-222222222222';
const TURNO = '33333333-3333-4333-8333-333333333333';
const ORDEN = '44444444-4444-4444-8444-444444444444';

describe('Caja (e2e, AYCDS-34)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let cajero: string;
  let mesero: string;
  let cash: Record<string, ReturnType<typeof vi.fn>>;

  beforeAll(async () => {
    cash = {
      current: vi.fn().mockResolvedValue(null),
      listShifts: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
      open: vi.fn().mockResolvedValue({ turno: { id: TURNO }, arqueo: { fondo: 200 } }),
      close: vi.fn().mockResolvedValue({ turno: { id: TURNO }, arqueo: { diferencia: 0 } }),
      movements: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
      createMovement: vi.fn().mockResolvedValue({ id: 'mov-1' }),
      charge: vi.fn().mockResolvedValue({ ordenId: ORDEN, pagada: true }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createPrismaMock())
      .overrideProvider(CashService)
      .useValue(cash)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    jwt = app.get(JwtService);

    const base = {
      email: 'x@fuego.pe',
      nombre: 'X',
      empresaId: '11111111-1111-4111-8111-111111111111',
      sucursalId: SUCURSAL,
    };
    cajero = await jwt.signAsync({ ...base, sub: 'u-caja', rol: 'CAJERO' });
    mesero = await jwt.signAsync({ ...base, sub: 'u-mesero', rol: 'MESERO' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    for (const fn of Object.values(cash)) fn.mockClear();
  });

  it('deja abrir caja a un cajero', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/cash/shifts')
      .set('Authorization', `Bearer ${cajero}`)
      .send({ fondoApertura: 200 })
      .expect(201);

    expect(response.body.turno.id).toBe(TURNO);
    expect(cash.open).toHaveBeenCalledWith(undefined, 200);
  });

  it('rechaza la caja al mesero', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/cash/shifts')
      .set('Authorization', `Bearer ${mesero}`)
      .send({ fondoApertura: 200 })
      .expect(403);
    expect(cash.open).not.toHaveBeenCalled();
  });

  it('exige el fondo de apertura', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/cash/shifts')
      .set('Authorization', `Bearer ${cajero}`)
      .send({})
      .expect(400);
  });

  it('rechaza un fondo negativo', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/cash/shifts')
      .set('Authorization', `Bearer ${cajero}`)
      .send({ fondoApertura: -10 })
      .expect(400);
  });

  it('devuelve el turno actual en null cuando no hay caja', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/cash/shifts/current')
      .set('Authorization', `Bearer ${cajero}`)
      .expect(200);

    expect(response.body?.turno ?? null).toBeNull();
  });

  it('cobra una comanda y devuelve el resultado', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/cash/charges')
      .set('Authorization', `Bearer ${cajero}`)
      .send({ ordenId: ORDEN, metodo: 'EFECTIVO', propina: 5 })
      .expect(201);

    expect(cash.charge).toHaveBeenCalledWith({
      ordenId: ORDEN,
      metodo: 'EFECTIVO',
      propina: 5,
    });
  });

  it('rechaza un método de pago desconocido', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/cash/charges')
      .set('Authorization', `Bearer ${cajero}`)
      .send({ ordenId: ORDEN, metodo: 'BITCOIN' })
      .expect(400);
    expect(cash.charge).not.toHaveBeenCalled();
  });

  it('rechaza un importe de cero', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/cash/charges')
      .set('Authorization', `Bearer ${cajero}`)
      .send({ ordenId: ORDEN, metodo: 'EFECTIVO', monto: 0 })
      .expect(400);
  });

  it('exige el efectivo contado al cerrar', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/cash/shifts/${TURNO}/close`)
      .set('Authorization', `Bearer ${cajero}`)
      .send({ observaciones: 'sin contar' })
      .expect(400);
    expect(cash.close).not.toHaveBeenCalled();
  });

  it('cierra el turno con el conteo', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/cash/shifts/${TURNO}/close`)
      .set('Authorization', `Bearer ${cajero}`)
      .send({ efectivoContado: 250.5, observaciones: 'cuadra' })
      .expect(200);

    expect(cash.close).toHaveBeenCalledWith(TURNO, {
      efectivoContado: 250.5,
      observaciones: 'cuadra',
    });
  });

  it('rechaza una orden que no es UUID al cobrar', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/cash/charges')
      .set('Authorization', `Bearer ${cajero}`)
      .send({ ordenId: 'no-es-uuid', metodo: 'EFECTIVO' })
      .expect(400);
  });
});
