import { ApiProperty } from '@nestjs/swagger';

/** Respuesta de `POST /auth/ws-ticket` (AYCDS-14). */
export class WsTicketDto {
  @ApiProperty({
    description: 'Ticket efímero para el handshake de Socket.io.',
  })
  ticket!: string;

  @ApiProperty({ example: 60, description: 'Vigencia en segundos.' })
  expiresIn!: number;
}
