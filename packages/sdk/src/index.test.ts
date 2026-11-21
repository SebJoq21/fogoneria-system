import { describe, expect, it, vi } from 'vitest';
import { ApiError, createClient, queryString } from './index';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('queryString', () => {
  it('omite vacíos y serializa el resto', () => {
    expect(queryString({ a: 1, b: 'x', c: true })).toBe('?a=1&b=x&c=true');
    expect(queryString({ a: undefined, b: null, c: '' })).toBe('');
    expect(queryString()).toBe('');
  });
});

describe('createClient', () => {
  it('hace GET con credenciales, headers y base sin barra final', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ ok: true }));
    const client = createClient({ baseUrl: '/api/backend/', fetchImpl, headers: { 'X-Test': '1' } });

    await expect(client.get('/x')).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith('/api/backend/x', {
      credentials: 'include',
      method: 'GET',
      signal: undefined,
      headers: { 'Content-Type': 'application/json', 'X-Test': '1' },
    });
  });

  it('serializa el body en POST/PATCH/PUT y usa DELETE sin body', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => json({}));
    const client = createClient({ baseUrl: '/bff', fetchImpl });

    await client.post('/a', { x: 1 });
    await client.patch('/a', undefined);
    await client.put('/a', { y: 2 });
    await client.delete('/a');

    expect(JSON.parse(fetchImpl.mock.calls[0]![1]!.body as string)).toEqual({ x: 1 });
    expect(JSON.parse(fetchImpl.mock.calls[1]![1]!.body as string)).toEqual({});
    expect(JSON.parse(fetchImpl.mock.calls[2]![1]!.body as string)).toEqual({ y: 2 });
    expect(fetchImpl.mock.calls[3]![1]!.method).toBe('DELETE');
    expect(fetchImpl.mock.calls[3]![1]!.body).toBeUndefined();
  });

  it('permite inyectar signal y headers por request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({}));
    const client = createClient({ baseUrl: '/bff', fetchImpl });
    const controller = new AbortController();

    await client.get('/x', { signal: controller.signal, headers: { 'X-R': '1' } });
    expect(fetchImpl.mock.calls[0]![1]!.signal).toBe(controller.signal);
    expect(fetchImpl.mock.calls[0]![1]!.headers).toMatchObject({ 'X-R': '1' });
  });

  it('devuelve null con 204 o cuerpo vacío', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(new Response('no-json', { status: 200 }));
    const client = createClient({ baseUrl: '/bff', fetchImpl });

    await expect(client.get('/x')).resolves.toBeNull();
    await expect(client.get('/x')).resolves.toBeNull();
    await expect(client.get('/x')).resolves.toBeNull();
  });

  it('lanza ApiError con mensaje, status y código', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ message: 'RUC duplicado', codigo: 'DB_X' }, 409));
    const client = createClient({ baseUrl: '/bff', fetchImpl });

    await expect(client.post('/x', {})).rejects.toMatchObject({
      name: 'ApiError',
      message: 'RUC duplicado',
      status: 409,
      code: 'DB_X',
    });
  });

  it('junta mensajes de validación y cae a Error <status>', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ message: ['a', 'b'] }, 400))
      .mockResolvedValueOnce(json({}, 500));
    const client = createClient({ baseUrl: '/bff', fetchImpl });

    await expect(client.get('/x')).rejects.toThrow('a, b');
    await expect(client.get('/x')).rejects.toThrow('Error 500');
  });

  it('ApiError conserva status y code opcional', () => {
    const error = new ApiError('boom', 422, 'DB_X');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
    expect(error.status).toBe(422);
    expect(error.code).toBe('DB_X');
  });
});
