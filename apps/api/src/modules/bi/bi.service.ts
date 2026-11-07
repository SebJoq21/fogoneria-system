import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../../generated/prisma/client.js';
import { TenantContextService } from '../../common/context/tenant-context.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { RangoBiQueryDto, TopDishesQueryDto } from './dto/bi.dto.js';

const SCHEMA_PATTERN = /^[a-z_][a-z0-9_]*$/;

/** Máximo de días que acepta un reporte: 12 meses. */
const MAX_DIAS = 366;

type Cliente = Pick<Prisma.TransactionClient, '$queryRawUnsafe'>;

function num(value: unknown): number {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

/**
 * Reportes de BI (AYCDS-35) sobre las vistas de AYCDS-38.
 *
 * Reglas:
 *  - **Siempre con ventana de fechas** (`desde`/`hasta`, máximo 12 meses): con
 *    `FORCE ROW LEVEL SECURITY` el planificador no ve estadísticas y una vista
 *    sin ventana recorre la tabla completa (deuda conocida de AYCDS-22).
 *  - **El tenant lo pone RLS**, no el SQL: la consulta corre en la transacción
 *    del request con `app.empresa_id` fijado. Por eso el SQL no filtra por
 *    `empresa_id` y no puede olvidarlo.
 *  - **Sucursal**: un rol operativo consulta la suya (pedir otra es 400);
 *    `ADMIN_GLOBAL` puede omitirla y ver el agregado de la empresa.
 *  - Los importes se devuelven como `number` (la base entrega `Decimal`), con 2
 *    decimales.
 */
@Injectable()
export class BiService {
  private readonly schema: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    config: ConfigService,
  ) {
    const schema = config.get<string>('DATABASE_SCHEMA') ?? 'fogoneria';
    if (!SCHEMA_PATTERN.test(schema)) {
      throw new Error(`DATABASE_SCHEMA inválido: ${schema}`);
    }
    this.schema = schema;
  }

  /** P&L del rango: ventas, comprobado, gastos, margen y propinas. */
  async pnl(query: RangoBiQueryDto) {
    const { desde, hasta, sucursalId } = this.rango(query);

    const filas = await this.cliente().$queryRawUnsafe<
      {
        ventas: unknown;
        comprobado: unknown;
        venta_sin_comprobante: unknown;
        gastos: unknown;
        margen: unknown;
        propinas: unknown;
      }[]
    >(
      `SELECT
         COALESCE(SUM(ventas), 0) AS ventas,
         COALESCE(SUM(comprobado), 0) AS comprobado,
         COALESCE(SUM(venta_sin_comprobante), 0) AS venta_sin_comprobante,
         COALESCE(SUM(gastos), 0) AS gastos,
         COALESCE(SUM(margen), 0) AS margen,
         COALESCE(SUM(propinas), 0) AS propinas
       FROM ${this.schema}.v_bi_pl_dia
       WHERE fecha BETWEEN $1::date AND $2::date
         AND ($3::uuid IS NULL OR sucursal_id = $3::uuid)`,
      desde,
      hasta,
      sucursalId,
    );

    const total = filas[0];
    return {
      desde,
      hasta,
      sucursalId: sucursalId ?? null,
      ventas: num(total?.ventas),
      comprobado: num(total?.comprobado),
      ventaSinComprobante: num(total?.venta_sin_comprobante),
      gastos: num(total?.gastos),
      margen: num(total?.margen),
      propinas: num(total?.propinas),
    };
  }

  /** Serie diaria del P&L (para el gráfico de la UI de analíticas). */
  async pnlPorDia(query: RangoBiQueryDto) {
    const { desde, hasta, sucursalId } = this.rango(query);

    const filas = await this.cliente().$queryRawUnsafe<
      { fecha: Date; ventas: unknown; gastos: unknown; margen: unknown }[]
    >(
      `SELECT fecha,
              COALESCE(SUM(ventas), 0) AS ventas,
              COALESCE(SUM(gastos), 0) AS gastos,
              COALESCE(SUM(margen), 0) AS margen
       FROM ${this.schema}.v_bi_pl_dia
       WHERE fecha BETWEEN $1::date AND $2::date
         AND ($3::uuid IS NULL OR sucursal_id = $3::uuid)
       GROUP BY fecha
       ORDER BY fecha ASC`,
      desde,
      hasta,
      sucursalId,
    );

    return {
      desde,
      hasta,
      sucursalId: sucursalId ?? null,
      items: filas.map((fila) => ({
        fecha: this.diaTexto(fila.fecha),
        ventas: num(fila.ventas),
        gastos: num(fila.gastos),
        margen: num(fila.margen),
      })),
    };
  }

  /** Platos más vendidos del rango, por unidades. */
  async topDishes(query: TopDishesQueryDto) {
    const { desde, hasta, sucursalId } = this.rango(query);
    const limite = query.limit ?? 10;

    const filas = await this.cliente().$queryRawUnsafe<
      { plato_id: string; sku: string | null; nombre: string; unidades: unknown; ingresos: unknown }[]
    >(
      `SELECT plato_id, sku, nombre,
              SUM(unidades) AS unidades,
              SUM(ingresos) AS ingresos
       FROM ${this.schema}.v_bi_platos_top
       WHERE fecha BETWEEN $1::date AND $2::date
         AND ($3::uuid IS NULL OR sucursal_id = $3::uuid)
       GROUP BY plato_id, sku, nombre
       ORDER BY SUM(unidades) DESC, SUM(ingresos) DESC
       LIMIT $4`,
      desde,
      hasta,
      sucursalId,
      limite,
    );

    return {
      desde,
      hasta,
      sucursalId: sucursalId ?? null,
      items: filas.map((fila) => ({
        platoId: fila.plato_id,
        sku: fila.sku,
        nombre: fila.nombre,
        unidades: Number(fila.unidades ?? 0),
        ingresos: num(fila.ingresos),
      })),
    };
  }

  /** Cobros del rango por método de pago (sin la propina). */
  async salesByMethod(query: RangoBiQueryDto) {
    const { desde, hasta, sucursalId } = this.rango(query);

    const filas = await this.cliente().$queryRawUnsafe<
      { metodo: string; n_cobros: unknown; monto: unknown }[]
    >(
      `SELECT metodo,
              SUM(n_cobros) AS n_cobros,
              SUM(monto) AS monto
       FROM ${this.schema}.v_bi_cobros_metodo
       WHERE fecha BETWEEN $1::date AND $2::date
         AND ($3::uuid IS NULL OR sucursal_id = $3::uuid)
       GROUP BY metodo
       ORDER BY SUM(monto) DESC`,
      desde,
      hasta,
      sucursalId,
    );

    return {
      desde,
      hasta,
      sucursalId: sucursalId ?? null,
      items: filas.map((fila) => ({
        metodo: fila.metodo,
        cobros: Number(fila.n_cobros ?? 0),
        monto: num(fila.monto),
      })),
    };
  }

  /* -------------------------------- internos ------------------------------ */

  /**
   * Valida el rango y resuelve la sucursal. La transacción del request (con
   * `app.empresa_id`) es la que hace cumplir el aislamiento.
   */
  private rango(query: RangoBiQueryDto): {
    desde: string;
    hasta: string;
    sucursalId: string | null;
  } {
    const desde = this.fecha(query.desde);
    const hasta = this.fecha(query.hasta);
    if (desde > hasta) {
      throw new BadRequestException('desde no puede ser posterior a hasta');
    }
    const dias = Math.round((hasta.getTime() - desde.getTime()) / 86_400_000) + 1;
    if (dias > MAX_DIAS) {
      throw new BadRequestException(
        `El rango no puede superar ${MAX_DIAS} días: acota desde/hasta`,
      );
    }

    const delToken = this.tenantContext.get()?.sucursalId ?? null;
    if (delToken && query.sucursalId && query.sucursalId !== delToken) {
      throw new BadRequestException(
        'El token está atado a otra sucursal: no se puede indicar sucursalId',
      );
    }

    return {
      desde: query.desde,
      hasta: query.hasta,
      sucursalId: delToken ?? query.sucursalId ?? null,
    };
  }

  /** Fecha `YYYY-MM-DD` a medianoche UTC (solo se usa para comparar el rango). */
  private fecha(texto: string): Date {
    const fecha = new Date(`${texto}T00:00:00.000Z`);
    if (Number.isNaN(fecha.getTime())) {
      throw new BadRequestException(`Fecha inválida: ${texto}`);
    }
    return fecha;
  }

  /** `Date` que devuelve la vista (`date`) a `YYYY-MM-DD`. */
  private diaTexto(valor: Date | string): string {
    if (typeof valor === 'string') return valor.slice(0, 10);
    return valor.toISOString().slice(0, 10);
  }

  /**
   * Cliente con el contexto RLS del request. Las vistas son `security_invoker`,
   * así que sin esta transacción devolverían 0 filas: es la garantía, no un
   * detalle.
   */
  private cliente(): Cliente {
    const tx = this.tenantContext.get()?.tx;
    return (tx ?? this.prisma.rls) as Cliente;
  }
}
