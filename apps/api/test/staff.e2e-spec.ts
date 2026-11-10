import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { StaffService } from './../src/modules/staff/staff.service.js';
import { configureApp } from './../src/bootstrap.js';
import { createPrismaMock } from './prisma-mock.js';

const SUCURSAL = '22222222-2222-4222-8222-222222222222';
const EMPLEADO = '33333333-3333-4333-8333-333333333333';
const POZO = '44444444-4444-4444-8444-444444444444';

describe('RRHH (e2e, AYCDS-33)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let admin: string;
  let mesero: string;
  let cajero: string;
  let staff: Record<string, ReturnType<typeof vi.fn>>;

  beforeAll(async () => {
    staff = {
      listEmployees: vi.fn().mockResolvedValue([]),
      listShifts: vi.fn().mockResolvedValue([]),
      createShift: vi.fn().mockResolvedValue({ id: 't-1' }),
      removeShift: vi.fn().mockResolvedValue({ id: 't-1', eliminado: true }),
      listAttendance: vi.fn().mockResolvedValue([]),
      markAttendance: vi.fn().mockResolvedValue({ id: 'a-1' }),
      listPools: vi.fn().mockResolvedValue([]),
      getPool: vi.fn().mockResolvedValue({ id: POZO }),
      calculateTips: vi.fn().mockResolvedValue({ id: POZO, total: 100 }),
      confirmPool: vi.fn().mockResolvedValue({ id: POZO, estado: 'REPARTIDO' }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createPrismaMock())
      .overrideProvider(StaffService)
      .useValue(staff)
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
    cajero = await jwt.signAsync({ ...base, sub: 'u-caja', rol: 'CAJERO' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    for (const fn of Object.values(staff)) fn.mockClear();
  });

  it('lista el personal', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/staff/employees')
      .set('Authorization', `Bearer ${mesero}`)
      .expect(200);
  });

  it('el admin asigna un turno', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/staff/shifts')
      .set('Authorization', `Bearer ${admin}`)
      .send({ empleadoId: EMPLEADO, fecha: '2026-11-07', bloque: 'TARDE' })
      .expect(201);

    expect(staff.createShift).toHaveBeenCalledWith({
      empleadoId: EMPLEADO,
      fecha: '2026-11-07',
      bloque: 'TARDE',
    });
  });

  it('rechaza el turno al mesero', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/staff/shifts')
      .set('Authorization', `Bearer ${mesero}`)
      .send({ empleadoId: EMPLEADO, fecha: '2026-11-07', bloque: 'TARDE' })
      .expect(403);
  });

  it('rechaza un bloque de turno inválido', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/staff/shifts')
      .set('Authorization', `Bearer ${admin}`)
      .send({ empleadoId: EMPLEADO, fecha: '2026-11-07', bloque: 'MADRUGADA' })
      .expect(400);
  });

  it('rechaza una fecha mal formada', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/staff/shifts?fecha=07-11-2026')
      .set('Authorization', `Bearer ${admin}`)
      .expect(400);
  });

  it('el cajero marca la asistencia', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/staff/attendance')
      .set('Authorization', `Bearer ${cajero}`)
      .send({ empleadoId: EMPLEADO, estado: 'PRESENTE' })
      .expect(201);

    expect(staff.markAttendance).toHaveBeenCalledWith({
      empleadoId: EMPLEADO,
      estado: 'PRESENTE',
    });
  });

  it('rechaza un estado de asistencia inválido', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/staff/attendance')
      .set('Authorization', `Bearer ${cajero}`)
      .send({ empleadoId: EMPLEADO, estado: 'VACACIONES' })
      .expect(400);
  });

  it('calcula el pozo de propinas', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/staff/tips/calculate')
      .set('Authorization', `Bearer ${admin}`)
      .send({ fecha: '2026-11-06' })
      .expect(201);

    expect(staff.calculateTips).toHaveBeenCalledWith({ fecha: '2026-11-06' });
  });

  it('rechaza calcular el pozo al mesero', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/staff/tips/calculate')
      .set('Authorization', `Bearer ${mesero}`)
      .send({})
      .expect(403);
  });

  it('confirma el reparto del pozo', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/staff/tips/${POZO}/confirm`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(201);
  });
});
