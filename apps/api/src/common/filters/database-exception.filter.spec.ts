import { HttpStatus } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { describe, expect, it, vi } from 'vitest';
import { DatabaseExceptionFilter } from './database-exception.filter.js';

function errorDb(codigo: string, detalle?: string) {
  return new Prisma.PrismaClientKnownRequestError('Database error', {
    code: 'P2039',
    clientVersion: '7.10.1',
    meta: {
      driverAdapterError: {
        cause: { code: '45000', message: codigo, detail: detalle },
      },
    },
  } as never);
}

function host() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { host: { switchToHttp: () => ({ getResponse: () => ({ status }) }) }, status, json };
}

describe('DatabaseExceptionFilter (AYCDS-46 p2)', () => {
  it('DB_REVERSION_SIN_TURNO responde 409 con el detalle del trigger', () => {
    const { host: h, status, json } = host();
    new DatabaseExceptionFilter().catch(
      errorDb('DB_REVERSION_SIN_TURNO', 'No hay turno de caja abierto en la sucursal'),
      h as never,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        codigo: 'DB_REVERSION_SIN_TURNO',
        message: 'No hay turno de caja abierto en la sucursal',
      }),
    );
  });

  it('los códigos 422 del doc se respetan', () => {
    const { host: h, status } = host();
    new DatabaseExceptionFilter().catch(errorDb('DB_ANULACION_INCOMPLETA'), h as never);

    expect(status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
  });

  it('DB_TENANT_MISMATCH responde 403', () => {
    const { host: h, status } = host();
    new DatabaseExceptionFilter().catch(errorDb('DB_TENANT_MISMATCH'), h as never);

    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
  });

  it('un error de Prisma sin código DB_* sigue siendo 500', () => {
    const { host: h, status, json } = host();
    new DatabaseExceptionFilter().catch(
      new Prisma.PrismaClientKnownRequestError('boom', {
        code: 'P2025',
        clientVersion: '7.10.1',
        meta: { modelName: 'x' },
      } as never),
      h as never,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: HttpStatus.INTERNAL_SERVER_ERROR }),
    );
  });
});
