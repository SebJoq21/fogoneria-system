import { vi } from 'vitest';

/** Prisma sin conexión real: suficiente para arrancar la app en e2e. */
export function createPrismaMock(): Record<string, unknown> {
  return {
    raw: {
      usuarios: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      empresas: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
      },
      $transaction: vi.fn(),
    },
    scoped: {},
    $disconnect: vi.fn(),
  };
}
