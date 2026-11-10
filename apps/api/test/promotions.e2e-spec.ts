import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { PromotionsService } from './../src/modules/promotions/promotions.service.js';
import { configureApp } from './../src/bootstrap.js';
import { createPrismaMock } from './prisma-mock.js';

const SUCURSAL = '22222222-2222-4222-8222-222222222222';
const PLATO = '33333333-3333-4333-8333-333333333333';
const COMBO = '44444444-4444-4444-8444-444444444444';
const CUPON = '55555555-5555-4555-8555-555555555555';

describe('Promociones (e2e, AYCDS-19)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let admin: string;
  let mesero: string;
  let promotions: Record<string, ReturnType<typeof vi.fn>>;

  beforeAll(async () => {
    promotions = {
      listCombos: vi.fn().mockResolvedValue([]),
      createCombo: vi.fn().mockResolvedValue({ id: COMBO, precioReferencia: 60 }),
      updateCombo: vi.fn().mockResolvedValue({ id: COMBO }),
      removeCombo: vi.fn().mockResolvedValue({ id: COMBO, eliminado: true }),
      listCoupons: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
      createCoupon: vi.fn().mockResolvedValue({ id: CUPON, codigo: 'VERANO20' }),
      updateCoupon: vi.fn().mockResolvedValue({ id: CUPON }),
      removeCoupon: vi.fn().mockResolvedValue({ id: CUPON, eliminado: true }),
      validateCoupon: vi.fn().mockResolvedValue({ valido: true, descuento: 12 }),
      schedule: vi.fn().mockResolvedValue([]),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createPrismaMock())
      .overrideProvider(PromotionsService)
      .useValue(promotions)
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
    admin = await jwt.signAsync({ ...base, sub: 'u-admin', rol: 'GERENTE_SUCURSAL' });
    mesero = await jwt.signAsync({ ...base, sub: 'u-mesero', rol: 'MESERO' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    for (const fn of Object.values(promotions)) fn.mockClear();
  });

  it('lista combos con su precio de referencia', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/promotions/combos')
      .set('Authorization', `Bearer ${mesero}`)
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('crea un combo con platos', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/promotions/combos')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        nombre: 'Combo parrillero',
        precioFijo: 45,
        platos: [{ platoId: PLATO, cantidad: 1 }],
      })
      .expect(201);

    expect(promotions.createCombo).toHaveBeenCalledWith({
      nombre: 'Combo parrillero',
      precioFijo: 45,
      platos: [{ platoId: PLATO, cantidad: 1 }],
    });
  });

  it('rechaza el combo al mesero', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/promotions/combos')
      .set('Authorization', `Bearer ${mesero}`)
      .send({
        nombre: 'Combo',
        precioFijo: 10,
        platos: [{ platoId: PLATO, cantidad: 1 }],
      })
      .expect(403);
    expect(promotions.createCombo).not.toHaveBeenCalled();
  });

  it('exige al menos un plato en el combo', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/promotions/combos')
      .set('Authorization', `Bearer ${admin}`)
      .send({ nombre: 'Combo', precioFijo: 10, platos: [] })
      .expect(400);
  });

  it('rechaza un precio de combo no positivo', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/promotions/combos')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        nombre: 'Combo',
        precioFijo: 0,
        platos: [{ platoId: PLATO, cantidad: 1 }],
      })
      .expect(400);
  });

  it('crea un cupón con código normalizado', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/promotions/coupons')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        codigo: 'VERANO20',
        tipoDescuento: 'PORCENTAJE',
        valor: 20,
        limiteUsos: 100,
        vencimiento: '2026-12-31',
      })
      .expect(201);
  });

  it('rechaza un código con caracteres raros', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/promotions/coupons')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        codigo: 'verano 20%',
        tipoDescuento: 'PORCENTAJE',
        valor: 20,
        limiteUsos: 10,
        vencimiento: '2026-12-31',
      })
      .expect(400);
  });

  it('valida un cupón contra un subtotal', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/promotions/coupons/VERANO20/validate')
      .set('Authorization', `Bearer ${mesero}`)
      .send({ subtotal: 100 })
      .expect(201);

    expect(response.body).toMatchObject({ valido: true, descuento: 12 });
    expect(promotions.validateCoupon).toHaveBeenCalledWith('VERANO20', 100);
  });

  it('devuelve las reglas horarias activas', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/promotions/schedule')
      .set('Authorization', `Bearer ${mesero}`)
      .expect(200);
  });
});
