import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { JwtPayload } from '../../common/types/authenticated-user.js';
import type { LoginDto } from './dto/login.dto.js';
import type { LoginResponseDto } from './dto/login-response.dto.js';

const BLOCKED_TENANT_STATES = new Set(['SUSPENDED', 'EXPIRED', 'LEAD', 'NO_CALIFICADO']);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const usuario = await this.prisma.raw.usuarios.findFirst({
      where: { email: dto.email.trim(), deleted_at: null },
      include: { empresas: true, sucursales: true },
    });

    if (!usuario) throw new UnauthorizedException('Credenciales inválidas');

    const passwordOk = await bcrypt.compare(dto.password, usuario.password_hash);
    if (!passwordOk) throw new UnauthorizedException('Credenciales inválidas');

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
