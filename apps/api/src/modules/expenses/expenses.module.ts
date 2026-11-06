import { Module } from '@nestjs/common';
import { CashModule } from '../cash/cash.module.js';
import { ExpensesController } from './expenses.controller.js';
import { ExpensesService } from './expenses.service.js';

@Module({
  imports: [CashModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
