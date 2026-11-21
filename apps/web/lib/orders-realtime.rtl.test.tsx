// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const conexion = vi.hoisted(() => ({
  options: null as null | Record<string, (payload: never) => void>,
  stop: vi.fn(),
}));

vi.mock('./realtime', () => ({
  connectOrdersRealtime: (options: Record<string, (payload: never) => void>) => {
    conexion.options = options;
    return conexion.stop;
  },
}));

import { useOrdersRealtime } from './orders-realtime';

function Sonda({ enabled, onEvent }: { enabled: boolean; onEvent?: (kind: string) => void }) {
  const { status, lastEvent } = useOrdersRealtime(enabled, onEvent as never);
  return (
    <div>
      <span>status:{status}</span>
      <span>title:{lastEvent?.title ?? '-'}</span>
      <span>detail:{lastEvent?.detail ?? '-'}</span>
    </div>
  );
}

beforeEach(() => {
  conexion.options = null;
  conexion.stop.mockReset();
});

afterEach(cleanup);

describe('useOrdersRealtime', () => {
  it('queda offline y sin eventos cuando está deshabilitado', () => {
    render(<Sonda enabled={false} />);
    expect(screen.getByText('status:offline')).toBeTruthy();
    expect(conexion.options).toBeNull();
  });

  it('conecta, actualiza el estado y traduce los cuatro eventos', () => {
    const onEvent = vi.fn();
    const { rerender } = render(<Sonda enabled onEvent={onEvent} />);

    act(() => conexion.options?.onStatus?.('connected' as never));
    expect(screen.getByText('status:connected')).toBeTruthy();

    act(() =>
      conexion.options?.onOrderCreated?.({
        at: '2026-11-21T10:00:00.000Z',
        data: { ordenId: 'o-1', numeroOrden: 'ORD-1', origen: 'MESA', total: 24.5 },
      } as never),
    );
    expect(screen.getByText('title:Nueva comanda ORD-1')).toBeTruthy();
    expect(screen.getByText('detail:MESA · 24.50')).toBeTruthy();
    expect(onEvent).toHaveBeenLastCalledWith('order');

    act(() =>
      conexion.options?.onOrderUpdated?.({
        at: '2026-11-21T10:01:00.000Z',
        data: { ordenId: 'o-1', numeroOrden: 'ORD-1', de: 'EN_COCINA', a: 'LISTO' },
      } as never),
    );
    expect(screen.getByText('title:ORD-1: LISTO')).toBeTruthy();
    expect(onEvent).toHaveBeenLastCalledWith('order');

    act(() =>
      conexion.options?.onTableStatus?.({
        at: '2026-11-21T10:02:00.000Z',
        data: { mesaId: 'm-1', numero: null, de: null, a: 'LIBRE' },
      } as never),
    );
    expect(screen.getByText('title:Mesa')).toBeTruthy();
    expect(onEvent).toHaveBeenLastCalledWith('table');

    act(() =>
      conexion.options?.onOrderSla?.({
        at: '2026-11-21T10:03:00.000Z',
        data: { ordenId: 'o-1', numeroOrden: 'ORD-1', minutos: 21, slaMinutos: 20 },
      } as never),
    );
    expect(screen.getByText('title:ORD-1 fuera de SLA')).toBeTruthy();

    rerender(<Sonda enabled={false} />);
    expect(conexion.stop).toHaveBeenCalled();
    expect(screen.getByText('status:offline')).toBeTruthy();
    expect(screen.getByText('title:-')).toBeTruthy();
  });

  it('usa el callback más reciente sin reconectar', () => {
    const primero = vi.fn();
    const segundo = vi.fn();
    const { rerender } = render(<Sonda enabled onEvent={primero} />);
    rerender(<Sonda enabled onEvent={segundo} />);

    act(() =>
      conexion.options?.onOrderCreated?.({
        at: '2026-11-21T10:00:00.000Z',
        data: { ordenId: 'o-1', numeroOrden: 'ORD-1', origen: 'MESA', total: 1 },
      } as never),
    );
    expect(primero).not.toHaveBeenCalled();
    expect(segundo).toHaveBeenCalledWith('order');
  });
});
