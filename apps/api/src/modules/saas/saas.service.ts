import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { isValidRuc } from '../../common/utils/ruc.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import type { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { paginationOf } from '../../common/dto/pagination.dto.js';
import type {
  ChangePlanDto,
  CreateTenantDto,
} from './dto/create-tenant.dto.js';
import type { ListTenantsQueryDto } from './dto/list-tenants.dto.js';

@Injectable()
export class SaasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async createTenant(dto: CreateTenantDto, actor: AuthenticatedUser) {
    if (!isValidRuc(dto.ruc)) {
      throw new ConflictException('RUC inválido (dígito verificador)');
    }

    const existing = await this.prisma.raw.empresas.findFirst({
      where: { ruc: dto.ruc },
    });
    if (existing) throw new ConflictException('Ya existe una empresa con ese RUC');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const trialDias = dto.trialDias ?? Number(this.config.get('TRIAL_DAYS') ?? 14);
    const now = new Date();
    const trialFin = new Date(now.getTime() + trialDias * 86_400_000);

    return this.prisma.raw.$transaction(async (tx) => {
      const empresa = await tx.empresas.create({
        data: {
          nombre_legal: dto.nombreLegal.trim(),
          nombre_comercial: dto.nombreComercial?.trim() ?? null,
          ruc: dto.ruc,
          estado: 'TRIAL',
          plan_actual: dto.plan ?? 'TRIAL',
          mrr_monto: 0,
          limite_sucursales: dto.limiteSucursales ?? 3,
          trial_inicio: now,
          trial_fin: trialFin,
        },
      });

      const sucursal = await tx.sucursales.create({
        data: {
          empresa_id: empresa.id,
          nombre: dto.sucursalNombre?.trim() || 'Sede principal',
          es_matriz: true,
          estado: 'ABIERTA',
        },
      });

      const admin = await tx.usuarios.create({
        data: {
          empresa_id: empresa.id,
          sucursal_id: sucursal.id,
          nombre: dto.nombreAdmin.trim(),
          email: dto.emailAdmin.trim(),
          password_hash: passwordHash,
          rol: 'ADMIN_GLOBAL',
          estado: 'ACTIVO',
        },
      });

      await tx.suscripciones_eventos.create({
        data: {
          empresa_id: empresa.id,
          plan: dto.plan ?? 'TRIAL',
          estado_anterior: 'LEAD',
          estado_nuevo: 'TRIAL',
          motivo: 'Alta de tenant desde consola SaaS',
          mrr_antes: 0,
          mrr_despues: 0,
          actor_usuario_id: actor.sub,
        },
      });

      await tx.auditoria.create({
        data: {
          empresa_id: empresa.id,
          usuario_id: actor.sub,
          accion: 'TENANT_CREADO',
          entidad: 'empresas',
          entidad_id: empresa.id,
          detalle: { ruc: empresa.ruc, plan: empresa.plan_actual },
        },
      });

      return {
        id: empresa.id,
        nombreLegal: empresa.nombre_legal,
        ruc: empresa.ruc,
        estado: empresa.estado,
        plan: empresa.plan_actual,
        trialFin: empresa.trial_fin,
        sucursalMatriz: { id: sucursal.id, nombre: sucursal.nombre },
        admin: { id: admin.id, nombre: admin.nombre, email: admin.email },
      };
    });
  }

  async list(query: ListTenantsQueryDto) {
    const { skip, take } = paginationOf(query);
    const where = {
      deleted_at: null,
      ...(query.estado ? { estado: query.estado } : {}),
      ...(query.plan ? { plan_actual: query.plan } : {}),
      ...(query.search
        ? {
            OR: [
              {
                nombre_legal: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                nombre_comercial: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              { ruc: { contains: query.search } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.raw.empresas.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
        include: {
          _count: { select: { sucursales: true, usuarios: true } },
        },
      }),
      this.prisma.raw.empresas.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async getTenant(id: string) {
    const empresa = await this.prisma.raw.empresas.findFirst({
      where: { id, deleted_at: null },
      include: {
        sucursales: {
          where: { deleted_at: null },
          select: { id: true, nombre: true, estado: true, es_matriz: true },
        },
        suscripciones_eventos: {
          orderBy: { created_at: 'desc' },
          take: 10,
        },
        _count: { select: { usuarios: true } },
      },
    });
    if (!empresa) throw new NotFoundException('Empresa no encontrada');
    return empresa;
  }

  async suspend(id: string, motivo: string, actor: AuthenticatedUser) {
    return this.changeState(id, 'SUSPENDED', motivo, actor);
  }

  async reactivate(id: string, motivo: string | undefined, actor: AuthenticatedUser) {
    return this.changeState(id, 'ACTIVE', motivo ?? 'Reactivación manual', actor);
  }

  async changePlan(id: string, dto: ChangePlanDto, actor: AuthenticatedUser) {
    const empresa = await this.requireTenant(id);
    const updated = await this.prisma.raw.$transaction(async (tx) => {
      const next = await tx.empresas.update({
        where: { id },
        data: { plan_actual: dto.plan, mrr_monto: dto.mrrMonto },
      });

      await tx.suscripciones_eventos.create({
        data: {
          empresa_id: id,
          plan: dto.plan,
          estado_anterior: empresa.estado,
          estado_nuevo: empresa.estado,
          motivo: 'Cambio de plan',
          mrr_antes: empresa.mrr_monto,
          mrr_despues: dto.mrrMonto,
          actor_usuario_id: actor.sub,
        },
      });

      await tx.auditoria.create({
        data: {
          empresa_id: id,
          usuario_id: actor.sub,
          accion: 'PLAN_CAMBIADO',
          entidad: 'empresas',
          entidad_id: id,
          detalle: {
            planAnterior: empresa.plan_actual,
            planNuevo: dto.plan,
            mrrAnterior: String(empresa.mrr_monto),
            mrrNuevo: dto.mrrMonto,
          },
        },
      });

      return next;
    });

    return updated;
  }

  async metrics() {
    const [total, trial, active, suspended, expired, mrr] = await Promise.all([
      this.prisma.raw.empresas.count({ where: { deleted_at: null } }),
      this.prisma.raw.empresas.count({ where: { estado: 'TRIAL', deleted_at: null } }),
      this.prisma.raw.empresas.count({ where: { estado: 'ACTIVE', deleted_at: null } }),
      this.prisma.raw.empresas.count({ where: { estado: 'SUSPENDED', deleted_at: null } }),
      this.prisma.raw.empresas.count({ where: { estado: 'EXPIRED', deleted_at: null } }),
      this.prisma.raw.empresas.aggregate({
        _sum: { mrr_monto: true },
        where: { estado: 'ACTIVE', deleted_at: null },
      }),
    ]);

    return {
      empresas: { total, trial, active, suspended, expired },
      mrr: Number(mrr._sum.mrr_monto ?? 0),
    };
  }

  private async changeState(
    id: string,
    estadoNuevo: 'SUSPENDED' | 'ACTIVE',
    motivo: string,
    actor: AuthenticatedUser,
  ) {
    const empresa = await this.requireTenant(id);
    if (empresa.estado === estadoNuevo) return empresa;

    return this.prisma.raw.$transaction(async (tx) => {
      const next = await tx.empresas.update({
        where: { id },
        data: { estado: estadoNuevo },
      });

      await tx.suscripciones_eventos.create({
        data: {
          empresa_id: id,
          plan: empresa.plan_actual,
          estado_anterior: empresa.estado,
          estado_nuevo: estadoNuevo,
          motivo,
          mrr_antes: empresa.mrr_monto,
          mrr_despues: empresa.mrr_monto,
          actor_usuario_id: actor.sub,
        },
      });

      await tx.auditoria.create({
        data: {
          empresa_id: id,
          usuario_id: actor.sub,
          accion: estadoNuevo === 'SUSPENDED' ? 'TENANT_SUSPENDIDO' : 'TENANT_REACTIVADO',
          entidad: 'empresas',
          entidad_id: id,
          detalle: { motivo, estadoAnterior: empresa.estado },
        },
      });

      return next;
    });
  }

  private async requireTenant(id: string) {
    const empresa = await this.prisma.raw.empresas.findFirst({
      where: { id, deleted_at: null },
    });
    if (!empresa) throw new NotFoundException('Empresa no encontrada');
    return empresa;
  }

  /** Expone la auditoría del tenant para la consola SaaS. */
  history(id: string, query: PaginationQueryDto) {
    const { skip, take } = paginationOf(query);
    return this.prisma.raw.auditoria.findMany({
      where: { empresa_id: id },
      skip,
      take,
      orderBy: { created_at: 'desc' },
    });
  }
}
