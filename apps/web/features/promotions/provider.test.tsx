// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/dashboard/providers/session', () => ({
  useSession: () => ({ currentUser: null }),
}));

import { PromotionsProvider, usePromotions } from './provider';
import { initialCoupons } from '@/lib/erp';
import { initialCombos } from '@/lib/erp-catalog';

function Probe() {
  const state = usePromotions();
  return (
    <div>
      <span data-testid="combos">{state.combos.length}</span>
      <span data-testid="coupons">{state.coupons.length}</span>
      <span data-testid="used">{state.coupons[0]?.used ?? '—'}</span>
      <button type="button" onClick={() => state.consumeCoupon(initialCoupons[0]!.code)}>
        consumir
      </button>
      <button type="button" onClick={() => state.restoreCoupon(initialCoupons[0]!.code)}>
        restaurar
      </button>
      <button type="button" onClick={() => state.setCombos([])}>
        vaciar combos
      </button>
      <button type="button" onClick={state.resetPromotions}>
        reiniciar
      </button>
    </div>
  );
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('PromotionsProvider', () => {
  it('hidrata combos y cupones demo y persiste por tenant', async () => {
    render(
      <PromotionsProvider>
        <Probe />
      </PromotionsProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('combos').textContent).toBe(String(initialCombos.length)),
    );
    expect(screen.getByTestId('coupons').textContent).toBe(String(initialCoupons.length));
    await waitFor(() =>
      expect(localStorage.getItem('fogoneria:promotions:v1:anon')).toContain(initialCoupons[0]!.code),
    );
  });

  it('consume y restaura un cupón (compensación) sin bajar de cero', async () => {
    render(
      <PromotionsProvider>
        <Probe />
      </PromotionsProvider>,
    );
    const usados = initialCoupons[0]!.used;
    await waitFor(() => expect(screen.getByTestId('used').textContent).toBe(String(usados)));

    act(() => screen.getByText('consumir').click());
    expect(screen.getByTestId('used').textContent).toBe(String(usados + 1));
    act(() => screen.getByText('restaurar').click());
    expect(screen.getByTestId('used').textContent).toBe(String(usados));
  });

  it('vacía combos y reinicia al demo', async () => {
    render(
      <PromotionsProvider>
        <Probe />
      </PromotionsProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('combos').textContent).toBe(String(initialCombos.length)),
    );

    act(() => screen.getByText('vaciar combos').click());
    expect(screen.getByTestId('combos').textContent).toBe('0');

    act(() => screen.getByText('reiniciar').click());
    await waitFor(() =>
      expect(screen.getByTestId('combos').textContent).toBe(String(initialCombos.length)),
    );
  });
});
