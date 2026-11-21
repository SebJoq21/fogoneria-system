import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const asistencia = vi.hoisted(() => ({
  empleados: [
    { id: 'e-1', nombre: 'Ana', sucursalId: 's-1', activo: true, rol: 'Mesero' },
  ],
  asistencias: [
    {
      id: 'a-1',
      empleadoId: 'e-1',
      empleado: 'Ana',
      fecha: '2026-11-20',
      estado: 'PRESENTE',
      horaEntrada: '2026-11-20T14:00:00.000Z',
      horaSalida: null,
      fuente: 'PIN',
    },
  ],
  pozos: [],
  loading: false,
  error: null,
  refresh: () => {},
  marcar: () => {},
  calcularPozo: () => {},
  confirmarPozo: () => {},
}));

vi.mock('./hooks', () => ({ useAttendance: () => asistencia }));

const estado = vi.hoisted(() => ({ hasSession: true }));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { StaffAttendancePage } from './AttendancePage';

describe('StaffAttendancePage', () => {
  it('con sesión pinta la asistencia desde la API', () => {
    estado.hasSession = true;
    const markup = renderToStaticMarkup(<StaffAttendancePage />);
    expect(markup).toContain('Colaborador');
    expect(markup).toContain('Ana');
    expect(markup).toContain('Calcular pozo de hoy');
  });

  it('sin sesión cae al demo', () => {
    estado.hasSession = false;
    const markup = renderToStaticMarkup(<StaffAttendancePage />);
    expect(markup.length).toBeGreaterThan(0);
    expect(markup).not.toContain('Calcular pozo de hoy');
  });
});
