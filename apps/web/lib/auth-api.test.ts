import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loginRequest } from './auth-api';

const fetchMock = vi.fn();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const usuario = {
  id: 'u-1',
  nombre: 'Ana Beltrán',
  email: 'mesero@mirestaurante.com',
  rol: 'MESERO',
  empresaId: 'e-1',
  sucursalId: 's-1',
};

const tenant = {
  id: 'e-1',
  nombre: 'Mi Restaurante',
  estado: 'ACTIVE',
  plan: 'PROFESIONAL',
  trialFin: null,
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loginRequest', () => {
  it('normaliza el correo y devuelve usuario, tenant y token', async () => {
    fetchMock.mockResolvedValue(
      json({
        accessToken: 'jwt-123',
        tokenType: 'Bearer',
        expiresIn: '8h',
        user: usuario,
        tenant,
      }),
    );

    const result = await loginRequest('  MESERO@MiRestaurante.com ', 'Fogoneria123!');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/login$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          email: 'mesero@mirestaurante.com',
          password: 'Fogoneria123!',
        }),
        cache: 'no-store',
      }),
    );
    expect(result.accessToken).toBe('jwt-123');
    expect(result.user).toMatchObject({ role: 'mesero', branchId: 's-1', initials: 'AB' });
    expect(result.tenant).toEqual(tenant);
  });

  it('acepta una respuesta sin tenant (superadmin)', async () => {
    fetchMock.mockResolvedValue(
      json({
        accessToken: 'jwt',
        tokenType: 'Bearer',
        expiresIn: '8h',
        user: { ...usuario, rol: 'SUPERADMIN', empresaId: null, sucursalId: null },
        tenant: null,
      }),
    );
    const result = await loginRequest('super@fogoneria.com', 'x');
    expect(result.tenant).toBeNull();
    expect(result.user.role).toBe('superadmin');
    expect(result.user.branchId).toBeNull();
  });

  it('rechaza un rol desconocido o un operativo sin sucursal', async () => {
    fetchMock.mockResolvedValue(
      json({
        accessToken: 'jwt',
        tokenType: 'Bearer',
        expiresIn: '8h',
        user: { ...usuario, rol: 'ROBOT' },
        tenant,
      }),
    );
    await expect(loginRequest('a@b.com', 'x')).rejects.toMatchObject({
      status: 403,
      message: 'El usuario no tiene un rol o una sucursal válidos.',
    });

    fetchMock.mockResolvedValue(
      json({
        accessToken: 'jwt',
        tokenType: 'Bearer',
        expiresIn: '8h',
        user: { ...usuario, sucursalId: null },
        tenant,
      }),
    );
    await expect(loginRequest('a@b.com', 'x')).rejects.toMatchObject({ status: 403 });
  });

  it('traduce el 401 y los mensajes del DTO', async () => {
    fetchMock.mockResolvedValue(json({}, 401));
    await expect(loginRequest('a@b.com', 'x')).rejects.toThrow('Correo o contraseña incorrectos.');

    fetchMock.mockResolvedValue(json({ message: ['email inválido'] }, 400));
    await expect(loginRequest('a@b.com', 'x')).rejects.toThrow('email inválido');

    fetchMock.mockResolvedValue(json({}, 500));
    await expect(loginRequest('a@b.com', 'x')).rejects.toThrow(
      'No se pudo iniciar sesión. Inténtalo de nuevo.',
    );
  });

  it('tolera un cuerpo que no es JSON', async () => {
    fetchMock.mockResolvedValue(new Response('gateway caído', { status: 502 }));
    await expect(loginRequest('a@b.com', 'x')).rejects.toMatchObject({ status: 502 });
  });

  it('envuelve el fallo de red en ApiError 0', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(loginRequest('a@b.com', 'x')).rejects.toMatchObject({
      status: 0,
      message: 'No se pudo conectar con la API. Inténtalo de nuevo.',
    });
  });
});
