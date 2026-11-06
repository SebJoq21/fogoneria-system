import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

export interface BillingCycleResult {
  expired: string[];
  suspended: string[];
}

/**
 * Ciclo de morosidad:
 * 1. TRIAL con trial_fin vencido → EXPIRED.
 * 2. EXPIRED con gracia cumplida → SUSPENDED.
 * Ambas transiciones quedan en suscripciones_eventos y auditoría.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async runCycle(now = new Date()): Promise<BillingCycleResult> {
    const expired = await this.expireTrials(now);
    const suspended = await this.suspendExpired(now);
    return { expired, suspended };
  }

  async expireTrials(now = new Date()): Promise<string[]> {
    const trials = await this.prisma.raw.empresas.findMany({
      where: {
        estado: 'TRIAL',
        deleted_at: null,
        trial_fin: { lt: now },
      },
      select: { id: true, plan_actual: true, mrr_monto: true, trial_fin: true },
    });

    for (const empresa of trials) {
      await this.prisma.raw.$transaction(async (tx) => {
        await tx.empresas.update({
          where: { id: empresa.id },
          data: { estado: 'EXPIRED' },
        });
        await tx.suscripciones_eventos.create({
          data: {
            empresa_id: empresa.id,
            plan: empresa.plan_actual,
            estado_anterior: 'TRIAL',
            estado_nuevo: 'EXPIRED',
            motivo: 'Trial vencido (cron de morosidad)',
            mrr_antes: empresa.mrr_monto,
            mrr_despues: empresa.mrr_monto,
          },
        });
      });
      await this.audit.record({
        empresaId: empresa.id,
        accion: 'TRIAL_EXPIRADO',
        entidad: 'empresas',
        entidadId: empresa.id,
        detalle: { trialFin: empresa.trial_fin },
      });
    }

    if (trials.length) {
      this.logger.log(`Trials expirados: ${trials.length}`);
    }
    return trials.map((empresa) => empresa.id);
  }

  async suspendExpired(now = new Date()): Promise<string[]> {
    const graceDays = Number(this.config.get('BILLING_GRACE_DAYS') ?? 5);
    const cutoff = new Date(now.getTime() - graceDays * 86_400_000);

    const expired = await this.prisma.raw.empresas.findMany({
      where: {
        estado: 'EXPIRED',
        deleted_at: null,
        trial_fin: { lt: cutoff },
      },
      select: { id: true, plan_actual: true, mrr_monto: true, trial_fin: true },
    });

    for (const empresa of expired) {
      await this.prisma.raw.$transaction(async (tx) => {
        await tx.empresas.update({
          where: { id: empresa.id },
          data: { estado: 'SUSPENDED' },
        });
        await tx.suscripciones_eventos.create({
          data: {
            empresa_id: empresa.id,
            plan: empresa.plan_actual,
            estado_anterior: 'EXPIRED',
            estado_nuevo: 'SUSPENDED',
            motivo: `Sin regularizar tras ${graceDays} días de gracia`,
            mrr_antes: empresa.mrr_monto,
            mrr_despues: empresa.mrr_monto,
          },
        });
      });
      await this.audit.record({
        empresaId: empresa.id,
        accion: 'TENANT_SUSPENDIDO_AUTOMATICO',
        entidad: 'empresas',
        entidadId: empresa.id,
        detalle: { graceDays },
      });
    }

    if (expired.length) {
      this.logger.log(`Empresas suspendidas por morosidad: ${expired.length}`);
    }
    return expired.map((empresa) => empresa.id);
  }
}
