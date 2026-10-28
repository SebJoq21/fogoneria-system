import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SequencesService } from './sequences.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { TenantContextService } from '../context/tenant-context.service.js';
import type { ConfigService } from '@nestjs/config';

function buildConfig(schema = 'fogoneria') {
  return { get: vi.fn().mockReturnValue(schema) } as unknown as ConfigService;
}

describe('SequencesService', () => {
  let queryRaw: ReturnType<typeof vi.fn>;
  let executeRaw: ReturnType<typeof vi.fn>;
  let tx: { $queryRawUnsafe: typeof queryRaw; $executeRawUnsafe: typeof executeRaw };
  let prisma: PrismaService;

  beforeEach(() => {
    queryRaw = vi.fn().mockResolvedValue([{ valor: 7n }]);
    executeRaw = vi.fn().mockResolvedValue(1);
    tx = { $queryRawUnsafe: queryRaw, $executeRawUnsafe: executeRaw };
    prisma = {
      rls: { $transaction: vi.fn((cb: (inner: typeof tx) => unknown) => cb(tx)) },
    } as unknown as PrismaService;
    vi.clearAllMocks();
  });

  function build(tenant: { tx?: typeof tx } | undefined) {
    const tenantContext = {
      get: vi.fn().mockReturnValue(tenant),
    } as unknown as TenantContextService;
    return new SequencesService(prisma, tenantContext, buildConfig());
  }

  it('reutiliza la transacción del request y califica el esquema', async () => {
    const service = build({ tx });

    const valor = await service.next('e1', 'ORD');

    expect(valor).toBe(7);
    expect(prisma.rls.$transaction).not.toHaveBeenCalled();
    const [sql, empresaId, tipo] = queryRaw.mock.calls[0];
    expect(sql).toContain('INSERT INTO fogoneria.secuencias');
    expect(sql).toContain('ON CONFLICT (empresa_id, tipo)');
    expect(empresaId).toBe('e1');
    expect(tipo).toBe('ORD');
  });

  it('sin request abre su propia transacción y fija app.empresa_id', async () => {
    const service = build(undefined);

    await service.next('e1', 'RSV');

    expect(prisma.rls.$transaction).toHaveBeenCalledTimes(1);
    expect(executeRaw).toHaveBeenCalledWith(
      expect.stringContaining('set_config'),
      'e1',
    );
  });

  it('formatea el folio de orden con 6 dígitos', async () => {
    const service = build({ tx });
    await expect(service.nextNumeroOrden('e1')).resolves.toBe('ORD-000007');
  });

  it('formatea el código de reserva con la fecha recibida', async () => {
    const service = build({ tx });
    const codigo = await service.nextCodigoReserva(
      'e1',
      new Date('2026-10-27T20:00:00-05:00'),
    );
    expect(codigo).toBe('RSV-20261027-0007');
  });

  it('rechaza un esquema con caracteres inseguros', () => {
    expect(
      () =>
        new SequencesService(prisma, {} as TenantContextService, buildConfig('x; DROP')),
    ).toThrow(/DATABASE_SCHEMA inválido/);
  });
});
