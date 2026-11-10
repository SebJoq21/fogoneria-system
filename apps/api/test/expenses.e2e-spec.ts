import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { ExpensesService } from './../src/modules/expenses/expenses.service.js';
import { configureApp } from './../src/bootstrap.js';
import { createPrismaMock } from './prisma-mock.js';

const SUCURSAL = '22222222-2222-4222-8222-222222222222';
const GASTO = '33333333-3333-4333-8333-333333333333';

describe('Gastos (e2e, AYCDS-17)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let cajero: string;
  let mesero: string;
  let expenses: Record<string, ReturnType<typeof vi.fn>>;

  beforeAll(async () => {
    expenses = {
      list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
      summary: vi.fn().mockResolvedValue({ porPagar: 0, vencido: 0, pagadoMes: 0 }),
      create: vi.fn().mockResolvedValue({ id: GASTO }),
      update: vi.fn().mockResolvedValue({ id: GASTO }),
      pay: vi.fn().mockResolvedValue({ id: GASTO, estado_pago: 'PAGADO' }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createPrismaMock())
      .overrideProvider(ExpensesService)
      .useValue(expenses)
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
    for (const fn of Object.values(expenses)) fn.mockClear();
  });

  it('lista los gastos del cajero', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/expenses')
      .set('Authorization', `Bearer ${cajero}`)
      .expect(200);
  });

  it('devuelve el resumen de cuentas por pagar', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/expenses/summary')
      .set('Authorization', `Bearer ${cajero}`)
      .expect(200);
  });

  it('rechaza el alta al mesero', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${mesero}`)
      .send({ concepto: 'Carbón', monto: 10, categoria: 'INSUMOS' })
      .expect(403);
    expect(expenses.create).not.toHaveBeenCalled();
  });

  it('exige una categoría válida', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${cajero}`)
      .send({ concepto: 'Carbón', monto: 10, categoria: 'OTRA' })
      .expect(403);
  });

  it('rechaza un monto no positivo', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${cajero}`)
      .send({ concepto: 'Carbón', monto: 0, categoria: 'INSUMOS' })
      .expect(403);
  });

  it('paga el gasto con el método indicado', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/expenses/${GASTO}/pay`)
      .set('Authorization', `Bearer ${cajero}`)
      .send({ metodo: 'EFECTIVO' })
      .expect(201);

    expect(expenses.pay).toHaveBeenCalledWith(GASTO, 'EFECTIVO');
  });

  it('rechaza un método de pago desconocido', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/expenses/${GASTO}/pay`)
      .set('Authorization', `Bearer ${cajero}`)
      .send({ metodo: 'BITCOIN' })
      .expect(400);
    expect(expenses.pay).not.toHaveBeenCalled();
  });

  it('rechaza un id que no es UUID', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/expenses/no-es-uuid/pay')
      .set('Authorization', `Bearer ${cajero}`)
      .send({ metodo: 'EFECTIVO' })
      .expect(400);
  });
});
