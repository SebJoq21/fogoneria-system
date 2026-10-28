import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser, JwtPayload } from '../../../common/types/authenticated-user.js';

/** Un ticket de WebSocket (`scope: 'ws'`) nunca sirve como access token HTTP. */
type TokenPayload = JwtPayload & { scope?: string };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'dev-only-jwt-secret-change-me',
    });
  }

  validate(payload: TokenPayload): AuthenticatedUser {
    if (payload.scope) {
      throw new UnauthorizedException('Este token no es válido para la API');
    }
    return payload;
  }
}
