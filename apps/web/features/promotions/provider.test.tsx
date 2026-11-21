// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sesion = vi.hoisted(() => ({
  currentUser: null as null | { empresaId: string },
}));

vi.mock('@/components/dashboard/providers/session', () => ({
  useSession: () => sesion,
}));

import { PromotionsProvider, usePromotions } from './provider';
import { initialCoupons } from '@/lib/erp';
import { initialCombos } from '@/lib/erp-catalog';

type Posted = { type: 'state' | 'reset'; source: string; value: unknown };

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];
  readonly name: string;
  onmessage: ((event: MessageEvent<Posted>) => void) | null = null;
  readonly posted: Posted[] = [];

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.instances.push(this);
  }

  postMessage(data: Posted): void {
    this.posted.push(data);
  }

  close(): void {}
}

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

beforeEach(() => {
  localStorage.clear();
  sesion.currentUser = null;
  FakeBroadcastChannel.instances = [];
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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

  it('sincroniza con otra pestaña sin reemitir el eco', async () => {
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    render(
      <PromotionsProvider>
        <Probe />
      </PromotionsProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('combos').textContent).toBe(String(initialCombos.length)),
    );

    const channel = FakeBroadcastChannel.instances.find(
      (item) => item.name === 'fogoneria:promotions-sync:anon' && item.onmessage !== null,
    );
    expect(channel).toBeTruthy();
    const postedBefore = FakeBroadcastChannel.instances.reduce(
      (total, item) => total + item.posted.length,
      0,
    );

    act(() => {
      channel!.onmessage?.({
        data: {
          type: 'state',
          source: 'otra-pestana',
          value: {
            combos: [],
            coupons: [{ code: 'REMOTO', discount: '5% OFF', used: 2, limit: 5, expires: '' }],
          },
        },
      } as MessageEvent<Posted>);
    });

    await waitFor(() => expect(screen.getByTestId('combos').textContent).toBe('0'));
    expect(screen.getByTestId('used').textContent).toBe('2');
    const postedAfter = FakeBroadcastChannel.instances.reduce(
      (total, item) => total + item.posted.length,
      0,
    );
    expect(postedAfter).toBe(postedBefore);
  });

  it('no escribe las promociones del tenant anterior en la clave nueva', async () => {
    const { rerender } = render(
      <PromotionsProvider>
        <Probe />
      </PromotionsProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('combos').textContent).toBe(String(initialCombos.length)),
    );

    sesion.currentUser = { empresaId: 'emp-2' };
    rerender(
      <PromotionsProvider>
        <Probe />
      </PromotionsProvider>,
    );

    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('fogoneria:promotions:v1:emp-2') ?? 'null')).toEqual({
        combos: [],
        coupons: [],
      }),
    );
    expect(localStorage.getItem('fogoneria:promotions:v1:anon')).toContain(initialCoupons[0]!.code);
  });
});
