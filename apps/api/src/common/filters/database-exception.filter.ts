import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { Response } from 'express';

/**
 * Traduce los errores de la base a HTTP (AYCDS-39 / AYCDS-46 p2).
 *
 * Los triggers de inmutabilidad y reversión lanzan `RAISE EXCEPTION` con
 * `ERRCODE = '45000'` y un código `DB_*`. Sin este filtro, un `DB_REVERSION_SIN_TURNO`
 * salía como **500** y el cajero no sabía que solo tenía que abrir caja.
 *
 * El mapeo vive en `docs/errores-db.md`; aquí solo se implementa. Un código
 * desconocido cae en 409 (regla de negocio) para no mentir con un 500.
 */
const ESTADOS: Record<string, HttpStatus> = {
  DB_TURNO_NO_EXISTE: HttpStatus.NOT_FOUND,
  DB_TURNO_DATOS_INMUTABLES: HttpStatus.UNPROCESSABLE_ENTITY,
  DB_TURNO_CIERRE_INCOMPLETO: HttpStatus.UNPROCESSABLE_ENTITY,
  DB_COMPROBANTE_ESTADO_INICIAL: HttpStatus.UNPROCESSABLE_ENTITY,
  DB_COMPROBANTE_DATOS_INMUTABLES: HttpStatus.UNPROCESSABLE_ENTITY,
  DB_ANULACION_INCOMPLETA: HttpStatus.UNPROCESSABLE_ENTITY,
  DB_ORDEN_TRANSICION_INVALIDA: HttpStatus.UNPROCESSABLE_ENTITY,
  DB_TABLA_NO_RESTAURABLE: HttpStatus.UNPROCESSABLE_ENTITY,
  DB_TENANT_MISMATCH: HttpStatus.FORBIDDEN,
};

const CODIGO_DB = /DB_[A-Z_]+/;
const SQLSTATE_INMUTABLE = '45000';
const SQLSTATE_RLS = '42501';

@Catch(Prisma.PrismaClientKnownRequestError)
export class DatabaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    // Un HttpException normal no llega aquí (Nest lo maneja antes); si llega un
    // Error que no es de base, se responde 500 sin filtrar detalles.
    const info = this.info(error);
    if (!info) {
      this.logger.error(error instanceof Error ? error.stack : String(error));
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error interno',
      });
      return;
    }

    const { codigo, detalle } = info;
    const status = ESTADOS[codigo] ?? HttpStatus.CONFLICT;

    this.logger.warn(`${codigo}: ${detalle}`);
    response.status(status).json({
      statusCode: status,
      error: HttpStatus[status],
      codigo,
      message: detalle,
    });
  }

  /** Extrae el `DB_*` del error de Prisma, venga por `meta` o por `message`. */
  private info(error: unknown): { codigo: string; detalle: string } | null {
    if (!error || typeof error !== 'object') return null;

    const conMeta = error as {
      meta?: {
        code?: string;
        message?: string;
        driverAdapterError?: { cause?: { message?: string; detail?: string; code?: string } };
      };
      message?: string;
    };
    const cause = conMeta.meta?.driverAdapterError?.cause;

    if (cause?.code === SQLSTATE_RLS || conMeta.meta?.code === SQLSTATE_RLS) {
      return {
        codigo: 'DB_TENANT_MISMATCH',
        detalle: 'La fila pertenece a otra empresa.',
      };
    }

    const texto = [cause?.message, conMeta.meta?.message, conMeta.message]
      .filter((valor): valor is string => typeof valor === 'string')
      .join(' ');
    if (!texto) return null;

    const esTrigger = texto.includes(SQLSTATE_INMUTABLE) || Boolean(cause?.message);
    if (!esTrigger) return null;

    const codigo = CODIGO_DB.exec(texto)?.[0];
    if (!codigo) return null;

    return {
      codigo,
      detalle: cause?.detail ?? this.mensajePorCodigo(codigo),
    };
  }

  /** Mensaje humano cuando el trigger no manda `DETAIL`. */
  private mensajePorCodigo(codigo: string): string {
    switch (codigo) {
      case 'DB_REVERSION_SIN_TURNO':
        return 'No hay turno de caja abierto en la sucursal: ábrelo antes de anular.';
      case 'DB_COMPROBANTE_ANULADO':
        return 'El comprobante ya está anulado.';
      case 'DB_GASTO_PAGADO':
        return 'El gasto ya se pagó en caja y no se puede editar.';
      default:
        return 'La operación no está permitida por las reglas del negocio.';
    }
  }
}
