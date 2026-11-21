import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Fija el reloj en un momento donde UTC ya es 21 pero en Lima todavía es 20:
// la agenda filtra por día de Lima, no por `toISOString()`.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-21T01:20:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

const hoy = '2026-11-20T20:00:00.000Z';

const salon = vi.hoisted(() => ({
  tables: [
    { id: 1, label: 'Mesa 1', seats: 2, shape: 'round', status: 'libre', zone: 'Terraza' },
    { id: 2, label: 'Mesa 2', seats: 4, shape: 'rect', status: 'libre', zone: 'Salón' },
  ],
  setTables: () => {},
  reservations: [],
  setReservations: () => {},
  accounts: [],
  openAccount: () => {},
  currentUser: { id: 'u-1', name: 'Diego', role: 'sucursal', empresaId: 'e-1', branchId: 's-1' },
  hasSession: false,
  notify: () => {},
  refreshTables: () => {},
  refreshReservations: () => {},
  tablesLoading: false,
  tablesError: null as string | null,
  reservationsLoading: false,
  reservationsError: null as string | null,
}));

vi.mock('./hooks', () => ({
  useSalon: () => salon,
  useSalonEnVivo: () => ({ status: 'offline', lastEvent: null }),
}));

import { BookingsModule } from './BookingsModule';

describe('BookingsModule', () => {
  it('pinta el mapa de mesas con el resumen del salón', () => {
    const markup = renderToStaticMarkup(<BookingsModule />);
    expect(markup).toContain('Mesa 1');
    expect(markup).toContain('Mesa 2');
    expect(markup).toContain('Resumen de mesas');
  });

  it('la agenda muestra la fecha y el estado vacío', () => {
    const markup = renderToStaticMarkup(<BookingsModule view="agenda" />);
    expect(markup).toContain('Reservas del día');
    expect(markup).toContain('Sin reservas para esta fecha');
  });

  it('un error de mesas se pinta sin romper el mapa', () => {
    salon.tablesError = 'No se pudieron cargar las mesas';
    const markup = renderToStaticMarkup(<BookingsModule />);
    expect(markup).toContain('No se pudieron cargar las mesas');
    salon.tablesError = null;
  });

  it('una reserva de hoy aparece en la agenda', () => {
    salon.reservations = [
      {
        id: 'RS-1',
        customer: 'Camila Duarte',
        guests: 4,
        phone: '+51 987 442 019',
        date: hoy,
        time: '20:00',
        status: 'confirmada',
        notes: '',
        tableId: 1,
      },
    ] as never;
    const markup = renderToStaticMarkup(<BookingsModule view="agenda" />);
    expect(markup).toContain('Camila Duarte');
    salon.reservations = [];
  });
});
