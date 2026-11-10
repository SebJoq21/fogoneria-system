import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { PrismaService } from '../../src/prisma/prisma.service.js';
import type { TenantContextService } from '../../src/common/context/tenant-context.service.js';
import type { AuditService } from '../../src/modules/audit/audit.service.js';
import { CrmService } from '../../src/modules/crm/crm.service.js';
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

describeDb('CRM: puntos y segmentos (AYCDS-31)', () => {
  let db: PrismaClient;
  let tenant: TenantFixture;

  beforeAll(async () => {
    db = createDb();
    await prepareRlsRole(db);
  });

  beforeEach(async () => {
    await resetDatabase(db);
    tenant = await createTenant(db, 'CRM');
  });

  afterAll(async () => {
    await resetDatabase(db).catch(() => undefined);
    await db.$disconnect();
  });

  async function crearCliente(nombre = 'Ana Torres'): Promise<string> {
    const [fila] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.clientes (empresa_id, nombre, telefono)
       VALUES ($1, $2, $3) RETURNING id`,
      tenant.empresaId,
      nombre,
      `9${Math.floor(10000000 + Math.random() * 89999999)}`,
    );
    return fila.id;
  }

  async function ordenPagadaDe(clienteId: string, total = 36, estado = 'PAGADA'): Promise<string> {
    // La orden terminal no admite cambios (trigger de inmutabilidad): se crea
    // en ENTREGADO, se le pone cliente/total y recién entonces pasa a PAGADA.
    const orden = await createOrden(
      db,
      tenant,
      estado === 'PAGADA' ? 'ENTREGADO' : estado,
      `ORD-CRM-${Math.random().toString(36).slice(2, 7)}`,
    );
    await db.$executeRawUnsafe(
      `UPDATE fogoneria.ordenes SET cliente_id = $2, total = $3 WHERE id = $1`,
      orden,
      clienteId,
      total,
    );
    if (estado === 'PAGADA') {
      await db.$executeRawUnsafe(
        `UPDATE fogoneria.ordenes SET estado = 'PAGADA' WHERE id = $1`,
        orden,
      );
    }
    return orden;
  }

  async function clienteDe(id: string): Promise<{
    visitas: number;
    puntos: number;
    segmento: string;
    ultima_visita: Date | null;
  }> {
    const [fila] = await db.$queryRawUnsafe<
      { visitas: number; puntos: number; segmento: string; ultima_visita: Date | null }[]
    >(
      `SELECT visitas, puntos, segmento::text AS segmento, ultima_visita
         FROM fogoneria.clientes WHERE id = $1`,
      id,
    );
    return fila;
  }

  /** El worker corre con el cliente de plataforma: se prueba contra la base real. */
  function buildCrm(): CrmService {
    return new CrmService(
      { scoped: db, raw: db } as unknown as PrismaService,
      { get: () => ({ empresaId: tenant.empresaId, sucursalId: tenant.sucursalId, userId: tenant.usuarioId }) } as unknown as TenantContextService,
      { record: async () => undefined } as unknown as AuditService,
    );
  }

  it('otorga puntos por la comanda pagada y cuenta la visita', async () => {
    const clienteId = await crearCliente();
    const orden = await ordenPagadaDe(clienteId, 36);

    const result = await buildCrm().procesarConsumos();

    expect(result.puntos).toBe(36);
    const cliente = await clienteDe(clienteId);
    expect(cliente).toMatchObject({ visitas: 1, puntos: 36, segmento: 'NUEVO' });

    const [movimiento] = await db.$queryRawUnsafe<
      { tipo: string; puntos: number; orden_id: string }[]
    >(
      `SELECT tipo::text AS tipo, puntos, orden_id FROM fogoneria.movimientos_puntos WHERE orden_id = $1`,
      orden,
    );
    expect(movimiento).toMatchObject({ tipo: 'GANANCIA', puntos: 36, orden_id: orden });
  });

  it('no duplica los puntos en una segunda corrida', async () => {
    const clienteId = await crearCliente();
    await ordenPagadaDe(clienteId, 50);

    await buildCrm().procesarConsumos();
    const segunda = await buildCrm().procesarConsumos();

    expect(segunda).toEqual({ puntos: 0, clientes: 0 });
    const cliente = await clienteDe(clienteId);
    expect(cliente.puntos).toBe(50);
  });

  it('ignora comandas que no están pagadas', async () => {
    const clienteId = await crearCliente();
    await ordenPagadaDe(clienteId, 80, 'ENTREGADO');

    const result = await buildCrm().procesarConsumos();

    expect(result.puntos).toBe(0);
    expect((await clienteDe(clienteId)).puntos).toBe(0);
  });

  it('asciende a FRECUENTE a las 5 visitas y a VIP a las 20', async () => {
    const frecuente = await crearCliente('Frecuente');
    for (let i = 0; i < 5; i += 1) await ordenPagadaDe(frecuente, 10);

    const vip = await crearCliente('Vip');
    for (let i = 0; i < 20; i += 1) await ordenPagadaDe(vip, 10);

    await buildCrm().procesarConsumos();

    expect((await clienteDe(frecuente)).segmento).toBe('FRECUENTE');
    expect((await clienteDe(vip)).segmento).toBe('VIP');
    expect((await clienteDe(vip)).visitas).toBe(20);
  });

  it('el canje manual descuenta del saldo', async () => {
    const clienteId = await crearCliente();
    await ordenPagadaDe(clienteId, 100);
    await buildCrm().procesarConsumos();
    expect((await clienteDe(clienteId)).puntos).toBe(100);

    await db.$transaction(async (tx) => {
      await asTenant(tx, {
        empresaId: tenant.empresaId,
        sucursalId: tenant.sucursalId,
      });
      const crm = new CrmService(
        { scoped: tx, raw: tx } as unknown as PrismaService,
        {
          get: () => ({
            empresaId: tenant.empresaId,
            sucursalId: tenant.sucursalId,
            userId: tenant.usuarioId,
          }),
        } as unknown as TenantContextService,
        { record: async () => undefined } as unknown as AuditService,
      );
      await crm.adjustPoints(clienteId, { tipo: 'CANJE', puntos: 30 });
    });

    expect((await clienteDe(clienteId)).puntos).toBe(70);
  });
});
