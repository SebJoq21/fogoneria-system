import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { limaDayKey } from '../utils/lima-day.js';

/** Tipos de secuencia soportados. Se agregan aquí cuando haga falta otro folio. */
export type SecuenciaTipo = 'ORD' | 'RSV';

interface ValorRow {
  valor: bigint;
}

interface RawExecutor {
  $queryRawUnsafe: <T>(query: string, ...values: unknown[]) => Promise<T>;
}

const SCHEMA_PATTERN = /^[a-z_][a-z0-9_]*$/;

/**
 * Folios por empresa (AYCDS-16/20, optimizado en AYCDS-22).
 *
 * El incremento es una sola sentencia atómica (`INSERT ... ON CONFLICT ... DO
 * UPDATE ... RETURNING`): dos comandas simultáneas nunca reciben el mismo
 * número y no se depende del reloj ni de `COUNT(*)`.
 *
 * **Por qué NO dentro de la transacción del request** (AYCDS-22): el upsert
 * bloquea la fila `(empresa_id, tipo)` hasta el commit. Si se ejecuta dentro de
 * la transacción de la comanda, ese lock se retiene mientras se resuelven
 * precios, se insertan líneas, se audita y se emiten eventos (~20 ms), así que
 * todas las altas de una empresa se serializan. Con 50 meseros concurrentes el
 * throughput se estancaba en ~50 órdenes/s y el p95 pasaba de 1 s.
 *
 * Ahora la sentencia corre en autocommit sobre el pool de plataforma
 * (`prisma.raw`, conexiones propias) y el lock dura lo que tarda el propio
 * upsert (~1 ms). Se acepta un hueco en la numeración si la creación falla
 * después: un folio sin comanda es preferible a una cola de 1 s en el pico.
 *
 * El SQL crudo no pasa por Prisma, así que la tabla se califica con el esquema
 * configurado (`DATABASE_SCHEMA`); el `search_path` de la conexión no lo cubre.
 */
@Injectable()
export class SequencesService {
  private readonly table: string;

  constructor(
    private readonly prisma: PrismaService,
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
   * El `empresaId` sale del JWT, nunca del body: la fila del contador queda
   * atada al tenant aunque la sentencia use el pool de plataforma.
   */
  async next(empresaId: string, tipo: SecuenciaTipo): Promise<number> {
    const [row] = await this.bump(this.prisma.raw, empresaId, tipo);
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
