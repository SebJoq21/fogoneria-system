import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { PrismaService } from '../../src/prisma/prisma.service.js';
import type { TenantContextService } from '../../src/common/context/tenant-context.service.js';
import type { AuditService } from '../../src/modules/audit/audit.service.js';
import { InventoryService } from '../../src/modules/inventory/inventory.service.js';
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

describeDb('Kardex automático por escandallo (AYCDS-11)', () => {
  let db: PrismaClient;
  let tenant: TenantFixture;

  beforeAll(async () => {
    db = createDb();
    await prepareRlsRole(db);
  });

  beforeEach(async () => {
    await resetDatabase(db);
    tenant = await createTenant(db, 'KARDEX');
  });

  afterAll(async () => {
    await resetDatabase(db).catch(() => undefined);
    await db.$disconnect();
  });

  async function crearInsumo(nombre: string): Promise<string> {
    const [fila] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.insumos (empresa_id, nombre, unidad)
       VALUES ($1, $2, 'kg') RETURNING id`,
      tenant.empresaId,
      nombre,
    );
    return fila.id;
  }

  async function crearStock(insumoId: string, cantidad: number): Promise<void> {
    await db.$executeRawUnsafe(
      `INSERT INTO fogoneria.stocks_sucursal (sucursal_id, insumo_id, empresa_id, cantidad, stock_minimo)
       VALUES ($1, $2, $3, $4, 1)`,
      tenant.sucursalId,
      insumoId,
      tenant.empresaId,
      cantidad,
    );
  }

  async function crearReceta(platoId: string, insumoId: string, porPlato: number): Promise<void> {
    await db.$executeRawUnsafe(
      `INSERT INTO fogoneria.escandallos_recetas (plato_id, insumo_id, cantidad_por_plato, unidad)
       VALUES ($1, $2, $3, 'kg')`,
      platoId,
      insumoId,
      porPlato,
    );
  }

  async function crearDetalle(
    ordenId: string,
    tipo: 'PLATO' | 'COMBO',
    id: string,
    cantidad: number,
  ): Promise<void> {
    await db.$executeRawUnsafe(
      `INSERT INTO fogoneria.detalles_orden (orden_id, tipo, ${tipo === 'PLATO' ? 'plato_id' : 'combo_id'}, cantidad, precio_unitario, subtotal)
       VALUES ($1, $2::fogoneria.tipo_detalle_orden, $3, $4, 10, 10 * $4)`,
      ordenId,
      tipo,
      id,
      cantidad,
    );
  }

  async function crearPlato(nombre: string): Promise<string> {
    const [fila] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.platos (empresa_id, categoria_id, sku, nombre)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      tenant.empresaId,
      tenant.categoriaId,
      `SKU-${Math.random().toString(36).slice(2, 8)}`,
      nombre,
    );
    return fila.id;
  }

  /** Corre el servicio dentro de una transacción con el rol de negocio. */
  async function consumir(ordenId: string) {
    return db.$transaction(async (tx) => {
      await asTenant(tx, {
        empresaId: tenant.empresaId,
        sucursalId: tenant.sucursalId,
      });
      const service = new InventoryService(
        { scoped: tx } as unknown as PrismaService,
        {
          get: () => ({
            empresaId: tenant.empresaId,
            sucursalId: tenant.sucursalId,
            userId: tenant.usuarioId,
            rol: 'COCINERO',
            bypass: false,
          }),
        } as unknown as TenantContextService,
        { record: async () => undefined } as unknown as AuditService,
      );
      return service.consumeOrder(ordenId);
    });
  }

  async function stockDe(insumoId: string): Promise<number> {
    const [fila] = await db.$queryRawUnsafe<{ cantidad: string }[]>(
      `SELECT cantidad::text AS cantidad FROM fogoneria.stocks_sucursal
        WHERE sucursal_id = $1 AND insumo_id = $2`,
      tenant.sucursalId,
      insumoId,
    );
    return Number(fila.cantidad);
  }

  it('descuenta el insumo al entregar y deja el movimiento', async () => {
    const insumo = await crearInsumo('Papa');
    await crearStock(insumo, 10);
    await crearReceta(tenant.platoId, insumo, 0.5);
    const orden = await createOrden(db, tenant, 'ENTREGADO', 'ORD-K-1');
    await crearDetalle(orden, 'PLATO', tenant.platoId, 2);

    const result = await consumir(orden);

    expect(result).toMatchObject({ aplicado: true, insumos: 1, lineas: 1 });
    expect(await stockDe(insumo)).toBe(9);

    const [movimiento] = await db.$queryRawUnsafe<
      { tipo: string; cantidad: string; stock_resultante: string; motivo: string }[]
    >(
      `SELECT tipo::text AS tipo, cantidad::text AS cantidad,
              stock_resultante::text AS stock_resultante, motivo
         FROM fogoneria.movimientos_inventario WHERE orden_id = $1`,
      orden,
    );
    expect(movimiento).toMatchObject({
      tipo: 'SALIDA',
      cantidad: '1.000',
      stock_resultante: '9.000',
      motivo: 'Consumo ORD-K-1',
    });
  });

  it('no descuenta dos veces la misma comanda', async () => {
    const insumo = await crearInsumo('Papa');
    await crearStock(insumo, 10);
    await crearReceta(tenant.platoId, insumo, 1);
    const orden = await createOrden(db, tenant, 'ENTREGADO', 'ORD-K-2');
    await crearDetalle(orden, 'PLATO', tenant.platoId, 1);

    await consumir(orden);
    const segunda = await consumir(orden);

    expect(segunda.aplicado).toBe(false);
    expect(await stockDe(insumo)).toBe(9);
    const [conteo] = await db.$queryRawUnsafe<{ total: bigint }[]>(
      `SELECT count(*) AS total FROM fogoneria.movimientos_inventario WHERE orden_id = $1`,
      orden,
    );
    expect(Number(conteo.total)).toBe(1);
  });

  it('explota el combo a sus platos', async () => {
    const insumoA = await crearInsumo('Pollo');
    const insumoB = await crearInsumo('Arroz');
    await crearStock(insumoA, 10);
    await crearStock(insumoB, 10);
    const platoB = await crearPlato('Arroz con pollo');
    await crearReceta(tenant.platoId, insumoA, 0.3);
    await crearReceta(platoB, insumoB, 0.2);

    const [combo] = await db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO fogoneria.combos (empresa_id, nombre, precio_fijo)
       VALUES ($1, 'Combo del día', 25) RETURNING id`,
      tenant.empresaId,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO fogoneria.combos_platos (combo_id, plato_id, cantidad)
       VALUES ($1, $2, 1), ($1, $3, 2)`,
      combo.id,
      tenant.platoId,
      platoB,
    );

    const orden = await createOrden(db, tenant, 'ENTREGADO', 'ORD-K-3');
    await crearDetalle(orden, 'COMBO', combo.id, 2);

    const result = await consumir(orden);

    // 2 combos: pollo 2×1×0.3 = 0.6; arroz 2×2×0.2 = 0.8.
    expect(result).toMatchObject({ aplicado: true, insumos: 2 });
    expect(await stockDe(insumoA)).toBe(9.4);
    expect(await stockDe(insumoB)).toBe(9.2);
  });

  it('crea el stock en cero cuando la sucursal no lo tenía', async () => {
    const insumo = await crearInsumo('Aceite');
    await crearReceta(tenant.platoId, insumo, 0.5);
    const orden = await createOrden(db, tenant, 'ENTREGADO', 'ORD-K-4');
    await crearDetalle(orden, 'PLATO', tenant.platoId, 1);

    await consumir(orden);

    expect(await stockDe(insumo)).toBe(0);
  });

  it('no baja de cero cuando la receta consume más de lo disponible', async () => {
    const insumo = await crearInsumo('Harina');
    await crearStock(insumo, 1);
    await crearReceta(tenant.platoId, insumo, 2);
    const orden = await createOrden(db, tenant, 'ENTREGADO', 'ORD-K-6');
    await crearDetalle(orden, 'PLATO', tenant.platoId, 1);

    await consumir(orden);

    expect(await stockDe(insumo)).toBe(0);
    const [movimiento] = await db.$queryRawUnsafe<
      { cantidad: string; stock_resultante: string }[]
    >(
      `SELECT cantidad::text AS cantidad, stock_resultante::text AS stock_resultante
         FROM fogoneria.movimientos_inventario WHERE orden_id = $1`,
      orden,
    );
    expect(movimiento).toMatchObject({ cantidad: '2.000', stock_resultante: '0.000' });
  });

  it('no rompe con un plato sin receta', async () => {
    const orden = await createOrden(db, tenant, 'ENTREGADO', 'ORD-K-5');
    await crearDetalle(orden, 'PLATO', tenant.platoId, 1);

    const result = await consumir(orden);

    expect(result).toMatchObject({ aplicado: false, insumos: 0 });
    expect(result.sinReceta).toEqual([tenant.platoId]);
  });
});
