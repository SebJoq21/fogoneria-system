import { describe, expect, it } from 'vitest';
import { applyBranchWrite } from './branch-scope';

type Item = { id: number | string; label: string };

const base: Record<string, Item[]> = {
  a: [{ id: 1, label: 'A1' }],
  b: [{ id: 2, label: 'B2' }],
};

describe('applyBranchWrite', () => {
  it('escribe solo la sucursal activa', () => {
    const next = applyBranchWrite(base, ['a', 'b'], 'a', (current) => [
      ...current,
      { id: 3, label: 'A3' },
    ]);
    expect(next.a).toHaveLength(2);
    expect(next.b).toEqual(base.b);
  });

  it('en la vista general aplica al combinado y reparte por id', () => {
    const next = applyBranchWrite(base, ['a', 'b'], 'todas', (current) =>
      current.map((item) => ({ ...item, label: `${item.label}!` })),
    );
    expect(next.a).toEqual([{ id: 1, label: 'A1!' }]);
    expect(next.b).toEqual([{ id: 2, label: 'B2!' }]);
  });

  it('los ítems nuevos van a la primera sucursal', () => {
    const next = applyBranchWrite(base, ['a', 'b'], 'todas', (current) => [
      ...current,
      { id: 9, label: 'Nuevo' },
    ]);
    expect(next.a.map((item) => item.id)).toEqual([1, 9]);
    expect(next.b.map((item) => item.id)).toEqual([2]);
  });

  it('acepta un valor directo', () => {
    const next = applyBranchWrite(base, ['a', 'b'], 'b', [{ id: 7, label: 'B7' }]);
    expect(next.b).toEqual([{ id: 7, label: 'B7' }]);
  });
});
