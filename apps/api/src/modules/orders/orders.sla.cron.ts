import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { SLA_MINUTOS, SLA_STATES, cutoffSla, slaInfo } from './orders.sla.js';

export interface SlaSweepResult {
  marcadas: number;
}

/**
 * Barrido de SLA del KDS (AYCDS-30).
 *
 * Cada minuto marca las comandas que pasaron los 20 minutos sin entregarse y
 * emite `order.sla` una sola vez por comanda: el KDS se entera sin sondear y la
 * alerta queda en la base (`ordenes.alerta_sla`) para el tablero y la auditoría
 * del turno.
 *
 * Usa el cliente de plataforma (`prisma.raw`) porque corre fuera de un request:
 * `prisma.scoped` necesita el contexto de tenant que aquí no existe. El filtro
 * por empresa no se pierde, cada evento se emite con la empresa de su orden.
 */
@Injectable()
export class OrdersSlaCron {
  private readonly logger = new Logger(OrdersSlaCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(now: Date = new Date()): Promise<SlaSweepResult> {
    const cutoff = cutoffSla(now);

    const pendientes = await this.prisma.raw.ordenes.findMany({
      where: {
        estado: { in: [...SLA_STATES] },
        alerta_sla: false,
        OR: [
          { confirmacion_at: { not: null, lt: cutoff } },
          { confirmacion_at: null, ingreso_at: { lt: cutoff } },
        ],
      },
      select: {
        id: true,
        numero_orden: true,
        estado: true,
        empresa_id: true,
        sucursal_id: true,
        mesa_id: true,
        ingreso_at: true,
        confirmacion_at: true,
      },
      take: 500,
    });

    if (!pendientes.length) return { marcadas: 0 };

    // Se marca solo lo que sigue en falso: dos corridas solapadas no duplican
    // el evento (el `where` es la garantía, no la memoria del proceso).
    await this.prisma.raw.ordenes.updateMany({
      where: { id: { in: pendientes.map((orden) => orden.id) }, alerta_sla: false },
      data: { alerta_sla: true },
    });

    for (const orden of pendientes) {
      const { minutos } = slaInfo(orden, now);
      this.realtime.orderSla(orden.empresa_id, {
        ordenId: orden.id,
        numeroOrden: orden.numero_orden,
        estado: orden.estado,
        sucursalId: orden.sucursal_id,
        mesaId: orden.mesa_id,
        minutos: minutos ?? SLA_MINUTOS,
        slaMinutos: SLA_MINUTOS,
      });
    }

    this.logger.warn(`Comandas fuera de SLA marcadas: ${pendientes.length}`);
    return { marcadas: pendientes.length };
  }
}
