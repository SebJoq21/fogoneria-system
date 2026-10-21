import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isUUID } from 'class-validator';
import { describe, expect, it } from 'vitest';

/**
 * Los ids demo se usan en DTOs con `@IsUUID()`. Un id que no cumple RFC 4122
 * (versión 1-8 y variante 8/9/a/b) hace que la API devuelva 400 al filtrar
 * por la sucursal o la lista de precios del seed.
 */
const SEED = resolve(process.cwd(), 'prisma/seed.ts');
const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/** Id legacy que el guard del seed usa a propósito para detectar la BD vieja. */
const LEGACY_EMPRESA_ID = '11111111-1111-1111-1111-111111111111';

describe('ids del seed', () => {
  it('todos los UUID del seed cumplen RFC 4122', () => {
    const source = readFileSync(SEED, 'utf8');
    const ids = new Set(
      (source.match(UUID_RE) ?? []).filter(
        (id) => id.toLowerCase() !== LEGACY_EMPRESA_ID,
      ),
    );

    expect(ids.size).toBeGreaterThan(50);
    const invalid = [...ids].filter((id) => !isUUID(id));
    expect(invalid).toEqual([]);
  });
});
