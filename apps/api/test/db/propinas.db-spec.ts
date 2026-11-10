import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { PrismaService } from '../../src/prisma/prisma.service.js';
import type { TenantContextService } from '../../src/common/context/tenant-context.service.js';
import type { AuditService } from '../../src/modules/audit/audit.service.js';
import { StaffService } from '../../src/modules/staff/staff.service.js';
import {
  asTenant,
  createDb,
  createOrden,
  createTenant,
  hasTestDatabase,
  prepareRlsRole,
  resetDatabase,
  type TenantFixture,
} from './helpers.js';

const describeDb = hasTestDatabase ? describe : describe.skip;

describeDb('RRHH: turnos, asistencia y propinas (AYCDS-33)', () => {
  let db: PrismaClient;
  let tenant: TenantFixture;

  beforeAll(async () => {
    db = createDb();
    await prepareRlsRole(db);
  });

  beforeEach(async () => {
    await resetDatabase(db);
    tenant = await createTenant(db, 'RRHH');
  });

  afterAll(async () => {
    await resetDatabase(db).catch(() => undefined);
    await db.$disconnect();
  });

  async function crearEmpleado(nombre: string): Promise<string> {
    const [rol] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.roles_empresa (empresa_id, nombre)
       VALUES ($1, $2) RETURNING id`,
      tenant.empresaId,
      `Rol ${nombre}-${Math.random().toString(36).slice(2, 6)}`,
    );
    const [empleado] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.empleados (empresa_id, sucursal_id, nombre, rol_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      tenant.empresaId,
      tenant.sucursalId,
      nombre,
      rol.id,
    );
    return empleado.id;
  }

  async function marcar(
    empleadoId: string,
    estado: 'PRESENTE' | 'TARDANZA' | 'FALTA',
    fecha = '2026-11-06',
  ): Promise<void> {
    await db.$executeRawUnsafe(
      `INSERT INTO fogoneria.asistencias (empresa_id, sucursal_id, empleado_id, fecha, estado)
       VALUES ($1, $2, $3, $4::date, $5::fogoneria.estado_asistencia)`,
      tenant.empresaId,
      tenant.sucursalId,
      empleadoId,
      fecha,
      estado,
    );
  }

  async function ordenConPropina(propina: number): Promise<string> {
    const orden = await createOrden(db, tenant, 'ENTREGADO', `ORD-PROP-${Math.random().toString(36).slice(2, 7)}`);
    await db.$executeRawUnsafe(
      `UPDATE fogoneria.ordenes SET propina = $2, created_at = $3 WHERE id = $1`,
      orden,
      propina,
      new Date('2026-11-06T18:00:00.000Z'),
    );
    return orden;
  }

  function buildStaff(): StaffService {
    return new StaffService(
      { scoped: db } as unknown as PrismaService,
      {
        get: () => ({
          empresaId: tenant.empresaId,
          sucursalId: tenant.sucursalId,
          userId: tenant.usuarioId,
          rol: 'GERENTE_SUCURSAL',
          bypass: false,
        }),
      } as unknown as TenantContextService,
      { record: async () => undefined } as unknown as AuditService,
    );
  }

  async function conTenant<T>(fn: (staff: StaffService) => Promise<T>): Promise<T> {
    return db.$transaction(async (tx) => {
      await asTenant(tx, {
        empresaId: tenant.empresaId,
        sucursalId: tenant.sucursalId,
      });
      const staff = new StaffService(
        { scoped: tx } as unknown as PrismaService,
        {
          get: () => ({
            empresaId: tenant.empresaId,
            sucursalId: tenant.sucursalId,
            userId: tenant.usuarioId,
            rol: 'GERENTE_SUCURSAL',
            bypass: false,
          }),
        } as unknown as TenantContextService,
        { record: async () => undefined } as unknown as AuditService,
      );
      return fn(staff);
    });
  }

  it('reparte el pozo entre los presentes y suma exacto el total', async () => {
    const ana = await crearEmpleado('Ana');
    const luis = await crearEmpleado('Luis');
    const pedro = await crearEmpleado('Pedro');
    await marcar(ana, 'PRESENTE');
    await marcar(luis, 'TARDANZA');
    await marcar(pedro, 'FALTA');
    await ordenConPropina(30);
    await ordenConPropina(70);

    const pozo = await conTenant((staff) => staff.calculateTips({ fecha: '2026-11-06' }));

    expect(Number(pozo.total)).toBe(100);
    expect(pozo.nro_beneficiarios).toBe(2);
    const repartos = (pozo.repartos_propinas ?? []) as { monto: unknown; empleado_id: string }[];
    expect(repartos).toHaveLength(2);
    const suma = repartos.reduce((total, reparto) => total + Number(reparto.monto), 0);
    expect(Math.round(suma * 100) / 100).toBe(100);
    // Pedro faltó: no cobra.
    expect(repartos.map((reparto) => reparto.empleado_id)).not.toContain(pedro);
  });

  it('no calcula dos veces el mismo día', async () => {
    const ana = await crearEmpleado('Ana');
    await marcar(ana, 'PRESENTE');
    await ordenConPropina(50);
    await conTenant((staff) => staff.calculateTips({ fecha: '2026-11-06' }));

    await expect(
      conTenant((staff) => staff.calculateTips({ fecha: '2026-11-06' })),
    ).rejects.toThrow(/ya fue calculado/i);
  });

  it('falla si no hay propinas ese día', async () => {
    const ana = await crearEmpleado('Ana');
    await marcar(ana, 'PRESENTE');

    await expect(
      conTenant((staff) => staff.calculateTips({ fecha: '2026-11-06' })),
    ).rejects.toThrow(/No hay propinas/i);
  });

  it('falla si no hay personal presente', async () => {
    const ana = await crearEmpleado('Ana');
    await marcar(ana, 'FALTA');
    await ordenConPropina(40);

    await expect(
      conTenant((staff) => staff.calculateTips({ fecha: '2026-11-06' })),
    ).rejects.toThrow(/personal presente/i);
  });

  it('confirma el pozo y lo deja REPARTIDO', async () => {
    const ana = await crearEmpleado('Ana');
    await marcar(ana, 'PRESENTE');
    await ordenConPropina(60);
    const pozo = await conTenant((staff) => staff.calculateTips({ fecha: '2026-11-06' }));

    const confirmado = await conTenant((staff) => staff.confirmPool(pozo.id));

    expect(confirmado.estado).toBe('REPARTIDO');
  });

  it('la marcación es upsert: corregir no duplica', async () => {
    const ana = await crearEmpleado('Ana');
    await marcar(ana, 'TARDANZA');

    await conTenant((staff) =>
      staff.markAttendance({ empleadoId: ana, fecha: '2026-11-06', estado: 'PRESENTE' }),
    );

    const [conteo] = await db.$queryRawUnsafe<{ total: bigint }[]>(
      `SELECT count(*) AS total FROM fogoneria.asistencias WHERE empleado_id = $1`,
      ana,
    );
    expect(Number(conteo.total)).toBe(1);
    const [fila] = await db.$queryRawUnsafe<{ estado: string }[]>(
      `SELECT estado::text AS estado FROM fogoneria.asistencias WHERE empleado_id = $1`,
      ana,
    );
    expect(fila.estado).toBe('PRESENTE');
  });

  it('los turnos no se duplican por empleado, día y bloque', async () => {
    const ana = await crearEmpleado('Ana');
    await conTenant((staff) =>
      staff.createShift({ empleadoId: ana, fecha: '2026-11-07', bloque: 'TARDE' }),
    );

    await expect(
      conTenant((staff) =>
        staff.createShift({ empleadoId: ana, fecha: '2026-11-07', bloque: 'TARDE' }),
      ),
    ).rejects.toThrow(/ya tiene un turno/i);
  });
});
