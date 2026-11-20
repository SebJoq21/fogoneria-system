import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class FakeSocket {
  handlers = new Map<string, ((payload?: unknown) => void)[]>();
  closed = false;

  on(event: string, cb: (payload?: unknown) => void) {
    const list = this.handlers.get(event) ?? [];
    list.push(cb);
    this.handlers.set(event, list);
    return this;
  }

  removeAllListeners() {
    this.handlers.clear();
    return this;
  }

  close() {
    this.closed = true;
  }

  trigger(event: string, payload?: unknown) {
    for (const cb of this.handlers.get(event) ?? []) cb(payload);
  }
}

const ioMock = vi.hoisted(() => ({ io: vi.fn() }));

vi.mock('socket.io-client', () => ({ io: ioMock.io }));

import {
  RealtimeAuthError,
  connectOrdersRealtime,
  realtimeBaseUrl,
} from './realtime';

const sockets: FakeSocket[] = [];
const fetchMock = vi.fn();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function ultimoSocket(): FakeSocket {
  return sockets.at(-1)!;
}

beforeEach(() => {
  vi.useFakeTimers();
  sockets.length = 0;
  fetchMock.mockReset();
  ioMock.io.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  ioMock.io.mockImplementation(() => {
    const socket = new FakeSocket();
    sockets.push(socket);
    return socket;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('connectOrdersRealtime', () => {
  it('pide el ticket, abre el namespace y avisa connected', async () => {
    fetchMock.mockResolvedValue(json({ ticket: 'ws-123' }));
    const status = vi.fn();

    const stop = connectOrdersRealtime({ onStatus: status });
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock).toHaveBeenCalledWith('/api/session/ws-ticket', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    expect(ioMock.io).toHaveBeenCalledWith('http://localhost:3001/orders', {
      auth: { ticket: 'ws-123' },
      transports: ['websocket', 'polling'],
      reconnection: false,
      timeout: 10_000,
    });
    expect(status).toHaveBeenCalledWith('connecting');

    ultimoSocket().trigger('connect');
    expect(status).toHaveBeenLastCalledWith('connected');
    stop();
  });

  it('entrega cada evento una sola vez y usa el callback adecuado', async () => {
    fetchMock.mockResolvedValue(json({ ticket: 'ws' }));
    const onOrderCreated = vi.fn();
    const onOrderUpdated = vi.fn();
    const onOrderSla = vi.fn();
    const onTableStatus = vi.fn();

    const stop = connectOrdersRealtime({
      onOrderCreated,
      onOrderUpdated,
      onOrderSla,
      onTableStatus,
    });
    await vi.advanceTimersByTimeAsync(0);
    const socket = ultimoSocket();

    const creada = { eventId: 'e-1', at: '2026-11-20T12:00:00.000Z', data: { ordenId: 'o-1' } };
    socket.trigger('order.created', creada);
    socket.trigger('order.created', creada);
    expect(onOrderCreated).toHaveBeenCalledTimes(1);

    socket.trigger('order.updated', { ...creada, eventId: 'e-2' });
    socket.trigger('order.sla', { ...creada, eventId: 'e-3' });
    socket.trigger('table.status', { ...creada, eventId: 'e-4' });
    expect(onOrderUpdated).toHaveBeenCalledTimes(1);
    expect(onOrderSla).toHaveBeenCalledTimes(1);
    expect(onTableStatus).toHaveBeenCalledTimes(1);

    stop();
  });

  it('sin callbacks no falla al recibir eventos', async () => {
    fetchMock.mockResolvedValue(json({ ticket: 'ws' }));
    const stop = connectOrdersRealtime();
    await vi.advanceTimersByTimeAsync(0);
    expect(() =>
      ultimoSocket().trigger('order.created', { eventId: 'x', at: '', data: {} }),
    ).not.toThrow();
    stop();
  });

  it('sin sesión (401) queda offline y no reintenta', async () => {
    fetchMock.mockResolvedValue(json({}, 401));
    const status = vi.fn();

    const stop = connectOrdersRealtime({ onStatus: status });
    await vi.advanceTimersByTimeAsync(0);

    expect(status).toHaveBeenLastCalledWith('offline');
    expect(ioMock.io).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    stop();
  });

  it('un error del BFF reintenta con backoff', async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 500))
      .mockResolvedValueOnce(json({ ticket: 'ws-2' }));
    const status = vi.fn();

    const stop = connectOrdersRealtime({ onStatus: status });
    await vi.advanceTimersByTimeAsync(0);
    expect(status).toHaveBeenCalledWith('offline');

    await vi.advanceTimersByTimeAsync(1200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(ioMock.io).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith('reconnecting');
    stop();
  });

  it('una respuesta sin ticket también reintenta', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ ticket: '' }))
      .mockResolvedValueOnce(json({ ticket: 'ws' }));

    const stop = connectOrdersRealtime();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    stop();
  });

  it('connect_error cierra el socket y reintenta', async () => {
    fetchMock.mockImplementation(async () => json({ ticket: 'ws' }));
    const status = vi.fn();
    const stop = connectOrdersRealtime({ onStatus: status });
    await vi.advanceTimersByTimeAsync(0);

    const socket = ultimoSocket();
    socket.trigger('connect_error');
    expect(socket.closed).toBe(true);
    expect(status).toHaveBeenCalledWith('offline');

    await vi.advanceTimersByTimeAsync(1200);
    expect(sockets.length).toBe(2);
    stop();
  });

  it('auth.error apaga el canal sin reintentar', async () => {
    fetchMock.mockResolvedValue(json({ ticket: 'ws' }));
    const status = vi.fn();
    const stop = connectOrdersRealtime({ onStatus: status });
    await vi.advanceTimersByTimeAsync(0);

    const socket = ultimoSocket();
    socket.trigger('auth.error');
    expect(socket.closed).toBe(true);
    expect(status).toHaveBeenLastCalledWith('offline');

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    stop();
  });

  it('disconnect del servidor programa reconexión; el cierre propio no', async () => {
    fetchMock.mockImplementation(async () => json({ ticket: 'ws' }));
    const status = vi.fn();
    const stop = connectOrdersRealtime({ onStatus: status });
    await vi.advanceTimersByTimeAsync(0);

    ultimoSocket().trigger('disconnect', 'transporte caído');
    expect(status).toHaveBeenLastCalledWith('reconnecting');
    await vi.advanceTimersByTimeAsync(1200);
    expect(sockets.length).toBe(2);

    sockets[1].trigger('disconnect', 'io client disconnect');
    const llamadas = fetchMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock.mock.calls.length).toBe(llamadas);
    stop();
  });

  it('dispose cancela el timer, cierra el socket y deja offline', async () => {
    fetchMock.mockResolvedValue(json({ ticket: 'ws' }));
    const status = vi.fn();
    const stop = connectOrdersRealtime({ onStatus: status });
    await vi.advanceTimersByTimeAsync(0);

    stop();
    expect(ultimoSocket().closed).toBe(true);
    expect(status).toHaveBeenLastCalledWith('offline');

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('un dispose durante la espera del ticket no abre el socket', async () => {
    let resolver: (value: Response) => void = () => {};
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => {
        resolver = resolve;
      }),
    );

    const stop = connectOrdersRealtime();
    stop();
    resolver(json({ ticket: 'ws' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(ioMock.io).not.toHaveBeenCalled();
  });
});

describe('realtimeBaseUrl en el navegador', () => {
  it('mapea el host interno api al hostname del navegador', () => {
    vi.stubGlobal('window', { location: { hostname: 'localhost' } });
    expect(realtimeBaseUrl('http://api:3001/api/v1')).toBe('http://localhost:3001');
  });

  it('devuelve la URL sin prefijo cuando no es parseable', () => {
    vi.stubGlobal('window', { location: { hostname: 'localhost' } });
    expect(realtimeBaseUrl('no-es-url')).toBe('no-es-url');
  });

  it('usa NEXT_PUBLIC_API_URL por defecto', () => {
    expect(realtimeBaseUrl()).toMatch(/^http:\/\/localhost:3001$/);
  });

  it('RealtimeAuthError es un Error con nombre propio', () => {
    const error = new RealtimeAuthError('sin sesión');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('Error');
  });
});
