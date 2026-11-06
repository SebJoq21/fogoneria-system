import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { OrdersService } from './../src/modules/orders/orders.service.js';
import { configureApp } from './../src/bootstrap.js';
import { createPrismaMock } from './prisma-mock.js';

const SUCURSAL = '22222222-2222-4222-8222-222222222222';
const PLATO = '88888888-8888-8888-8888-888888888881';
const COMBO = '77777777-7777-4777-8777-777777777771';
const LEGACY = '22222222-2222-2222-2222-222222222222';

describe('Orders (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let token: string;
  let orders: {
    create: ReturnType<typeof vi.fn>;
    board: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };

  beforeAll(async () => {
    orders = {
      create: vi.fn().mockResolvedValue({ id: 'o-1' }),
      board: vi.fn().mockResolvedValue({
        generadoAt: '2026-11-06T12:00:00.000Z',
        slaMinutos: 20,
        ventanaDias: 7,
        limite: 200,
        truncado: false,
        columnas: [
          { estado: 'POR_CONFIRMAR', total: 0, ordenes: [] },
          { estado: 'EN_COCINA', total: 0, ordenes: [] },
          { estado: 'LISTO', total: 0, ordenes: [] },
          { estado: 'ENTREGADO', total: 0, ordenes: [] },
        ],
        metricas: {
          abiertas: 0,
          fueraDeSla: 0,
          promedioEsperaMin: null,
          promedioPreparacionMin: null,
        },
      }),
      list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createPrismaMock())
      .overrideProvider(OrdersService)
      .useValue(orders)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    jwt = app.get(JwtService);

    token = await jwt.signAsync({
      sub: 'u-1',
      email: 'mesero@mirestaurante.com',
      nombre: 'Mesero',
      rol: 'MESERO',
      empresaId: '11111111-1111-4111-8111-111111111111',
      sucursalId: SUCURSAL,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    orders.create.mockClear();
    orders.board.mockClear();
    orders.list.mockClear();
  });

  it('devuelve 400 (no 500) si falta items', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);
    expect(orders.create).not.toHaveBeenCalled();
  });

  it('devuelve 400 si items viene vacío', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [] })
      .expect(400);
  });

  it('devuelve 400 si un PLATO no trae platoId', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ tipo: 'PLATO', cantidad: 1 }] })
      .expect(400);
  });

  it('rechaza un precio enviado por el cliente (lo pone el servidor)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ tipo: 'PLATO', platoId: PLATO, cantidad: 1, precioUnitario: 0.01 }],
      })
      .expect(400);
    expect(orders.create).not.toHaveBeenCalled();
  });

  it('crea una orden válida sin precio en el body', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          { tipo: 'PLATO', platoId: PLATO, cantidad: 2 },
          { tipo: 'COMBO', comboId: COMBO, cantidad: 1 },
        ],
      })
      .expect(201);
    expect(orders.create).toHaveBeenCalledTimes(1);
  });

  it('acepta el sucursalId del seed (UUID RFC 4122)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/orders?sucursalId=${SUCURSAL}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('rechaza el sucursalId legacy (no RFC 4122)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/orders?sucursalId=${LEGACY}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  describe('tablero del KDS (AYCDS-30)', () => {
    it('devuelve las cuatro columnas con SLA y métricas', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/orders/board')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        slaMinutos: 20,
        metricas: { abiertas: 0, fueraDeSla: 0 },
      });
      expect(response.body.columnas.map((columna: { estado: string }) => columna.estado))
        .toEqual(['POR_CONFIRMAR', 'EN_COCINA', 'LISTO', 'ENTREGADO']);
      expect(orders.board).toHaveBeenCalledTimes(1);
    });

    it('acepta la ventana y el límite como query', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/orders/board?dias=3&limite=50&sucursalId=${SUCURSAL}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(orders.board).toHaveBeenCalledWith({
        dias: 3,
        limite: 50,
        sucursalId: SUCURSAL,
      });
    });

    it('rechaza una ventana fuera de rango', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/orders/board?dias=99')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
      expect(orders.board).not.toHaveBeenCalled();
    });

    it('rechaza un límite no numérico', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/orders/board?limite=abc')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('exige autenticación', async () => {
      await request(app.getHttpServer()).get('/api/v1/orders/board').expect(401);
    });
  });
});
