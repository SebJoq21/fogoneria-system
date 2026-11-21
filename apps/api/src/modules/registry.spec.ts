import { describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';
import { MODULE_REGISTRY } from './registry.js';

/**
 * El registry es generado (`pnpm gen:modules`): este test fija que el wiring de
 * `AppModule` cubre los 20 módulos del catálogo sin duplicados.
 */
describe('MODULE_REGISTRY', () => {
  it('registra 20 módulos sin duplicados', () => {
    expect(MODULE_REGISTRY).toHaveLength(20);
    expect(new Set(MODULE_REGISTRY).size).toBe(20);
  });

  it('AppModule consume el registry generado', () => {
    const imports = (Reflect.getMetadata('imports', AppModule) ?? []) as unknown[];
    for (const module of MODULE_REGISTRY) {
      expect(imports).toContain(module);
    }
  });

  it('incluye los módulos de negocio y de infraestructura', () => {
    const names = MODULE_REGISTRY.map((module) => module.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'AuthModule',
        'AuditModule',
        'OrdersModule',
        'CashModule',
        'ReceiptsModule',
        'InventoryModule',
        'PromotionsModule',
        'StaffModule',
        'CrmModule',
        'ExpensesModule',
        'BiModule',
        'RealtimeModule',
      ]),
    );
  });
});
