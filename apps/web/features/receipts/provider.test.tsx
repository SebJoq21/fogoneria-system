// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const port = vi.hoisted(() => ({
  setContingencia: vi.fn(),
  enviar: vi.fn().mockResolvedValue({ estado: 'aceptado', mensaje: 'ok' }),
  enviarBaja: vi.fn().mockResolvedValue({ estado: 'aceptado', mensaje: 'ok' }),
}));

vi.mock('@/components/dashboard/providers/session', () => ({
  useSession: () => ({ currentUser: null }),
}));
vi.mock('@/lib/facturacion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/facturacion')>();
  return { ...actual, getFacturacionPort: () => port };
});

import { ReceiptsProvider, useReceipts } from './provider';
import { initialReceipts, type Receipt } from '@/lib/erp';

const recibo: Receipt = {
  id: 'B001-77',
  type: '03',
  at: '2026-11-21T12:00:00.000Z',
  date: 'Hoy 12:00',
  customer: 'Ana',
  docType: '',
  docNumber: '',
  subtotal: 50,
  igv: 9,
  total: 59,
  status: 'Emitida',
  source: 'Mesa 1',
  estadoSunat: 'en_cola',
  intentosEnvio: 0,
};

function Probe() {
  const state = useReceipts();
  return (
    <div>
      <span data-testid="count">{state.receipts.length}</span>
      <span data-testid="contingencia">{String(state.sunatContingencia)}</span>
      <span data-testid="first">{state.receipts[0]?.id ?? '—'}</span>
      <button type="button" onClick={state.toggleSunatContingencia}>
        contingencia
      </button>
      <button type="button" onClick={() => state.addReceipt(recibo)}>
        agregar
      </button>
      <button type="button" onClick={() => state.enviarSunat(recibo)}>
        enviar
      </button>
      <button type="button" onClick={() => state.patchReceipt('B001-77', { status: 'Anulada', bajaResumenId: 'RC-pendiente' })}>
        anular
      </button>
      <button type="button" onClick={() => state.generarResumenDiario()}>
        resumen
      </button>
      <button type="button" onClick={state.resetReceipts}>
        reiniciar
      </button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  port.enviar.mockClear();
  port.enviarBaja.mockClear();
});
afterEach(cleanup);

describe('ReceiptsProvider', () => {
  it('hidrata el demo y persiste por tenant', async () => {
    render(
      <ReceiptsProvider>
        <Probe />
      </ReceiptsProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('count').textContent).toBe(String(initialReceipts.length)),
    );
    await waitFor(() =>
      expect(localStorage.getItem('fogoneria:receipts:v1:anon')).toContain('sunatContingencia'),
    );
  });

  it('alterna contingencia y la persiste', async () => {
    render(
      <ReceiptsProvider>
        <Probe />
      </ReceiptsProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('contingencia').textContent).toBe('false'));

    act(() => screen.getByText('contingencia').click());
    expect(screen.getByTestId('contingencia').textContent).toBe('true');
    expect(JSON.parse(localStorage.getItem('fogoneria:receipts:v1:anon') ?? '{}').sunatContingencia).toBe(true);
  });

  it('emite, envía a SUNAT y genera el resumen diario', async () => {
    render(
      <ReceiptsProvider>
        <Probe />
      </ReceiptsProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBeTruthy());

    act(() => screen.getByText('agregar').click());
    expect(screen.getByTestId('first').textContent).toBe('B001-77');

    act(() => screen.getByText('enviar').click());
    await waitFor(() => expect(port.enviar).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('fogoneria:receipts:v1:anon') ?? '{}').receipts[0].estadoSunat).toBe('aceptado'),
    );

    act(() => screen.getByText('anular').click());
    act(() => screen.getByText('resumen').click());
    await waitFor(() => expect(port.enviarBaja).toHaveBeenCalledTimes(1));
  });

  it('reinicia los comprobantes demo', async () => {
    render(
      <ReceiptsProvider>
        <Probe />
      </ReceiptsProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('count').textContent).toBe(String(initialReceipts.length)),
    );

    act(() => screen.getByText('agregar').click());
    act(() => screen.getByText('reiniciar').click());
    await waitFor(() =>
      expect(screen.getByTestId('count').textContent).toBe(String(initialReceipts.length)),
    );
  });
});
