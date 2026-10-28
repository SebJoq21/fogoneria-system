import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { isUUID } from 'class-validator';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  WS_TICKET_SCOPE,
  type WsTicketPayload,
} from '../../common/types/authenticated-user.js';
import {
  REALTIME_EVENT,
  REALTIME_NAMESPACE,
  branchRoom,
  companyRoom,
  envelope,
  orderRoom,
  type OrderCreatedPayload,
  type OrderUpdatedPayload,
  type TableStatusPayload,
} from './realtime.types.js';

type SocketAuth = {
  empresaId: string;
  sucursalId: string | null;
  rol: string;
  userId: string;
};

function corsOrigins(): string[] {
  return (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Gateway de comandas (AYCDS-14).
 *
 * Todos los clientes entran por el namespace `/orders` con un ticket efímero
 * (`POST /auth/ws-ticket`). Al conectar se les mete en el room del tenant:
 *   - roles con sucursal → `empresa:<empresa>:sucursal:<sucursal>`
 *   - roles sin sucursal (`ADMIN_GLOBAL`) → `empresa:<empresa>`
 *
 * Nunca se emite a un room sin tenant, así que un cliente de otra empresa no
 * puede recibir eventos aunque adivine un `ordenId`.
 */
@WebSocketGateway({
  namespace: REALTIME_NAMESPACE,
  cors: { origin: corsOrigins(), credentials: true },
})
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(OrdersGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const context = await this.authenticate(client);
    if (!context) return;

    const rooms = context.sucursalId
      ? [branchRoom(context.empresaId, context.sucursalId)]
      : // Los roles sin sucursal (`ADMIN_GLOBAL`) reciben toda la empresa; un
        // operativo NO entra aquí para no duplicar cada evento.
        [companyRoom(context.empresaId)];

    client.data.auth = context;
    await client.join(rooms);
  }

  handleDisconnect(client: Socket): void {
    const context = client.data.auth as SocketAuth | undefined;
    if (context) {
      this.logger.debug(`WS desconectado: ${context.userId} (${client.id})`);
    }
  }

  /** Un cliente puede seguir una comanda concreta si es de su tenant. */
  @SubscribeMessage('order:subscribe')
  async subscribeToOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { ordenId?: string } | undefined,
  ): Promise<{ ordenId: string } | { error: string }> {
    const context = client.data.auth as SocketAuth | undefined;
    if (!context) return { error: 'No autenticado' };

    const ordenId = body?.ordenId;
    if (!ordenId || !isUUID(ordenId)) return { error: 'ordenId inválido' };

    const orden = await this.prisma.raw.ordenes.findFirst({
      where: { id: ordenId, empresa_id: context.empresaId },
      select: { id: true, sucursal_id: true },
    });
    if (!orden) return { error: 'Orden no encontrada' };
    if (context.sucursalId && orden.sucursal_id !== context.sucursalId) {
      return { error: 'Orden de otra sucursal' };
    }

    await client.join(orderRoom(orden.id));
    return { ordenId: orden.id };
  }

  emitOrderCreated(empresaId: string, payload: OrderCreatedPayload): void {
    this.toBranch(empresaId, payload.sucursalId, REALTIME_EVENT.orderCreated, payload);
  }

  emitOrderUpdated(empresaId: string, payload: OrderUpdatedPayload): void {
    this.toBranch(empresaId, payload.sucursalId, REALTIME_EVENT.orderUpdated, payload, [
      orderRoom(payload.ordenId),
    ]);
  }

  emitTableStatus(empresaId: string, payload: TableStatusPayload): void {
    this.toBranch(empresaId, payload.sucursalId, REALTIME_EVENT.tableStatus, payload);
  }

  private toBranch<T>(
    empresaId: string,
    sucursalId: string,
    event: string,
    payload: T,
    extraRooms: string[] = [],
  ): void {
    if (!this.server) return;
    const message = envelope(payload);
    const rooms = [
      companyRoom(empresaId),
      branchRoom(empresaId, sucursalId),
      ...extraRooms,
    ];
    // `.to(a).to(b).emit()` es una unión: un cliente en varios rooms recibe
    // el mensaje una sola vez.
    this.server.to(rooms).emit(event, message);
  }

  private async authenticate(client: Socket): Promise<SocketAuth | null> {
    const ticket = (client.handshake.auth as { ticket?: unknown } | undefined)?.ticket;
    if (typeof ticket !== 'string' || !ticket) {
      return this.reject(client, 'Falta el ticket de WebSocket');
    }

    let payload: WsTicketPayload;
    try {
      payload = await this.jwt.verifyAsync<WsTicketPayload>(ticket, {
        secret:
          this.config.get<string>('JWT_SECRET') ?? 'dev-only-jwt-secret-change-me',
      });
    } catch {
      return this.reject(client, 'El ticket expiró o no es válido');
    }

    if (payload.scope !== WS_TICKET_SCOPE) {
      return this.reject(client, 'El ticket no sirve para WebSockets');
    }
    if (!payload.empresaId) {
      return this.reject(client, 'El ticket no tiene empresa');
    }

    return {
      empresaId: payload.empresaId,
      sucursalId: payload.sucursalId ?? null,
      rol: payload.rol,
      userId: payload.sub,
    };
  }

  private reject(client: Socket, message: string): null {
    client.emit(REALTIME_EVENT.authError, { message });
    // Un `disconnect(true)` en el mismo tick puede descartar el paquete: se da
    // un margen mínimo para que el cliente reciba el motivo del rechazo.
    setTimeout(() => client.disconnect(true), 100);
    return null;
  }
}
