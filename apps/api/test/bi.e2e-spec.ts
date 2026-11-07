import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { BiService } from './../src/modules/bi/bi.service.js';
import { configureApp } from './../src/bootstrap.js';
import { createPrismaMock } from './prisma-mock.js';

const SUCURSAL = '22222222-2222-4222-8222-222222222222';

describe('BI (e2e, AYCDS-35)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let admin: string;
  let mesero: string;
  let bi: Record<string, ReturnType<typeof vi.fn>>;

  beforeAll(async () => {
    bi = {
      pnl: vi.fn().mockResolvedValue({ ventas: 100, gastos: 30, margen: 70 }),
      pnlPorDia: vi.fn().mockResolvedValue({ items: [] }),
      topDishes: vi.fn().mockResolvedValue({ items: [] }),
      salesByMethod: vi.fn().mockResolvedValue({ items: [] }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createPrismaMock())
      .overrideProvider(BiService)
      .useValue(bi)
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
    for (const fn of Object.values(bi)) fn.mockClear();
  });

  it('el gerente consulta el P&L', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/bi/pnl?desde=2026-11-01&hasta=2026-11-07')
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);

    expect(bi.pnl).toHaveBeenCalledWith({ desde: '2026-11-01', hasta: '2026-11-07' });
  });

  it('el mesero no ve reportes (403)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/bi/pnl?desde=2026-11-01&hasta=2026-11-07')
      .set('Authorization', `Bearer ${mesero}`)
      .expect(403);
  });

  it('exige desde y hasta', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/bi/pnl')
      .set('Authorization', `Bearer ${admin}`)
      .expect(400);
  });

  it('rechaza una fecha mal formada', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/bi/pnl?desde=01-11-2026&hasta=2026-11-07')
      .set('Authorization', `Bearer ${admin}`)
      .expect(400);
  });

  it('rechaza un límite fuera de rango en el ranking', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/bi/top-dishes?desde=2026-11-01&hasta=2026-11-07&limit=500')
      .set('Authorization', `Bearer ${admin}`)
      .expect(400);
  });

  it('convierte el límite a número', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/bi/top-dishes?desde=2026-11-01&hasta=2026-11-07&limit=5')
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);

    expect(bi.topDishes).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5 }),
    );
  });

  it('devuelve la serie diaria y los cobros por método', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/bi/pnl/daily?desde=2026-11-01&hasta=2026-11-07')
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/bi/sales-by-method?desde=2026-11-01&hasta=2026-11-07')
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);

    expect(bi.pnlPorDia).toHaveBeenCalled();
    expect(bi.salesByMethod).toHaveBeenCalled();
  });
});
