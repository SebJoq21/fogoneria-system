import { describe, expect, it } from 'vitest';

import { crmModule } from '@/features/crm/module';
import { featureModules, pendingFeatureIds } from '@/features/registry';
import { modulesNav, moduleTitles } from './modules-nav';

/**
 * Fase 1 del plan de paridad: la metadata de `features/crm/module.ts` alimenta
 * el registry y el nav generados, sin cambiar todavía el shell.
 */
describe('registry y nav generados', () => {
  it('incluye la metadata de crm una sola vez', () => {
    expect(featureModules.filter((module) => module.id === 'crm')).toEqual([crmModule]);
  });

  it('incluye los módulos de la Fase 3', () => {
    expect(featureModules.map((module) => module.id)).toEqual(
      expect.arrayContaining(['catalog', 'pricing', 'tables', 'reservations']),
    );
  });

  it('no repite IDs y deja el resto como pendientes', () => {
    const ids = featureModules.map((module) => module.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(pendingFeatureIds).not.toContain('crm');
  });

  it('el nav de crm sale de module.ts', () => {
    const entry = modulesNav
      .flatMap((group) => group.entries)
      .find((item) => item.href === crmModule.path);
    expect(entry).toMatchObject({
      label: crmModule.label,
      icon: crmModule.icon,
      roles: crmModule.roles,
    });
  });

  it('el nav de mesas y reservas sale de su module.ts', () => {
    const entries = modulesNav.flatMap((group) => group.entries);
    expect(entries.find((item) => item.href === '/app/mesas')).toMatchObject({
      label: 'Mesas',
      icon: 'Armchair',
    });
    expect(entries.find((item) => item.href === '/app/modulos/reservas')).toMatchObject({
      label: 'Reservas',
      icon: 'CalendarDays',
    });
  });

  it('los títulos de detalle salen del catálogo generado', () => {
    expect(moduleTitles['/app/productos/precios']).toBe('Listas de precios');
    expect(moduleTitles['/app/pagos']).toBe('Gestión de pagos');
    expect(moduleTitles['/app/mesas']).toBe('Mapa de mesas');
  });
});
