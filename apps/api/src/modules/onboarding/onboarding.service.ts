import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { isValidRuc } from '../../common/utils/ruc.js';
import type { SubmitOnboardingDto } from './dto/submit-onboarding.dto.js';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Alta pública de un restaurante: registra el lead, crea la empresa en TRIAL
   * (con RUC y logo), su sucursal matriz, el admin global y una lista de
   * precios base para que la carta quede operativa desde el primer login.
   */
  async submit(dto: SubmitOnboardingDto, ip?: string | null) {
    if (!isValidRuc(dto.ruc)) {
      throw new ConflictException('RUC inválido (dígito verificador)');
    }

    const existing = await this.prisma.raw.empresas.findFirst({
      where: { ruc: dto.ruc, deleted_at: null },
    });
    if (existing) throw new ConflictException('Ya existe una empresa con ese RUC');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const trialDias = Number(this.config.get('TRIAL_DAYS') ?? 14);
    const now = new Date();
    const trialFin = new Date(now.getTime() + trialDias * 86_400_000);
    const [nombre, ...resto] = dto.nombreAdmin.trim().split(/\s+/);

    const result = await this.prisma.raw.$transaction(async (tx) => {
      const empresa = await tx.empresas.create({
        data: {
          nombre_legal: dto.nombreLegal.trim(),
          nombre_comercial: dto.nombreComercial?.trim() ?? null,
          ruc: dto.ruc,
          logo_url: dto.logoUrl?.trim() ?? null,
          estado: 'TRIAL',
          plan_actual: dto.plan ?? 'TRIAL',
          mrr_monto: 0,
          limite_sucursales: 3,
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
          email: dto.emailAdmin.trim().toLowerCase(),
          password_hash: passwordHash,
          rol: 'ADMIN_GLOBAL',
          estado: 'ACTIVO',
        },
      });

      await tx.listas_precios.create({
        data: {
          empresa_id: empresa.id,
          nombre: 'Carta',
          activa: true,
        },
      });

      const lead = await tx.leads_cotizaciones.create({
        data: {
          nombre: nombre ?? dto.nombreAdmin.trim(),
          apellido: resto.join(' ') || '—',
          telefono: dto.telefono?.trim() || '',
          email: dto.emailAdmin.trim().toLowerCase(),
          negocio: dto.nombreComercial?.trim() || dto.nombreLegal.trim(),
          rango_sucursales: dto.rangoSucursales ?? 'UNO',
          estado: 'GANADO',
          empresa_creada_id: empresa.id,
          notas: dto.notas?.trim() ?? null,
        },
      });

      await tx.suscripciones_eventos.create({
        data: {
          empresa_id: empresa.id,
          plan: dto.plan ?? 'TRIAL',
          estado_anterior: 'LEAD',
          estado_nuevo: 'TRIAL',
          motivo: 'Autoregistro desde onboarding',
          mrr_antes: 0,
          mrr_despues: 0,
          actor_usuario_id: admin.id,
        },
      });

      return { empresa, sucursal, admin, lead };
    });

    await this.audit.record({
      empresaId: result.empresa.id,
      sucursalId: result.sucursal.id,
      usuarioId: result.admin.id,
      accion: 'ONBOARDING_TENANT_CREADO',
      entidad: 'empresas',
      entidadId: result.empresa.id,
      detalle: {
        ruc: result.empresa.ruc,
        plan: result.empresa.plan_actual,
        leadId: result.lead.id,
        logo: Boolean(result.empresa.logo_url),
      },
      ip,
    });

    return {
      id: result.empresa.id,
      nombreLegal: result.empresa.nombre_legal,
      nombreComercial: result.empresa.nombre_comercial,
      ruc: result.empresa.ruc,
      logoUrl: result.empresa.logo_url,
      estado: result.empresa.estado,
      plan: result.empresa.plan_actual,
      trialFin: result.empresa.trial_fin,
      sucursalMatriz: { id: result.sucursal.id, nombre: result.sucursal.nombre },
      admin: {
        id: result.admin.id,
        nombre: result.admin.nombre,
        email: result.admin.email,
      },
    };
  }
}
