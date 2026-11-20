import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from './api';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('llama al BFF con método, cuerpo y credenciales de la sesión', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/tenant')).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith('/api/backend/tenant', {
      method: 'GET',
      headers: {},
      body: undefined,
      signal: undefined,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  });

  it('serializa el body y agrega Content-Type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ id: 'x' }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/catalog/dishes', { method: 'POST', body: { nombre: 'Lomo' } });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/backend/catalog/dishes',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"nombre":"Lomo"}',
      }),
    );
  });

  it('devuelve undefined en un 204', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(apiFetch('/catalog/dishes/1', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('tolera respuestas sin cuerpo o con JSON roto', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 200 })));
    await expect(apiFetch('/x')).resolves.toBeNull();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('no-json', { status: 200 })),
    );
    await expect(apiFetch('/x')).resolves.toBeNull();
  });

  it('propaga el mensaje del servidor y el status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ message: 'RUC duplicado' }, 409)),
    );
    await expect(apiFetch('/onboarding', { method: 'POST', body: {} })).rejects.toMatchObject({
      name: 'ApiError',
      message: 'RUC duplicado',
      status: 409,
    });
  });

  it('une los mensajes de validación en un arreglo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ message: ['nombre requerido', 'ruc inválido'] }, 400)),
    );
    await expect(apiFetch('/x')).rejects.toThrow('nombre requerido. ruc inválido');
  });

  it('usa mensajes humanos cuando el cuerpo no trae uno', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({}, 401)));
    await expect(apiFetch('/x')).rejects.toThrow('Tu sesión expiró. Vuelve a iniciar sesión.');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({}, 500)));
    await expect(apiFetch('/x')).rejects.toThrow('Ocurrió un error inesperado. Inténtalo de nuevo.');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ message: '   ' }, 500)));
    await expect(apiFetch('/x')).rejects.toThrow('Ocurrió un error inesperado. Inténtalo de nuevo.');
  });

  it('envuelve un fallo de red en ApiError 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(apiFetch('/x')).rejects.toMatchObject({
      message: 'No se pudo conectar con el servidor. ¿Está corriendo la API?',
      status: 0,
    });
  });

  it('no disfraza una cancelación como fallo de conexión', async () => {
    const abort = new DOMException('abortado', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));
    await expect(apiFetch('/x')).rejects.toBe(abort);
  });

  it('ApiError conserva nombre y status', () => {
    const error = new ApiError('boom', 422);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
    expect(error.status).toBe(422);
  });
});
