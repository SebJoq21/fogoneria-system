import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SequencesService } from './sequences.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { ConfigService } from '@nestjs/config';

function buildConfig(schema = 'fogoneria') {
  return { get: vi.fn().mockReturnValue(schema) } as unknown as ConfigService;
}

describe('SequencesService', () => {
  let queryRaw: ReturnType<typeof vi.fn>;
  let prisma: PrismaService;

  beforeEach(() => {
    queryRaw = vi.fn().mockResolvedValue([{ valor: 7n }]);
    prisma = { raw: { $queryRawUnsafe: queryRaw } } as unknown as PrismaService;
    vi.clearAllMocks();
  });

  function build(schema = 'fogoneria') {
    return new SequencesService(prisma, buildConfig(schema));
  }

  it('reserva el folio en autocommit sobre el pool de plataforma', async () => {
    const service = build();

    const valor = await service.next('e1', 'ORD');

    expect(valor).toBe(7);
    const [sql, empresaId, tipo] = queryRaw.mock.calls[0];
    expect(sql).toContain('INSERT INTO fogoneria.secuencias');
    expect(sql).toContain('ON CONFLICT (empresa_id, tipo)');
    expect(empresaId).toBe('e1');
    expect(tipo).toBe('ORD');
  });

  it('no abre transacción interactiva: el lock del contador no se retiene', async () => {
    const service = build();

    await service.next('e1', 'ORD');

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect((prisma.raw as unknown as { $transaction?: unknown }).$transaction).toBeUndefined();
  });

  it('formatea el folio de orden con 6 dígitos', async () => {
    const service = build();
    await expect(service.nextNumeroOrden('e1')).resolves.toBe('ORD-000007');
  });

  it('formatea el código de reserva con la fecha recibida', async () => {
    const service = build();
    const codigo = await service.nextCodigoReserva(
      'e1',
      new Date('2026-10-27T20:00:00-05:00'),
    );
    expect(codigo).toBe('RSV-20261027-0007');
  });

  it('rechaza un esquema con caracteres inseguros', () => {
    expect(() => build('x; DROP')).toThrow(/DATABASE_SCHEMA inválido/);
  });
});
