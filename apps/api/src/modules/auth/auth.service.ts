import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  WS_TICKET_SCOPE,
  type JwtPayload,
  type WsTicketPayload,
} from '../../common/types/authenticated-user.js';
import type { LoginDto } from './dto/login.dto.js';
import type { LoginResponseDto } from './dto/login-response.dto.js';
import type { WsTicketDto } from './dto/ws-ticket.dto.js';

const BLOCKED_TENANT_STATES = new Set(['SUSPENDED', 'EXPIRED', 'LEAD', 'NO_CALIFICADO']);

/** El ticket de WebSocket vive 60 s: solo cubre el handshake (AYCDS-14). */
export const WS_TICKET_TTL_SECONDS = 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const email = dto.email.trim();
    // El email es único entre usuarios activos (índice parcial), pero se buscan
    // candidatos por si datos históricos previos al índice tienen duplicados.
    // Si dos coinciden, el login sería ambiguo → 409.
    const candidatos = await this.prisma.raw.usuarios.findMany({
      where: { email, deleted_at: null },
      include: { empresas: true, sucursales: true },
      orderBy: { created_at: 'asc' },
      take: 5,
    });

    const coincidencias: (typeof candidatos)[number][] = [];
    for (const candidato of candidatos) {
      if (await bcrypt.compare(dto.password, candidato.password_hash)) {
        coincidencias.push(candidato);
      }
    }

    if (coincidencias.length === 0) throw new UnauthorizedException('Credenciales inválidas');
    if (coincidencias.length > 1) {
      throw new ConflictException(
        'Ese correo está registrado en más de una empresa. Contacta a soporte.',
      );
    }
    const usuario = coincidencias[0];

    if (usuario.estado !== 'ACTIVO') {
      throw new ForbiddenException('El usuario no está activo');
    }

    const empresa = usuario.empresas;
    if (empresa) {
      if (empresa.deleted_at) throw new ForbiddenException('La empresa fue dada de baja');
      if (BLOCKED_TENANT_STATES.has(empresa.estado)) {
        throw new ForbiddenException(
          `La suscripción de la empresa está ${empresa.estado.toLowerCase()}`,
        );
      }
      if (empresa.estado === 'TRIAL' && empresa.trial_fin && empresa.trial_fin < new Date()) {
        throw new ForbiddenException('El periodo de prueba terminó');
      }
    }

    await this.prisma.raw.usuarios.update({
      where: { id: usuario.id },
      data: { ultimo_login: new Date() },
    });

    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      empresaId: usuario.empresa_id,
      sucursalId: usuario.sucursal_id,
    };

    const accessToken = await this.jwt.signAsync(payload);
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN') ?? '8h';

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        empresaId: usuario.empresa_id,
        sucursalId: usuario.sucursal_id,
      },
      tenant: empresa
        ? {
            id: empresa.id,
            nombre: empresa.nombre_comercial ?? empresa.nombre_legal,
            estado: empresa.estado,
            plan: empresa.plan_actual,
            trialFin: empresa.trial_fin,
          }
        : null,
    };
  }

  /**
   * Ticket efímero para el handshake de Socket.io (AYCDS-14).
   *
   * No reutiliza el access token: el navegador nunca lo ve y el ticket muere
   * en 60 s. `JwtStrategy` rechaza cualquier token con `scope`, así que este
   * ticket no abre la API HTTP.
   */
  async issueWsTicket(payload: JwtPayload): Promise<WsTicketDto> {
    if (!payload.empresaId) {
      throw new ForbiddenException(
        'El ticket de WebSocket requiere una empresa en la sesión',
      );
    }

    const ticket = await this.jwt.signAsync(
      {
        sub: payload.sub,
        empresaId: payload.empresaId,
        sucursalId: payload.sucursalId,
        rol: payload.rol,
        scope: WS_TICKET_SCOPE,
      } satisfies WsTicketPayload,
      { expiresIn: WS_TICKET_TTL_SECONDS },
    );

    return { ticket, expiresIn: WS_TICKET_TTL_SECONDS };
  }

  async me(payload: JwtPayload): Promise<LoginResponseDto['user'] & { tenant: LoginResponseDto['tenant'] }> {
    const usuario = await this.prisma.raw.usuarios.findFirst({
      where: { id: payload.sub, deleted_at: null },
      include: { empresas: true },
    });

    if (!usuario || usuario.estado !== 'ACTIVO') {
      throw new UnauthorizedException('Sesión no válida');
    }

    const empresa = usuario.empresas;
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      empresaId: usuario.empresa_id,
      sucursalId: usuario.sucursal_id,
      tenant: empresa
        ? {
            id: empresa.id,
            nombre: empresa.nombre_comercial ?? empresa.nombre_legal,
            estado: empresa.estado,
            plan: empresa.plan_actual,
            trialFin: empresa.trial_fin,
          }
        : null,
    };
  }
}
