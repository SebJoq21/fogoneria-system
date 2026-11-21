import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  notify: () => {},
  roles: [
    { id: 'r-1', name: 'Mozo', description: 'Atiende mesas' },
    { id: 'r-2', name: 'Cocinero', description: 'Prepara platos' },
  ],
  setRoles: () => {},
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { StaffModule } from './StaffModule';
import { RolesView } from './RolesView';

describe('StaffModule', () => {
  it('pinta el equipo con su resumen', () => {
    const markup = renderToStaticMarkup(<StaffModule tab="equipo" />);
    expect(markup).toContain('Resumen de personal');
    expect(markup).toContain('Equipo en turno');
  });

  it('pinta el plan de turnos por día', () => {
    const markup = renderToStaticMarkup(<StaffModule tab="turnos" />);
    expect(markup).toContain('Cobertura de turnos');
    expect(markup).toContain('Lun');
  });

  it('pinta el pozo de propinas y el reparto', () => {
    const markup = renderToStaticMarkup(<StaffModule tab="propinas" />);
    expect(markup).toContain('Pozo vs equipo');
    expect(markup).toContain('86.5');
  });
});

describe('RolesView', () => {
  it('pinta el maestro de roles con sus acciones', () => {
    const markup = renderToStaticMarkup(<RolesView />);
    expect(markup).toContain('Mozo');
    expect(markup).toContain('Cocinero');
    expect(markup).toContain('Nuevo rol');
  });

  it('sin roles pinta la tabla vacía sin romper', () => {
    const roles = estado.roles;
    estado.roles = [];
    const markup = renderToStaticMarkup(<RolesView />);
    expect(markup.length).toBeGreaterThan(0);
    estado.roles = roles;
  });
});
