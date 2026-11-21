// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sesion = vi.hoisted(() => ({
  currentUser: null as null | { empresaId: string },
}));

vi.mock('@/components/dashboard/providers/session', () => ({
  useSession: () => sesion,
}));

import { CashProvider, useCash } from './provider';
import { initialCashMovementsByBranch, initialCashShifts } from '@/lib/tenancy';

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
  const cash = useCash();
  const shift = cash.activeShift('miraflores');
  return (
    <div>
      <span data-testid="shifts">{cash.cashShifts.length}</span>
      <span data-testid="movements">{cash.movementsOf('miraflores').length}</span>
      <span data-testid="active">{shift?.id ?? '—'}</span>
      <button type="button" onClick={() => cash.closeShift({ branchId: 'miraflores', countedCash: 200, observations: 'Cuadra', closedBy: 'Rosa' })}>
        cerrar
      </button>
      <button type="button" onClick={() => cash.startShift({ branchId: 'miraflores', fund: 100, openedBy: 'Rosa' })}>
        abrir
      </button>
      <button type="button" onClick={() => cash.addMovements('miraflores', [{ id: 99, at: '2026-11-21T12:00:00.000Z', datetime: 'Hoy 12:00', concept: 'Venta', kind: 'Ingreso', amount: 10, method: 'Efectivo' }])}>
        sumar
      </button>
      <button type="button" onClick={() => cash.remapBranches({ miraflores: 'uuid-miraflores' })}>
        remapear
      </button>
      <button type="button" onClick={cash.resetCash}>
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

describe('CashProvider', () => {
  it('hidrata turnos y movimientos demo, y persiste por tenant', async () => {
    render(
      <CashProvider>
        <Probe />
      </CashProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('shifts').textContent).toBe(String(initialCashShifts.length)),
    );
    expect(screen.getByTestId('movements').textContent).toBe(
      String(initialCashMovementsByBranch.miraflores.length),
    );
    await waitFor(() =>
      expect(localStorage.getItem('fogoneria:cash:v1:anon')).toContain('CH-miraflores-hoy'),
    );
  });

  it('cierra el turno con arqueo y abre uno nuevo con su fondo', async () => {
    render(
      <CashProvider>
        <Probe />
      </CashProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('active').textContent).toBe('CH-miraflores-hoy'));

    act(() => screen.getByText('cerrar').click());
    expect(screen.getByTestId('active').textContent).toBe('—');

    act(() => screen.getByText('abrir').click());
    expect(screen.getByTestId('active').textContent).not.toBe('—');
    expect(screen.getByTestId('movements').textContent).toBe(
      String(initialCashMovementsByBranch.miraflores.length + 1),
    );
  });

  it('remapea sucursales de turnos y movimientos de forma idempotente', async () => {
    render(
      <CashProvider>
        <Probe />
      </CashProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('shifts').textContent).toBeTruthy());

    act(() => screen.getByText('remapear').click());
    const guardado = JSON.parse(localStorage.getItem('fogoneria:cash:v1:anon') ?? '{}');
    expect(guardado.shifts[0].branchId).toBe('uuid-miraflores');
    expect(guardado.movementsByBranch['uuid-miraflores']).toHaveLength(
      initialCashMovementsByBranch.miraflores.length,
    );
    expect(guardado.movementsByBranch.miraflores).toBeUndefined();

    act(() => screen.getByText('remapear').click());
    const otraVez = JSON.parse(localStorage.getItem('fogoneria:cash:v1:anon') ?? '{}');
    expect(otraVez.shifts).toHaveLength(initialCashShifts.length);
    expect(otraVez.movementsByBranch['uuid-miraflores']).toHaveLength(
      initialCashMovementsByBranch.miraflores.length,
    );
  });

  it('reinicia la caja demo', async () => {
    render(
      <CashProvider>
        <Probe />
      </CashProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('active').textContent).toBe('CH-miraflores-hoy'));

    act(() => screen.getByText('sumar').click());
    act(() => screen.getByText('reiniciar').click());
    await waitFor(() =>
      expect(screen.getByTestId('movements').textContent).toBe(
        String(initialCashMovementsByBranch.miraflores.length),
      ),
    );
  });

  it('sincroniza con otra pestaña sin reemitir el eco', async () => {
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    render(
      <CashProvider>
        <Probe />
      </CashProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('shifts').textContent).toBeTruthy());

    const channel = FakeBroadcastChannel.instances.find(
      (item) => item.name === 'fogoneria:cash-sync:anon' && item.onmessage !== null,
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
          value: { shifts: [], movementsByBranch: { 'b-9': [{ id: 7 }] } },
        },
      } as MessageEvent<Posted>);
    });

    await waitFor(() => expect(screen.getByTestId('shifts').textContent).toBe('0'));
    const postedAfter = FakeBroadcastChannel.instances.reduce(
      (total, item) => total + item.posted.length,
      0,
    );
    expect(postedAfter).toBe(postedBefore);
  });

  it('no escribe la caja del tenant anterior en la clave nueva', async () => {
    const { rerender } = render(
      <CashProvider>
        <Probe />
      </CashProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('shifts').textContent).toBeTruthy());

    sesion.currentUser = { empresaId: 'emp-2' };
    rerender(
      <CashProvider>
        <Probe />
      </CashProvider>,
    );

    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('fogoneria:cash:v1:emp-2') ?? 'null')).toEqual({
        shifts: [],
        movementsByBranch: {},
      }),
    );
    expect(localStorage.getItem('fogoneria:cash:v1:anon')).toContain('CH-miraflores-hoy');
  });
});
