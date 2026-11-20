import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSession, logoutUrl } from './session-api';

const fetchMock = vi.fn();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createSession', () => {
  it('crea la sesión en el BFF y devuelve el usuario', async () => {
    const user = { id: 'u-1', name: 'Ana', role: 'mesero' };
    fetchMock.mockResolvedValue(json({ user }));

    await expect(createSession('a@b.com', 'secreta')).resolves.toEqual({ user });

    expect(fetchMock).toHaveBeenCalledWith('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'secreta' }),
      credentials: 'same-origin',
      cache: 'no-store',
    });
  });

  it('usa el mensaje del BFF cuando rechaza', async () => {
    fetchMock.mockResolvedValue(json({ message: 'Credenciales inválidas' }, 401));
    await expect(createSession('a@b.com', 'x')).rejects.toMatchObject({
      status: 401,
      message: 'Credenciales inválidas',
    });
  });

  it('cae a un mensaje humano si el cuerpo no trae texto', async () => {
    fetchMock.mockResolvedValue(json({}, 500));
    await expect(createSession('a@b.com', 'x')).rejects.toThrow(
      'No se pudo iniciar sesión. Inténtalo de nuevo.',
    );
  });

  it('tolera un cuerpo que no es JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>', { status: 429 }));
    await expect(createSession('a@b.com', 'x')).rejects.toMatchObject({
      status: 429,
      message: 'No se pudo iniciar sesión. Inténtalo de nuevo.',
    });
  });

  it('envuelve el fallo de red en ApiError 0', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(createSession('a@b.com', 'x')).rejects.toMatchObject({
      status: 0,
      message: 'No se pudo conectar con el servidor.',
    });
  });
});

describe('logoutUrl', () => {
  it('apunta al endpoint que borra las cookies HttpOnly', () => {
    expect(logoutUrl()).toBe('/api/session/logout');
  });
});
