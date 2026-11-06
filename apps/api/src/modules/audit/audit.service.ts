import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

export interface AuditEntry {
  empresaId?: string | null;
  sucursalId?: string | null;
  usuarioId?: string | null;
  accion: string;
  entidad: string;
  entidadId?: string | null;
  detalle?: Record<string, unknown>;
  ip?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** La auditoría nunca debe tumbar la operación principal. */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.raw.auditoria.create({
        data: {
          empresa_id: entry.empresaId ?? null,
          sucursal_id: entry.sucursalId ?? null,
          usuario_id: entry.usuarioId ?? null,
          accion: entry.accion,
          entidad: entry.entidad,
          entidad_id: entry.entidadId ?? null,
          detalle: (entry.detalle ?? {}) as Prisma.InputJsonValue,
          ip: entry.ip ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(`No se pudo registrar auditoría: ${String(error)}`);
    }
  }

  list(empresaId: string, limit = 50) {
    return this.prisma.raw.auditoria.findMany({
      where: { empresa_id: empresaId },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }
}
