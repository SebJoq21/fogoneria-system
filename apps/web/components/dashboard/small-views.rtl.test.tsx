// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  hasSession: false,
  movements: [] as unknown[],
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

const api = vi.hoisted(() => ({ movimientos: vi.fn(), stock: vi.fn() }));
vi.mock('@/features/inventory/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/inventory/api')>()),
  inventarioApi: api,
}));

import { SettingsView } from './SettingsView';
import { SupportView } from './SupportView';
import { MovementsPage } from '@/features/inventory/MovementsPage';
import type { Ticket } from '@/lib/dashboard';

const movimiento = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  datetime: 'Hoy 10:00',
  type: 'Entrada',
  ingredient: 'Lomo',
  qty: '+5 kg',
  reason: 'Compra',
  ...overrides,
});

beforeEach(() => {
  estado.hasSession = false;
  estado.movements = [
    movimiento(),
    movimiento({ id: 2, type: 'Salida', ingredient: 'Ají', qty: '-2 kg', reason: 'Receta' }),
    movimiento({ id: 3, type: 'Ajuste', ingredient: 'Sal', qty: '+1 kg', reason: 'Conteo' }),
  ];
  for (const fn of Object.values(api)) fn.mockReset();
  api.movimientos.mockResolvedValue({ sucursalId: 's-1', items: [] });
  api.stock.mockResolvedValue({ sucursalId: 's-1', resumen: { total: 4, agotados: 1, bajos: 1, optimos: 2 }, items: [] });
});

afterEach(cleanup);

describe('SettingsView', () => {
  it('guarda la información del restaurante', () => {
    const onNotify = vi.fn();
    render(<SettingsView onNotify={onNotify} />);
    fireEvent.change(screen.getByDisplayValue('Mi Restaurante S.A.C.'), {
      target: { value: 'Fogonería SAC' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Información' }));
    expect(onNotify).toHaveBeenCalledWith('Datos actualizados', expect.any(String));
  });

  it('valida y completa el cambio de contraseña en dos pasos', () => {
    const onNotify = vi.fn();
    render(<SettingsView onNotify={onNotify} />);

    fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), {
      target: { value: 'nueva123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar Seguridad' }));
    expect(screen.queryByText('Código de verificación')).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'actual123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar Seguridad' }));
    expect(screen.getByText('Código de verificación')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: 'Actualizar Seguridad' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar Seguridad' }));
    fireEvent.change(screen.getByPlaceholderText('0 0 0 0 0 0'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar y Guardar' }));
    expect(onNotify).toHaveBeenCalledWith('Seguridad actualizada', expect.any(String));
    expect(screen.getByRole('button', { name: 'Actualizar Seguridad' })).toBeTruthy();
  });
});

describe('SupportView', () => {
  it('muestra el vacío y crea un ticket', () => {
    const setTickets = vi.fn();
    const onNotify = vi.fn();
    render(<SupportView tickets={[]} setTickets={setTickets} onNotify={onNotify} />);
    expect(screen.getByText('No tienes tickets de soporte activos.')).toBeTruthy();

    fireEvent.click(screen.getByText('Crear nuevo ticket'));
    expect(screen.getByText('Crear Ticket de Soporte')).toBeTruthy();
    const enviar = screen.getByRole('button', { name: /Enviar/i });
    expect((enviar as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText(/Problema con mis reservas/), {
      target: { value: 'No imprime' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Explica qu/), {
      target: { value: 'La impresora no responde' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Enviar/i }));
    expect(setTickets).toHaveBeenCalledWith([
      expect.objectContaining({ subject: 'No imprime', status: 'Enviado' }),
    ]);
    expect(onNotify).toHaveBeenCalledWith('Ticket enviado', expect.stringContaining('No imprime'));
  });

  it('lista los tickets existentes', () => {
    const tickets: Ticket[] = [
      { id: '#TK-1001', subject: 'Cobro', status: 'En revisión', updated: 'Hoy' },
    ];
    render(<SupportView tickets={tickets} setTickets={() => {}} onNotify={() => {}} />);
    expect(screen.getByText('#TK-1001')).toBeTruthy();
    expect(screen.getByText('En revisión')).toBeTruthy();
  });
});

describe('MovementsPage', () => {
  it('filtra el kardex demo por tipo', () => {
    render(<MovementsPage />);
    expect(screen.getByText('Lomo')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Salidas' }));
    expect(screen.queryByText('Lomo')).toBeNull();
    expect(screen.getByText('Ají')).toBeTruthy();
  });

  it('carga el kardex y el semáforo de la API', async () => {
    estado.hasSession = true;
    api.movimientos.mockResolvedValue({
      sucursalId: 's-1',
      items: [
        {
          id: 'mv-1',
          fecha: '2026-11-20T10:00:00.000Z',
          tipo: 'SALIDA',
          insumoId: 'i-1',
          insumo: 'Lomo',
          unidad: 'kg',
          cantidad: -2,
          stockResultante: 3,
          motivo: 'Receta',
          orden: 'ORD-1',
        },
      ],
    });
    render(<MovementsPage />);
    await waitFor(() => expect(api.movimientos).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/Semáforo:/)).toBeTruthy());
    expect(screen.getByText('Lomo')).toBeTruthy();
    expect(screen.getByText('Receta')).toBeTruthy();
  });

  it('muestra el error del kardex de la API', async () => {
    estado.hasSession = true;
    api.movimientos.mockRejectedValue(new Error('Kardex caído'));
    render(<MovementsPage />);
    await waitFor(() => expect(api.movimientos).toHaveBeenCalled());
    expect(screen.queryByText(/Semáforo:/)).toBeNull();
  });
});
