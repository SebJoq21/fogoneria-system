import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { PrismaService } from '../../src/prisma/prisma.service.js';
import type { RealtimeService } from '../../src/modules/realtime/realtime.service.js';
import { OrdersSlaCron } from '../../src/modules/orders/orders.sla.cron.js';
import {
  createDb,
  createOrden,
  createTenant,
  hasTestDatabase,
  prepareRlsRole,
  resetDatabase,
  type TenantFixture,
} from './helpers.js';

const describeDb = hasTestDatabase ? describe : describe.skip;

async function moverRelojes(
  db: PrismaClient,
  ordenId: string,
  minutosIngreso: number,
  minutosConfirmacion: number | null,
): Promise<void> {
  await db.$executeRawUnsafe(
    `UPDATE fogoneria.ordenes
        SET ingreso_at = now() - ($2::text || ' minutes')::interval,
            confirmacion_at = CASE
              WHEN $3::text IS NULL THEN NULL
              ELSE now() - ($3::text || ' minutes')::interval
            END
      WHERE id = $1`,
    ordenId,
    String(minutosIngreso),
    minutosConfirmacion === null ? null : String(minutosConfirmacion),
  );
}

async function alertaDe(db: PrismaClient, ordenId: string): Promise<boolean> {
  const [fila] = await db.$queryRawUnsafe<{ alerta_sla: boolean }[]>(
    `SELECT alerta_sla FROM fogoneria.ordenes WHERE id = $1`,
    ordenId,
  );
  return fila.alerta_sla;
}

describeDb('SLA del KDS en la base (AYCDS-30)', () => {
  let db: PrismaClient;
  let tenant: TenantFixture;
  let evento: { empresaId: string; payload: { ordenId: string; minutos: number } }[];
  let cron: OrdersSlaCron;

  beforeAll(async () => {
    db = createDb();
    await prepareRlsRole(db);
  });

  beforeEach(async () => {
    await resetDatabase(db);
    tenant = await createTenant(db, 'SLA');
    evento = [];
    const realtime = {
      orderSla: (empresaId: string, payload: { ordenId: string; minutos: number }) => {
        evento.push({ empresaId, payload });
      },
    };
    cron = new OrdersSlaCron(
      { raw: db } as unknown as PrismaService,
      realtime as unknown as RealtimeService,
    );
  });

  afterAll(async () => {
    await resetDatabase(db).catch(() => undefined);
    await db.$disconnect();
  });

  it('marca las comandas que pasaron los 20 minutos', async () => {
    const ordenId = await createOrden(db, tenant, 'EN_COCINA', 'ORD-TARDE');
    await moverRelojes(db, ordenId, 40, 30);

    const result = await cron.sweep(new Date());

    expect(result.marcadas).toBe(1);
    expect(await alertaDe(db, ordenId)).toBe(true);
    expect(evento).toHaveLength(1);
    expect(evento[0].payload.ordenId).toBe(ordenId);
    expect(evento[0].payload.minutos).toBeGreaterThanOrEqual(29);
  });

  it('no marca las comandas que siguen en tiempo', async () => {
    const ordenId = await createOrden(db, tenant, 'EN_COCINA', 'ORD-A-TIEMPO');
    await moverRelojes(db, ordenId, 10, 5);

    const result = await cron.sweep(new Date());

    expect(result.marcadas).toBe(0);
    expect(await alertaDe(db, ordenId)).toBe(false);
    expect(evento).toHaveLength(0);
  });

  it('usa el ingreso cuando la cocina todavía no confirmó', async () => {
    const ordenId = await createOrden(db, tenant, 'POR_CONFIRMAR', 'ORD-SIN-CONF');
    await moverRelojes(db, ordenId, 25, null);

    await cron.sweep(new Date());

    expect(await alertaDe(db, ordenId)).toBe(true);
  });

  it('no vuelve a marcar ni a emitir en la siguiente corrida', async () => {
    const ordenId = await createOrden(db, tenant, 'EN_COCINA', 'ORD-UNA-VEZ');
    await moverRelojes(db, ordenId, 40, 30);

    await cron.sweep(new Date());
    evento.length = 0;
    const segunda = await cron.sweep(new Date());

    expect(segunda.marcadas).toBe(0);
    expect(evento).toHaveLength(0);
  });

  it('ignora las comandas ya entregadas', async () => {
    const ordenId = await createOrden(db, tenant, 'ENTREGADO', 'ORD-ENTREGADA');
    await moverRelojes(db, ordenId, 90, 80);

    const result = await cron.sweep(new Date());

    expect(result.marcadas).toBe(0);
    expect(await alertaDe(db, ordenId)).toBe(false);
  });

  it('marca las comandas de dos empresas y emite con la empresa correcta', async () => {
    const otra = await createTenant(db, 'SLA-B');
    const deA = await createOrden(db, tenant, 'EN_COCINA', 'ORD-SLA-A');
    const deB = await createOrden(db, otra, 'EN_COCINA', 'ORD-SLA-B');
    await moverRelojes(db, deA, 40, 30);
    await moverRelojes(db, deB, 40, 30);

    const result = await cron.sweep(new Date());

    expect(result.marcadas).toBe(2);
    const empresas = new Set(evento.map((item) => item.empresaId));
    expect(empresas).toEqual(new Set([tenant.empresaId, otra.empresaId]));
  });
});
