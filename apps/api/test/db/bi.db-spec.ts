import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import {
  asTenant,
  createDb,
  createTenant,
  hasTestDatabase,
  prepareRlsRole,
  resetDatabase,
  type TenantFixture,
} from './helpers.js';

const describeDb = hasTestDatabase ? describe : describe.skip;

describeDb('Vistas BI (AYCDS-38)', () => {
  let db: PrismaClient;
  let tenant: TenantFixture;

  beforeAll(async () => {
    db = createDb();
    await prepareRlsRole(db);
  });

  beforeEach(async () => {
    await resetDatabase(db);
    turnoId = null;
    tenant = await createTenant(db, 'BI');
  });

  afterAll(async () => {
    await resetDatabase(db).catch(() => undefined);
    await db.$disconnect();
  });

  let turnoId: string | null = null;

  /** Comanda con total, propina y fecha explícitos (UTC). */
  async function orden(
    total: number,
    opciones: {
      estado?: 'PAGADA' | 'CERRADA' | 'ENTREGADO' | 'ANULADA';
      propina?: number;
      createdAt?: string;
      platoId?: string;
      cantidad?: number;
    } = {},
  ): Promise<string> {
    const estado = opciones.estado ?? 'PAGADA';
    const propina = opciones.propina ?? 0;
    const createdAt = opciones.createdAt ?? '2026-11-06T18:00:00.000Z';
    // Con líneas se nace no terminal: el trigger de inmutabilidad no deja tocar
    // los detalles de una comanda cerrada.
    const estadoInicial = opciones.platoId ? 'ENTREGADO' : estado;

    const [fila] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.ordenes (empresa_id, sucursal_id, numero_orden, estado, subtotal, total, propina, created_at)
       VALUES ($1, $2, $3, $4::fogoneria.estado_orden, $5, $5, $6, $7)
       RETURNING id`,
      tenant.empresaId,
      tenant.sucursalId,
      `BI-${Math.random().toString(36).slice(2, 8)}`,
      estadoInicial,
      total,
      propina,
      new Date(createdAt),
    );

    if (opciones.platoId) {
      const cantidad = opciones.cantidad ?? 1;
      await db.$executeRawUnsafe(
        `INSERT INTO fogoneria.detalles_orden (orden_id, tipo, plato_id, cantidad, precio_unitario, subtotal)
         VALUES ($1, 'PLATO', $2, $3, $4, $5)`,
        fila.id,
        opciones.platoId,
        cantidad,
        total / cantidad,
        total,
      );
      if (estado !== 'ENTREGADO') {
        await db.$executeRawUnsafe(
          `UPDATE fogoneria.ordenes SET estado = $2::fogoneria.estado_orden WHERE id = $1`,
          fila.id,
          estado,
        );
      }
    }

    return fila.id;
  }

  async function gasto(monto: number, estado: 'PAGADO' | 'PENDIENTE' = 'PAGADO'): Promise<void> {
    await db.$executeRawUnsafe(
      `INSERT INTO fogoneria.gastos (empresa_id, sucursal_id, concepto, monto, categoria, estado_pago, created_at)
       VALUES ($1, $2, 'Insumos de prueba', $3, 'INSUMOS', $4::fogoneria.estado_pago_gasto, $5)`,
      tenant.empresaId,
      tenant.sucursalId,
      monto,
      estado,
      new Date('2026-11-06T15:00:00.000Z'),
    );
  }

  async function movimiento(tipo: 'INGRESO' | 'EGRESO', monto: number, concepto: string, metodo = 'EFECTIVO') {
    if (!turnoId) {
      const [turno] = await db.$queryRawUnsafe<{ id: string }[]>(
        `INSERT INTO fogoneria.turnos_caja (empresa_id, sucursal_id, estado)
         VALUES ($1, $2, 'ABIERTO') RETURNING id`,
        tenant.empresaId,
        tenant.sucursalId,
      );
      turnoId = turno.id;
    }
    const [fila] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.ordenes (empresa_id, sucursal_id, numero_orden, estado, subtotal, total, created_at)
       VALUES ($1, $2, $3, 'PAGADA', 10, 10, $4) RETURNING id`,
      tenant.empresaId,
      tenant.sucursalId,
      `BI-MOV-${Math.random().toString(36).slice(2, 8)}`,
      new Date('2026-11-06T18:00:00.000Z'),
    );
    await db.$executeRawUnsafe(
      `INSERT INTO fogoneria.movimientos_caja (empresa_id, turno_id, tipo, concepto, monto, metodo, orden_id, created_at)
       VALUES ($1, $2, $3::fogoneria.tipo_movimiento_caja, $4, $5, $6::fogoneria.metodo_pago, $7, $8)`,
      tenant.empresaId,
      turnoId,
      tipo,
      concepto,
      monto,
      metodo,
      fila.id,
      new Date('2026-11-06T18:00:00.000Z'),
    );
  }

  async function pl(tabla: string): Promise<Record<string, unknown>[]> {
    return db.$transaction(async (tx) => {
      await asTenant(tx, { empresaId: tenant.empresaId, sucursalId: tenant.sucursalId });
      return tx.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM fogoneria.${tabla}`);
    });
  }

  it('la venta del día es solo de comandas cobradas', async () => {
    await orden(100);
    await orden(50);
    await orden(999, { estado: 'ENTREGADO' });
    await orden(888, { estado: 'ANULADA' });

    const [dia] = await pl('v_bi_ventas_dia');

    expect(Number(dia.ventas)).toBe(150);
    expect(Number(dia.n_ordenes)).toBe(2);
    expect(Number(dia.ticket_promedio)).toBe(75);
  });

  it('el P&L resta los gastos pagados y no cuenta los pendientes', async () => {
    await orden(200);
    await gasto(60, 'PAGADO');
    await gasto(500, 'PENDIENTE');

    const [dia] = await pl('v_bi_pl_dia');

    expect(Number(dia.ventas)).toBe(200);
    expect(Number(dia.gastos)).toBe(60);
    expect(Number(dia.margen)).toBe(140);
  });

  it('la propina se informa pero no suma al margen', async () => {
    await orden(100, { propina: 20 });

    const [dia] = await pl('v_bi_pl_dia');

    expect(Number(dia.ventas)).toBe(100);
    expect(Number(dia.propinas)).toBe(20);
    expect(Number(dia.margen)).toBe(100);
  });

  it('la venta sin comprobante es la diferencia contra lo comprobado', async () => {
    const conComp = await orden(100);
    await orden(40);
    const [comprobante] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.comprobantes (empresa_id, sucursal_id, tipo, serie_numero, orden_id, total, created_at)
       VALUES ($1, $2, 'BOLETA', $3, $4, 100, $5) RETURNING id`,
      tenant.empresaId,
      tenant.sucursalId,
      `B001-${Date.now()}`,
      conComp,
      new Date('2026-11-06T18:10:00.000Z'),
    );

    const [dia] = await pl('v_bi_pl_dia');

    expect(comprobante.id).toBeTruthy();
    expect(Number(dia.ventas)).toBe(140);
    expect(Number(dia.comprobado)).toBe(100);
    expect(Number(dia.venta_sin_comprobante)).toBe(40);
  });

  it('el ranking suma unidades e ingresos por plato cobrado', async () => {
    await orden(30, { platoId: tenant.platoId, cantidad: 1 });
    await orden(60, { platoId: tenant.platoId, cantidad: 2 });
    await orden(999, { estado: 'ENTREGADO', platoId: tenant.platoId, cantidad: 5 });

    const filas = await pl('v_bi_platos_top');
    const [plato] = filas.filter((fila) => fila.plato_id === tenant.platoId);

    expect(filas).toHaveLength(1);
    expect(Number(plato.unidades)).toBe(3);
    expect(Number(plato.ingresos)).toBe(90);
  });

  it('los cobros por método excluyen la propina y suman por método', async () => {
    await movimiento('INGRESO', 80, 'Cobro ORD-1', 'EFECTIVO');
    await movimiento('INGRESO', 40, 'Cobro ORD-2', 'TARJETA');
    await movimiento('INGRESO', 15, 'Propina ORD-1', 'EFECTIVO');
    await movimiento('EGRESO', 25, 'Pago de insumo', 'EFECTIVO');

    const filas = await pl('v_bi_cobros_metodo');
    const porMetodo = new Map(filas.map((fila) => [fila.metodo, Number(fila.monto)]));

    expect(porMetodo.get('EFECTIVO')).toBe(80);
    expect(porMetodo.get('TARJETA')).toBe(40);
    expect(porMetodo.size).toBe(2);
  });

  it('usa el día de Lima, no UTC', async () => {
    // 02:00 UTC del 7 = 21:00 del 6 en Lima.
    await orden(10, { createdAt: '2026-11-07T02:00:00.000Z' });

    const [dia] = await pl('v_bi_ventas_dia');

    expect(dia.fecha).toBeInstanceOf(Date);
    expect((dia.fecha as Date).toISOString().slice(0, 10)).toBe('2026-11-06');
  });

  it('las vistas respetan el aislamiento por empresa', async () => {
    await orden(70);
    const otra = await createTenant(db, 'BI-OTRA');
    await db.$executeRawUnsafe(
      `INSERT INTO fogoneria.ordenes (empresa_id, sucursal_id, numero_orden, estado, subtotal, total, created_at)
       VALUES ($1, $2, 'BI-AJENA', 'PAGADA', 900, 900, $3)`,
      otra.empresaId,
      otra.sucursalId,
      new Date('2026-11-06T18:00:00.000Z'),
    );

    const comoMia = await pl('v_bi_ventas_dia');
    const sinContexto = await db.$transaction(async (tx) => {
      await asTenant(tx, {});
      return tx.$queryRawUnsafe<Record<string, unknown>[]>('SELECT * FROM fogoneria.v_bi_ventas_dia');
    });

    expect(comoMia).toHaveLength(1);
    expect(Number(comoMia[0].ventas)).toBe(70);
    expect(sinContexto).toHaveLength(0);
  });

  it('las vistas heredadas también dejan de filtrar de menos', async () => {
    await orden(70);
    const otra = await createTenant(db, 'BI-VIEJA');
    await db.$executeRawUnsafe(
      `INSERT INTO fogoneria.ordenes (empresa_id, sucursal_id, numero_orden, estado, subtotal, total, created_at)
       VALUES ($1, $2, 'BI-VIEJA', 'PAGADA', 900, 900, $3)`,
      otra.empresaId,
      otra.sucursalId,
      new Date('2026-11-06T18:00:00.000Z'),
    );

    const sinContexto = await db.$transaction(async (tx) => {
      await asTenant(tx, {});
      return tx.$queryRawUnsafe<Record<string, unknown>[]>('SELECT * FROM fogoneria.v_ventas_dia');
    });

    expect(sinContexto).toHaveLength(0);
  });
});
