import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { ReceiptsService } from './../src/modules/receipts/receipts.service.js';
import { configureApp } from './../src/bootstrap.js';
import { createPrismaMock } from './prisma-mock.js';

const SUCURSAL = '22222222-2222-4222-8222-222222222222';
const ORDEN = '33333333-3333-4333-8333-333333333333';
const COMPROBANTE = '44444444-4444-4444-8444-444444444444';

describe('Comprobantes (e2e, AYCDS-36)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let cajero: string;
  let mesero: string;
  let receipts: Record<string, ReturnType<typeof vi.fn>>;

  beforeAll(async () => {
    receipts = {
      list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
      findOne: vi.fn().mockResolvedValue({ comprobante: {}, desglose: {} }),
      create: vi
        .fn()
        .mockResolvedValue({ comprobante: { id: COMPROBANTE }, desglose: { total: 118 } }),
      void: vi.fn().mockResolvedValue({ comprobante: { estado: 'ANULADA' } }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createPrismaMock())
      .overrideProvider(ReceiptsService)
      .useValue(receipts)
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
    for (const fn of Object.values(receipts)) fn.mockClear();
  });

  it('emite una boleta a nombre del cajero', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/receipts')
      .set('Authorization', `Bearer ${cajero}`)
      .send({ ordenId: ORDEN, tipo: 'BOLETA', clienteRef: '12345678' })
      .expect(201);

    expect(response.body.comprobante.id).toBe(COMPROBANTE);
    expect(receipts.create).toHaveBeenCalledWith({
      ordenId: ORDEN,
      tipo: 'BOLETA',
      clienteRef: '12345678',
    });
  });

  it('rechaza la emisión al mesero', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/receipts')
      .set('Authorization', `Bearer ${mesero}`)
      .send({ ordenId: ORDEN, tipo: 'BOLETA' })
      .expect(403);
    expect(receipts.create).not.toHaveBeenCalled();
  });

  it('exige un tipo válido', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/receipts')
      .set('Authorization', `Bearer ${cajero}`)
      .send({ ordenId: ORDEN, tipo: 'NOTA_VENTA' })
      .expect(400);
  });

  it('rechaza un ordenId que no es UUID', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/receipts')
      .set('Authorization', `Bearer ${cajero}`)
      .send({ ordenId: 'ORD-000001', tipo: 'BOLETA' })
      .expect(400);
  });

  it('rechaza un documento no numérico', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/receipts')
      .set('Authorization', `Bearer ${cajero}`)
      .send({ ordenId: ORDEN, tipo: 'BOLETA', clienteRef: 'DNI-123' })
      .expect(400);
  });

  it('anula un comprobante con motivo', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/receipts/${COMPROBANTE}/void`)
      .set('Authorization', `Bearer ${cajero}`)
      .send({ motivo: 'Cliente desistió de la compra' })
      .expect(200);

    expect(receipts.void).toHaveBeenCalledWith(
      COMPROBANTE,
      'Cliente desistió de la compra',
    );
  });

  it('exige un motivo con longitud mínima', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/receipts/${COMPROBANTE}/void`)
      .set('Authorization', `Bearer ${cajero}`)
      .send({ motivo: 'x' })
      .expect(400);
    expect(receipts.void).not.toHaveBeenCalled();
  });

  it('lista con filtros y devuelve la paginación', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/receipts?fecha=2026-11-06&tipo=BOLETA')
      .set('Authorization', `Bearer ${cajero}`)
      .expect(200);

    expect(receipts.list).toHaveBeenCalledWith(
      expect.objectContaining({ fecha: '2026-11-06', tipo: 'BOLETA' }),
    );
  });

  it('rechaza una fecha mal formada', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/receipts?fecha=06-11-2026')
      .set('Authorization', `Bearer ${cajero}`)
      .expect(400);
  });
});
