import { ApiProperty } from '@nestjs/swagger';

export class LoginUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nombre!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ example: 'ADMIN_GLOBAL' })
  rol!: string;

  @ApiProperty({ nullable: true })
  empresaId!: string | null;

  @ApiProperty({ nullable: true })
  sucursalId!: string | null;
}

export class LoginTenantDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nombre!: string;

  @ApiProperty({ example: 'TRIAL' })
  estado!: string;

  @ApiProperty({ example: 'TRIAL' })
  plan!: string;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  trialFin!: Date | null;
}

export class LoginResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  @ApiProperty({ example: '8h' })
  expiresIn!: string;

  @ApiProperty({ type: LoginUserDto })
  user!: LoginUserDto;

  @ApiProperty({ type: LoginTenantDto, nullable: true })
  tenant!: LoginTenantDto | null;
}
