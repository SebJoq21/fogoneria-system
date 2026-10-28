import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { OrdersGateway } from './../src/modules/realtime/orders.gateway.js';
import { configureApp } from './../src/bootstrap.js';
import { createPrismaMock } from './prisma-mock.js';

const EMPRESA_A = '11111111-1111-4111-8111-111111111111';
const SUCURSAL_A = '22222222-2222-4222-8222-222222222222';
const EMPRESA_B = '44444444-4444-4444-8444-444444444444';
const SUCURSAL_B = '55555555-5555-4555-8555-555555555555';

type Received = { event: string; payload: Record<string, unknown> };

describe('Gateway de comandas (e2e, AYCDS-14)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let gateway: OrdersGateway;
  let baseUrl: string;
  const sockets: Socket[] = [];

  async function ticket(empresaId: string | null, sucursalId: string | null) {
    return jwt.signAsync(
      {
        sub: 'u-1',
        empresaId,
        sucursalId,
        rol: sucursalId ? 'MESERO' : 'ADMIN_GLOBAL',
        scope: 'ws',
      },
      { expiresIn: 60 },
    );
  }

  /** Conecta y acumula los eventos que el gateway emita. */
  async function connect(auth: Record<string, unknown>): Promise<{
    socket: Socket;
    received: Received[];
    authError?: string;
    waitFor: (event: string) => Promise<Received>;
    closed: Promise<void>;
  }> {
    const socket = io(`${baseUrl}/orders`, {
      auth,
      transports: ['websocket'],
      reconnection: false,
      timeout: 5000,
    });
    sockets.push(socket);

    const received: Received[] = [];
    const onAny = (event: string, payload: Record<string, unknown>) => {
      received.push({ event, payload });
    };
    socket.onAny(onAny);

    const closed = new Promise<void>((resolve) => socket.on('disconnect', () => resolve()));
    let authError: string | undefined;
    socket.on('auth.error', (payload: { message?: string }) => {
      authError = payload.message;
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout conectando')), 5000);
      socket.on('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.on('connect_error', (error: Error) => {
        clearTimeout(timer);
        reject(error);
      });
    });

    const waitFor = (event: string) =>
      new Promise<Received>((resolve, reject) => {
        const found = received.find((item) => item.event === event);
        if (found) {
          resolve(found);
          return;
        }
        const timer = setTimeout(
          () => reject(new Error(`timeout esperando ${event}`)),
          2000,
        );
        socket.on(event, (payload: Record<string, unknown>) => {
          clearTimeout(timer);
          resolve({ event, payload });
        });
      });

    return { socket, received, authError, waitFor, closed };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(createPrismaMock())
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);
    baseUrl = await app.getUrl();
    baseUrl = baseUrl.replace('[::1]', '127.0.0.1');

    jwt = app.get(JwtService);
    gateway = app.get(OrdersGateway);
  });

  beforeEach(() => {
    while (sockets.length) sockets.pop()?.disconnect();
  });

  afterAll(async () => {
    while (sockets.length) sockets.pop()?.disconnect();
    await app.close();
  });

  it('rechaza el handshake sin ticket', async () => {
    const socket = io(`${baseUrl}/orders`, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 5000,
    });
    sockets.push(socket);

    const message = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 5000);
      socket.on('auth.error', (payload: { message?: string }) => {
        clearTimeout(timer);
        resolve(payload.message ?? '');
      });
    });

    expect(message).toBe('Falta el ticket de WebSocket');
    await new Promise<void>((resolve) => socket.on('disconnect', () => resolve()));
  });

  it('rechaza un access token HTTP como ticket', async () => {
    const httpToken = await jwt.signAsync({
      sub: 'u-1',
      email: 'x@fuego.pe',
      nombre: 'X',
      rol: 'ADMIN_GLOBAL',
      empresaId: EMPRESA_A,
      sucursalId: null,
    });
    const socket = io(`${baseUrl}/orders`, {
      auth: { ticket: httpToken },
      transports: ['websocket'],
      reconnection: false,
      timeout: 5000,
    });
    sockets.push(socket);

    const message = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 5000);
      socket.on('auth.error', (payload: { message?: string }) => {
        clearTimeout(timer);
        resolve(payload.message ?? '');
      });
    });

    expect(message).toBe('El ticket no sirve para WebSockets');
  });

  it('la comanda llega solo a la sucursal del tenant', async () => {
    const a = await connect({ ticket: await ticket(EMPRESA_A, SUCURSAL_A) });
    const b = await connect({ ticket: await ticket(EMPRESA_B, SUCURSAL_B) });

    const esperando = a.waitFor('order.created');
    gateway.emitOrderCreated(EMPRESA_A, {
      ordenId: '99999999-9999-4999-8999-999999999999',
      numeroOrden: 'ORD-000042',
      estado: 'POR_CONFIRMAR',
      origen: 'MESA',
      sucursalId: SUCURSAL_A,
      mesaId: null,
      total: 36,
      creadaAt: new Date().toISOString(),
    });

    const event = await esperando;
    expect(event.payload).toMatchObject({
      data: expect.objectContaining({ numeroOrden: 'ORD-000042', sucursalId: SUCURSAL_A }),
    });

    // Cortesía para que el servidor procese cualquier emisión tardía antes de
    // afirmar que la otra empresa no recibió nada.
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(b.received.map((item) => item.event)).not.toContain('order.created');
  });

  it('el ADMIN_GLOBAL recibe la empresa completa y no duplica eventos', async () => {
    const admin = await connect({ ticket: await ticket(EMPRESA_A, null) });
    const mesero = await connect({ ticket: await ticket(EMPRESA_A, SUCURSAL_A) });

    const paraAdmin = admin.waitFor('table.status');
    const paraMesero = mesero.waitFor('table.status');

    gateway.emitTableStatus(EMPRESA_A, {
      mesaId: '88888888-8888-4888-8888-888888888888',
      numero: 'Mesa 1',
      de: 'OCUPADA',
      a: 'LIBRE',
      sucursalId: SUCURSAL_A,
    });

    await Promise.all([paraAdmin, paraMesero]);
    expect(admin.received.filter((item) => item.event === 'table.status')).toHaveLength(1);
  });

  it('un cliente de la empresa A no recibe eventos de la empresa B', async () => {
    const a = await connect({ ticket: await ticket(EMPRESA_A, SUCURSAL_A) });
    const b = await connect({ ticket: await ticket(EMPRESA_B, SUCURSAL_B) });

    const esperando = b.waitFor('order.updated');
    gateway.emitOrderUpdated(EMPRESA_B, {
      ordenId: '77777777-7777-4777-8777-777777777777',
      numeroOrden: 'ORD-000777',
      de: 'EN_COCINA',
      a: 'LISTO',
      sucursalId: SUCURSAL_B,
      mesaId: null,
    });

    await esperando;
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(a.received.map((item) => item.event)).not.toContain('order.updated');
  });
});
