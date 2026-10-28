import { Module } from '@nestjs/common';
import { SequencesService } from './sequences.service.js';

/** Contadores por empresa reutilizables (Órdenes, Reservas). */
@Module({
  providers: [SequencesService],
  exports: [SequencesService],
})
export class SequencesModule {}
