import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { isValidRuc } from '../../common/utils/ruc.js';
import type { SubmitOnboardingDto } from './dto/submit-onboarding.dto.js';

/** Días de trial por defecto si `TRIAL_DAYS` falta o es inválido. */
const TRIAL_DAYS_DEFAULT = 14;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

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
      throw new BadRequestException('RUC inválido: el dígito verificador no cumple SUNAT');
    }

    const email = dto.emailAdmin.trim().toLowerCase();

    const [empresaExistente, usuarioExistente] = await Promise.all([
      // Sin filtrar por `deleted_at`: el RUC es único global y una empresa dada
      // de baja no debe poder reutilizarse (rompería sus comprobantes).
      this.prisma.raw.empresas.findFirst({ where: { ruc: dto.ruc } }),
      // El email es único global entre usuarios activos; uno dado de baja
      // libera el correo (el índice parcial ignora `deleted_at`).
      this.prisma.raw.usuarios.findFirst({ where: { email, deleted_at: null } }),
    ]);
    if (empresaExistente) throw new ConflictException('Ya existe una empresa con ese RUC');
    if (usuarioExistente) throw new ConflictException('Ese correo ya tiene una cuenta');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const trialDias = this.trialDays();
    const now = new Date();
    const trialFin = new Date(now.getTime() + trialDias * 86_400_000);
    const [nombre, ...resto] = dto.nombreAdmin.trim().split(/\s+/);

    let result;
    try {
      result = await this.prisma.raw.$transaction(async (tx) => {
        const empresa = await tx.empresas.create({
          data: {
            nombre_legal: dto.nombreLegal.trim(),
            nombre_comercial: dto.nombreComercial?.trim() ?? null,
            ruc: dto.ruc,
            logo_url: dto.logoUrl?.trim() ?? null,
            estado: 'TRIAL',
            plan_actual: 'TRIAL',
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
            email,
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
            email,
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
            plan: 'TRIAL',
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
    } catch (error) {
      // Carrera entre dos altas con el mismo RUC/correo (P2002) → 409, no 500.
      if (isUniqueViolation(error)) {
        throw new ConflictException('El RUC o el correo ya están registrados');
      }
      throw error;
    }

    // La auditoría no debe tumbar un alta ya confirmada.
    try {
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
    } catch (error) {
      this.logger.warn(`No se pudo auditar el onboarding: ${String(error)}`);
    }

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

  private trialDays(): number {
    const raw = Number(this.config.get('TRIAL_DAYS') ?? TRIAL_DAYS_DEFAULT);
    if (!Number.isFinite(raw) || raw <= 0) return TRIAL_DAYS_DEFAULT;
    return Math.floor(raw);
  }
}
