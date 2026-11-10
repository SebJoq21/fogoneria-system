import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { CrmService } from './../src/modules/crm/crm.service.js';
import { configureApp } from './../src/bootstrap.js';
import { createPrismaMock } from './prisma-mock.js';

const SUCURSAL = '22222222-2222-4222-8222-222222222222';
const CLIENTE = '33333333-3333-4333-8333-333333333333';

describe('CRM (e2e, AYCDS-31)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let admin: string;
  let mesero: string;
  let crm: Record<string, ReturnType<typeof vi.fn>>;

  beforeAll(async () => {
    crm = {
      listCustomers: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
      getCustomer: vi.fn().mockResolvedValue({ id: CLIENTE }),
      listPoints: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, puntos: 0 }),
      createCustomer: vi.fn().mockResolvedValue({ id: CLIENTE }),
      updateCustomer: vi.fn().mockResolvedValue({ id: CLIENTE }),
      adjustPoints: vi.fn().mockResolvedValue({ id: CLIENTE, puntos: 50 }),
      recalcularCliente: vi.fn().mockResolvedValue({ id: CLIENTE, visitas: 5 }),
      config: vi
        .fn()
        .mockResolvedValue({ puntos_por_moneda: 1, caducidad_meses: 12, umbral_frecuente: 5, umbral_vip: 20 }),
      updateConfig: vi.fn().mockResolvedValue({ umbral_frecuente: 5, umbral_vip: 20 }),
      procesarConsumos: vi.fn().mockResolvedValue({ puntos: 36, clientes: 1 }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createPrismaMock())
      .overrideProvider(CrmService)
      .useValue(crm)
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
    for (const fn of Object.values(crm)) fn.mockClear();
  });

  it('el mesero puede registrar un comensal', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/crm/customers')
      .set('Authorization', `Bearer ${mesero}`)
      .send({ nombre: 'Ana Torres', telefono: '987654321' })
      .expect(201);

    expect(crm.createCustomer).toHaveBeenCalledWith({
      nombre: 'Ana Torres',
      telefono: '987654321',
    });
  });

  it('rechaza un teléfono con letras', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/crm/customers')
      .set('Authorization', `Bearer ${mesero}`)
      .send({ nombre: 'Ana', telefono: 'ABC123' })
      .expect(400);
  });

  it('el mesero no ajusta puntos', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/crm/customers/${CLIENTE}/points`)
      .set('Authorization', `Bearer ${mesero}`)
      .send({ tipo: 'GANANCIA', puntos: 10 })
      .expect(403);
    expect(crm.adjustPoints).not.toHaveBeenCalled();
  });

  it('el admin ajusta puntos', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/crm/customers/${CLIENTE}/points`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ tipo: 'CANJE', puntos: 20, motivo: 'Cortesía' })
      .expect(201);

    expect(crm.adjustPoints).toHaveBeenCalledWith(CLIENTE, {
      tipo: 'CANJE',
      puntos: 20,
      motivo: 'Cortesía',
    });
  });

  it('rechaza puntos en cero', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/crm/customers/${CLIENTE}/points`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ tipo: 'GANANCIA', puntos: 0 })
      .expect(400);
  });

  it('devuelve la configuración de lealtad', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/crm/config')
      .set('Authorization', `Bearer ${mesero}`)
      .expect(200);
  });

  it('recalcula un cliente', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/crm/customers/${CLIENTE}/recalculate`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(201);
  });

  it('reprocesa los consumos pendientes', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/crm/process')
      .set('Authorization', `Bearer ${admin}`)
      .expect(201);

    expect(response.body).toEqual({ puntos: 36, clientes: 1 });
  });

  it('el mesero no puede reprocesar consumos', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/crm/process')
      .set('Authorization', `Bearer ${mesero}`)
      .expect(403);
  });

  it('lista los movimientos de puntos del cliente', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/crm/customers/${CLIENTE}/points?tipo=GANANCIA`)
      .set('Authorization', `Bearer ${mesero}`)
      .expect(200);
  });
});
