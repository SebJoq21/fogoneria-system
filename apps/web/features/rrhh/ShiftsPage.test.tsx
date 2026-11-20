import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const turnos = vi.hoisted(() => ({
  fecha: '2026-11-20',
  setFecha: () => {},
  empleados: [
    { id: 'e-1', nombre: 'Ana', sucursalId: 's-1', activo: true, rol: 'Mesero' },
    { id: 'e-2', nombre: 'Luis', sucursalId: 's-1', activo: true, rol: 'Cocinero' },
  ],
  turnos: [
    { id: 't-1', empleadoId: 'e-1', empleado: 'Ana', fecha: '2026-11-20', bloque: 'TARDE' },
  ],
  loading: false,
  error: null as string | null,
  asignar: () => {},
  quitar: () => {},
}));

vi.mock('./hooks', () => ({ useShifts: () => turnos }));
vi.mock('@/components/dashboard/ModulesProvider', () => ({
  useModules: () => ({ notify: () => {}, hasSession: true }),
}));

import { StaffShiftsPage } from './ShiftsPage';

describe('StaffShiftsPage', () => {
  it('pinta el plan de turnos con sus empleados', () => {
    const markup = renderToStaticMarkup(<StaffShiftsPage />);
    expect(markup).toContain('Ana');
    expect(markup).toContain('Tarde');
    expect(markup).toContain('2026-11-20');
  });

  it('un error de carga se muestra sin romper el plan', () => {
    turnos.error = 'No se pudo cargar el plan';
    const markup = renderToStaticMarkup(<StaffShiftsPage />);
    expect(markup).toContain('No se pudo cargar el plan');
    turnos.error = null;
  });
});
