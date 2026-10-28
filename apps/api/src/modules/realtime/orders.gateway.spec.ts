import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrdersGateway } from './orders.gateway.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

const EMPRESA = '11111111-1111-4111-8111-111111111111';
const SUCURSAL = '22222222-2222-4222-8222-222222222222';
const ORDEN = '33333333-3333-4333-8333-333333333333';

type SocketMock = {
  id: string;
  handshake: { auth?: Record<string, unknown> };
  data: Record<string, unknown>;
  join: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

function buildSocket(auth: Record<string, unknown> = {}): SocketMock {
  return {
    id: 'sock-1',
    handshake: { auth },
    data: {},
    join: vi.fn().mockResolvedValue(undefined),
    emit: vi.fn(),
    disconnect: vi.fn(),
  };
}

function buildService() {
  const jwt = {
    verifyAsync: vi.fn().mockResolvedValue({
      sub: 'u1',
      empresaId: EMPRESA,
      sucursalId: SUCURSAL,
      rol: 'MESERO',
      scope: 'ws',
    }),
  };
  const config = { get: vi.fn(() => 'test-secret') };
  const prisma = {
    raw: {
      ordenes: { findFirst: vi.fn() },
    },
  };
  const gateway = new OrdersGateway(
    jwt as unknown as JwtService,
    config as unknown as ConfigService,
    prisma as unknown as PrismaService,
  );
  // `server` lo inyecta Nest al levantar la app; aquí lo simulamos.
  const emit = vi.fn();
  const to = vi.fn(() => ({ emit }));
  gateway.server = { to } as never;
  return { gateway, jwt, prisma, to, emit };
}

/** El gateway tipa el socket como `Socket` de socket.io; en el test es un mock. */
function asSocket(mock: SocketMock) {
  return mock as never;
}

describe('OrdersGateway (AYCDS-14)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mete al operativo en el room de su sucursal', async () => {
    const { gateway } = buildService();
    const socket = buildSocket({ ticket: 'ticket-valido' });

    await gateway.handleConnection(asSocket(socket));

    expect(socket.join).toHaveBeenCalledWith([
      `empresa:${EMPRESA}:sucursal:${SUCURSAL}`,
    ]);
    expect(socket.data.auth).toMatchObject({
      empresaId: EMPRESA,
      sucursalId: SUCURSAL,
      userId: 'u1',
    });
  });

  it('mete al ADMIN_GLOBAL (sin sucursal) en el room de la empresa', async () => {
    const { gateway, jwt } = buildService();
    jwt.verifyAsync.mockResolvedValue({
      sub: 'u9',
      empresaId: EMPRESA,
      sucursalId: null,
      rol: 'ADMIN_GLOBAL',
      scope: 'ws',
    });
    const socket = buildSocket({ ticket: 'ticket-valido' });

    await gateway.handleConnection(asSocket(socket));

    expect(socket.join).toHaveBeenCalledWith([`empresa:${EMPRESA}`]);
  });

  it('rechaza la conexión sin ticket', async () => {
    const { gateway } = buildService();
    const socket = buildSocket({});

    await gateway.handleConnection(asSocket(socket));

    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('auth.error', {
      message: 'Falta el ticket de WebSocket',
    });
    await vi.waitFor(() => expect(socket.disconnect).toHaveBeenCalledWith(true));
  });

  it('da un margen antes de desconectar para que llegue el motivo', async () => {
    const { gateway } = buildService();
    const socket = buildSocket({});

    await gateway.handleConnection(asSocket(socket));

    // El emit sale primero y el disconnect va 100 ms después.
    expect(socket.disconnect).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('rechaza un ticket que no es de WebSockets (access token HTTP)', async () => {
    const { gateway, jwt } = buildService();
    jwt.verifyAsync.mockResolvedValue({
      sub: 'u1',
      empresaId: EMPRESA,
      sucursalId: SUCURSAL,
      rol: 'MESERO',
    });
    const socket = buildSocket({ ticket: 'access-token' });

    await gateway.handleConnection(asSocket(socket));

    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('auth.error', {
      message: 'El ticket no sirve para WebSockets',
    });
  });

  it('rechaza un ticket vencido o ilegible', async () => {
    const { gateway, jwt } = buildService();
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const socket = buildSocket({ ticket: 'viejo' });

    await gateway.handleConnection(asSocket(socket));

    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('auth.error', {
      message: 'El ticket expiró o no es válido',
    });
  });

  it('rechaza un ticket sin empresa', async () => {
    const { gateway, jwt } = buildService();
    jwt.verifyAsync.mockResolvedValue({
      sub: 'u1',
      empresaId: null,
      sucursalId: null,
      rol: 'SUPERADMIN',
      scope: 'ws',
    });
    const socket = buildSocket({ ticket: 'ticket-valido' });

    await gateway.handleConnection(asSocket(socket));

    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('auth.error', {
      message: 'El ticket no tiene empresa',
    });
  });

  describe('order:subscribe', () => {
    function authed() {
      const socket = buildSocket({ ticket: 'ticket-valido' });
      socket.data.auth = {
        empresaId: EMPRESA,
        sucursalId: SUCURSAL,
        rol: 'MESERO',
        userId: 'u1',
      };
      return socket;
    }

    it('une al cliente al room de la comanda de su sucursal', async () => {
      const { gateway, prisma } = buildService();
      prisma.raw.ordenes.findFirst.mockResolvedValue({
        id: ORDEN,
        sucursal_id: SUCURSAL,
      });
      const socket = authed();

      const result = await gateway.subscribeToOrder(asSocket(socket), {
        ordenId: ORDEN,
      });

      expect(result).toEqual({ ordenId: ORDEN });
      expect(socket.join).toHaveBeenCalledWith(`order:${ORDEN}`);
    });

    it('no une a una comanda de otra empresa', async () => {
      const { gateway, prisma } = buildService();
      prisma.raw.ordenes.findFirst.mockResolvedValue(null);
      const socket = authed();

      const result = await gateway.subscribeToOrder(asSocket(socket), {
        ordenId: ORDEN,
      });

      expect(result).toEqual({ error: 'Orden no encontrada' });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('no une a una comanda de otra sucursal', async () => {
      const { gateway, prisma } = buildService();
      prisma.raw.ordenes.findFirst.mockResolvedValue({
        id: ORDEN,
        sucursal_id: 'otra-sucursal',
      });
      const socket = authed();

      const result = await gateway.subscribeToOrder(asSocket(socket), {
        ordenId: ORDEN,
      });

      expect(result).toEqual({ error: 'Orden de otra sucursal' });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('rechaza un ordenId que no es UUID', async () => {
      const { gateway, prisma } = buildService();
      const socket = authed();

      const result = await gateway.subscribeToOrder(asSocket(socket), {
        ordenId: 'no-es-uuid',
      });

      expect(result).toEqual({ error: 'ordenId inválido' });
      expect(prisma.raw.ordenes.findFirst).not.toHaveBeenCalled();
    });

    it('rechaza a un socket sin autenticar', async () => {
      const { gateway } = buildService();
      const socket = buildSocket({});

      const result = await gateway.subscribeToOrder(asSocket(socket), {
        ordenId: ORDEN,
      });

      expect(result).toEqual({ error: 'No autenticado' });
    });
  });

  describe('emisión', () => {
    it('emite order.created con sobre envelope al room de la sucursal', () => {
      const { gateway, to, emit } = buildService();

      gateway.emitOrderCreated(EMPRESA, {
        ordenId: ORDEN,
        numeroOrden: 'ORD-000001',
        estado: 'POR_CONFIRMAR',
        origen: 'MESA',
        sucursalId: SUCURSAL,
        mesaId: null,
        total: 36,
        creadaAt: '2026-10-28T00:00:00.000Z',
      });

      expect(to).toHaveBeenCalledWith([
        `empresa:${EMPRESA}`,
        `empresa:${EMPRESA}:sucursal:${SUCURSAL}`,
      ]);
      expect(emit).toHaveBeenCalledWith(
        'order.created',
        expect.objectContaining({
          eventId: expect.any(String),
          at: expect.any(String),
          data: expect.objectContaining({ numeroOrden: 'ORD-000001' }),
        }),
      );
    });

    it('incluye el room de la comanda al cambiar de estado', () => {
      const { gateway, to } = buildService();

      gateway.emitOrderUpdated(EMPRESA, {
        ordenId: ORDEN,
        numeroOrden: 'ORD-000001',
        de: 'EN_COCINA',
        a: 'LISTO',
        sucursalId: SUCURSAL,
        mesaId: null,
      });

      expect(to).toHaveBeenCalledWith([
        `empresa:${EMPRESA}`,
        `empresa:${EMPRESA}:sucursal:${SUCURSAL}`,
        `order:${ORDEN}`,
      ]);
    });

    it('no falla si el servidor de Socket.io no está montado', () => {
      const { gateway } = buildService();
      gateway.server = undefined as never;

      expect(() =>
        gateway.emitTableStatus(EMPRESA, {
          mesaId: 'm1',
          numero: 'Mesa 1',
          de: 'OCUPADA',
          a: 'LIBRE',
          sucursalId: SUCURSAL,
        }),
      ).not.toThrow();
    });
  });
});
