// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const notFound = vi.hoisted(() => vi.fn(() => {
  throw new Error('not-found');
}));
vi.mock('next/navigation', () => ({ notFound }));

vi.mock('@/features/crm', () => ({ LoyaltyHubPage: () => <div>loyalty-hub</div> }));
vi.mock('@/features/inventory', () => ({ InventoryHubPage: () => <div>inventory-hub</div> }));
vi.mock('@/features/reservations', () => ({
  BookingsWorkspace: () => <div>bookings-workspace</div>,
}));
vi.mock('@/features/staff', () => ({
  StaffWorkspace: () => <div>staff-workspace</div>,
}));

import { ModuleBody, ModuleGuard, moduleMeta } from './ModuleGate';

afterEach(() => {
  cleanup();
  notFound.mockClear();
});

describe('ModuleGate', () => {
  it('resuelve los metadatos de un módulo y corta con notFound si no existe', () => {
    expect(moduleMeta('reservas')).toMatchObject({ title: 'Reservas' });
    expect(() => moduleMeta('no-existe')).toThrow('not-found');
    expect(notFound).toHaveBeenCalled();
  });

  it('deja pasar a los hijos sin paywall', () => {
    render(
      <ModuleGuard id="reservas">
        <span>contenido</span>
      </ModuleGuard>,
    );
    expect(screen.getByText('contenido')).toBeTruthy();
  });

  it.each([
    ['fidelizacion', 'loyalty-hub'],
    ['reservas', 'bookings-workspace'],
    ['inventario', 'inventory-hub'],
    ['personal', 'staff-workspace'],
  ])('pinta el cuerpo de %s', (id, expected) => {
    render(<ModuleBody id={id} />);
    expect(screen.getByText(expected)).toBeTruthy();
  });

  it('pinta el encabezado de un módulo sin cuerpo especial', () => {
    render(<ModuleBody id="reservas" />);
    expect(screen.getByText('Reservas')).toBeTruthy();
    expect(screen.getByText(/reservar mesas online/)).toBeTruthy();
  });
});
