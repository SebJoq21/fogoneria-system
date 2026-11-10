import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { StockAlertsService } from './../src/modules/inventory/stock-alerts.service.js';
import { configureApp } from './../src/bootstrap.js';
import { createPrismaMock } from './prisma-mock.js';

const SUCURSAL = '22222222-2222-4222-8222-222222222222';

describe('Inventario: semáforo y alertas (e2e, AYCDS-13)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let admin: string;
  let mesero: string;
  let stock: Record<string, ReturnType<typeof vi.fn>>;

  beforeAll(async () => {
    stock = {
      status: vi.fn().mockResolvedValue({ items: [], resumen: {} }),
      checkAlerts: vi
        .fn()
        .mockResolvedValue({ evaluados: 1, nuevas: 1, resueltas: 0, enviado: true }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createPrismaMock())
      .overrideProvider(StockAlertsService)
      .useValue(stock)
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
    for (const fn of Object.values(stock)) fn.mockClear();
  });

  it('el mesero puede ver el semáforo', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/inventory/stock')
      .set('Authorization', `Bearer ${mesero}`)
      .expect(200);

    expect(stock.status).toHaveBeenCalledWith({});
  });

  it('rechaza un estado que no es del semáforo', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/inventory/stock?estado=CRITICO')
      .set('Authorization', `Bearer ${mesero}`)
      .expect(400);
  });

  it('rechaza un sucursalId que no es UUID', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/inventory/stock?sucursalId=abc')
      .set('Authorization', `Bearer ${mesero}`)
      .expect(400);
  });

  it('el mesero no dispara el barrido de alertas (403)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/inventory/alerts/check')
      .set('Authorization', `Bearer ${mesero}`)
      .expect(403);
  });

  it('el admin dispara el barrido', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/inventory/alerts/check')
      .set('Authorization', `Bearer ${admin}`)
      .expect(201);

    expect(stock.checkAlerts).toHaveBeenCalledWith({});
  });
});
