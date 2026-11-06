import type { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { PrismaService } from '../../src/prisma/prisma.service.js';
import { SequencesService } from '../../src/common/sequences/sequences.service.js';
import {
  captureDbError,
  createDb,
  createOrden,
  createTenant,
  expectDbError,
  hasTestDatabase,
  prepareRlsRole,
  resetDatabase,
  type TenantFixture,
} from './helpers.js';

const describeDb = hasTestDatabase ? describe : describe.skip;

describeDb('Comprobantes: correlativo y anulación (AYCDS-36)', () => {
  let db: PrismaClient;
  let tenant: TenantFixture;
  let sequences: SequencesService;

  beforeAll(async () => {
    db = createDb();
    await prepareRlsRole(db);
    sequences = new SequencesService(
      { raw: db } as unknown as PrismaService,
      { get: () => 'fogoneria' } as unknown as ConfigService,
    );
  });

  beforeEach(async () => {
    await resetDatabase(db);
    tenant = await createTenant(db, 'COMP');
  });

  afterAll(async () => {
    await resetDatabase(db).catch(() => undefined);
    await db.$disconnect();
  });

  async function emitir(serieNumero: string, ordenId: string): Promise<string> {
    const [fila] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.comprobantes
         (empresa_id, sucursal_id, tipo, serie_numero, orden_id, total, estado, emitido_por)
       VALUES ($1, $2, 'BOLETA', $3, $4, 118, 'PAGADA', $5)
       RETURNING id`,
      tenant.empresaId,
      tenant.sucursalId,
      serieNumero,
      ordenId,
      tenant.usuarioId,
    );
    return fila.id;
  }

  it('numera cada serie por separado y sin repetir', async () => {
    const primera = await sequences.nextComprobante(tenant.empresaId, 'B001');
    const segunda = await sequences.nextComprobante(tenant.empresaId, 'B001');
    const factura = await sequences.nextComprobante(tenant.empresaId, 'F001');

    expect(primera).toBe('B001-00000001');
    expect(segunda).toBe('B001-00000002');
    expect(factura).toBe('F001-00000001');
  });

  it('no repite serie-número dentro de la empresa', async () => {
    const ordenA = await createOrden(db, tenant, 'PAGADA', 'ORD-C-1');
    const ordenB = await createOrden(db, tenant, 'PAGADA', 'ORD-C-2');
    const numero = await sequences.nextComprobante(tenant.empresaId, 'B001');
    await emitir(numero, ordenA);

    const error = await captureDbError(() => emitir(numero, ordenB));

    expect(`${error.code ?? ''} ${error.message}`).toMatch(
      /23505|P2002|uq_comp_empresa_serie/,
    );
  });

  it('la numeración no se repite tras dos emisiones seguidas', async () => {
    const uno = await sequences.nextComprobante(tenant.empresaId, 'B001');
    const dos = await sequences.nextComprobante(tenant.empresaId, 'B001');

    expect(uno).not.toBe(dos);
    const [ordenA, ordenB] = [
      await createOrden(db, tenant, 'PAGADA', 'ORD-C-3'),
      await createOrden(db, tenant, 'PAGADA', 'ORD-C-4'),
    ];
    await emitir(uno, ordenA);
    await emitir(dos, ordenB);

    const [conteo] = await db.$queryRawUnsafe<{ total: bigint }[]>(
      `SELECT count(*) AS total FROM fogoneria.comprobantes WHERE empresa_id = $1`,
      tenant.empresaId,
    );
    expect(Number(conteo.total)).toBe(2);
  });

  it('exige actor, fecha y motivo para anular', async () => {
    const orden = await createOrden(db, tenant, 'PAGADA', 'ORD-C-5');
    const comprobante = await emitir('B001-00000099', orden);

    const error = await captureDbError(() =>
      db.$executeRawUnsafe(
        `UPDATE fogoneria.comprobantes SET estado = 'ANULADA' WHERE id = $1`,
        comprobante,
      ),
    );

    expectDbError(error, 'DB_ANULACION_INCOMPLETA');
  });

  it('anula con motivo y deja el registro congelado', async () => {
    const orden = await createOrden(db, tenant, 'PAGADA', 'ORD-C-6');
    const comprobante = await emitir('B001-00000100', orden);

    await db.$executeRawUnsafe(
      `UPDATE fogoneria.comprobantes
          SET estado = 'ANULADA', anulado_por = $2, anulado_at = now(),
              motivo_anulacion = 'Cliente desistió'
        WHERE id = $1`,
      comprobante,
      tenant.usuarioId,
    );

    const [fila] = await db.$queryRawUnsafe<{ estado: string; motivo: string }[]>(
      `SELECT estado::text AS estado, motivo_anulacion AS motivo
         FROM fogoneria.comprobantes WHERE id = $1`,
      comprobante,
    );
    expect(fila).toMatchObject({ estado: 'ANULADA', motivo: 'Cliente desistió' });

    const error = await captureDbError(() =>
      db.$executeRawUnsafe(
        `UPDATE fogoneria.comprobantes SET motivo_anulacion = 'otra' WHERE id = $1`,
        comprobante,
      ),
    );
    expectDbError(error, 'DB_COMPROBANTE_ANULADO');
  });
});
