import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TenantContextService } from '../context/tenant-context.service.js';
import { limaDayKey } from '../utils/lima-day.js';

/** Tipos de secuencia soportados. Se agregan aquí cuando haga falta otro folio. */
export type SecuenciaTipo = 'ORD' | 'RSV';

interface ValorRow {
  valor: bigint;
}

interface RawExecutor {
  $queryRawUnsafe: <T>(query: string, ...values: unknown[]) => Promise<T>;
  $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<number>;
}

const SCHEMA_PATTERN = /^[a-z_][a-z0-9_]*$/;

/**
 * Folios por empresa (AYCDS-16/20).
 *
 * El incremento es una sola sentencia atómica (`INSERT ... ON CONFLICT ... DO
 * UPDATE ... RETURNING`) dentro de la transacción del request, así dos comandas
 * simultáneas nunca reciben el mismo número. No se usa el reloj del servidor
 * ni `COUNT(*)`: ambos se repiten bajo concurrencia o tras un borrado.
 *
 * El SQL crudo no pasa por Prisma, así que la tabla se califica con el esquema
 * configurado (`DATABASE_SCHEMA`); el `search_path` de la conexión no lo cubre.
 */
@Injectable()
export class SequencesService {
  private readonly table: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    config: ConfigService,
  ) {
    const schema = config.get<string>('DATABASE_SCHEMA') ?? 'fogoneria';
    if (!SCHEMA_PATTERN.test(schema)) {
      throw new Error(`DATABASE_SCHEMA inválido: ${schema}`);
    }
    this.table = `${schema}.secuencias`;
  }

  /**
   * Siguiente valor de la secuencia (1, 2, 3…) para la empresa y el tipo.
   * Si el request ya abrió la transacción RLS, se reutiliza para que el
   * incremento y el resto de la operación sean atómicos.
   */
  async next(empresaId: string, tipo: SecuenciaTipo): Promise<number> {
    const tx = this.tenantContext.get()?.tx;
    if (tx) {
      const [row] = await this.bump(tx, empresaId, tipo);
      return Number(row.valor);
    }

    // Sin request (cron, script): se abre una transacción propia y se fija el
    // contexto para que la política RLS de `secuencias` permita el INSERT.
    const [row] = await this.prisma.rls.$transaction(async (inner) => {
      await inner.$executeRawUnsafe(
        "SELECT set_config('app.empresa_id', $1, true)",
        empresaId,
      );
      return this.bump(inner, empresaId, tipo);
    });
    return Number(row.valor);
  }

  /** `ORD-000123` */
  async nextNumeroOrden(empresaId: string): Promise<string> {
    const valor = await this.next(empresaId, 'ORD');
    return `ORD-${String(valor).padStart(6, '0')}`;
  }

  /** `RSV-20261027-0007` (el sufijo es el contador de la empresa, no del día). */
  async nextCodigoReserva(empresaId: string, fecha: Date): Promise<string> {
    const valor = await this.next(empresaId, 'RSV');
    return `RSV-${limaDayKey(fecha)}-${String(valor).padStart(4, '0')}`;
  }

  private async bump(
    client: RawExecutor,
    empresaId: string,
    tipo: SecuenciaTipo,
  ): Promise<ValorRow[]> {
    return client.$queryRawUnsafe<ValorRow[]>(
      `INSERT INTO ${this.table} (empresa_id, tipo, valor)
       VALUES ($1::uuid, $2, 1)
       ON CONFLICT (empresa_id, tipo)
       DO UPDATE SET valor = ${this.table}.valor + 1, updated_at = now()
       RETURNING valor`,
      empresaId,
      tipo,
    );
  }
}
