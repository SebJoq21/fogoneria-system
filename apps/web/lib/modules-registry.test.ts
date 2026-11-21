import { describe, expect, it } from 'vitest';

import { crmModule } from '@/features/crm/module';
import { featureModules, pendingFeatureIds } from '@/features/registry';
import { modulesNav } from './modules-nav';

/**
 * Fase 1 del plan de paridad: la metadata de `features/crm/module.ts` alimenta
 * el registry y el nav generados, sin cambiar todavía el shell.
 */
describe('registry y nav generados', () => {
  it('incluye la metadata de crm una sola vez', () => {
    expect(featureModules.filter((module) => module.id === 'crm')).toEqual([crmModule]);
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
});
