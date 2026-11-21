// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const salon = vi.hoisted(() => ({
  tables: [] as unknown[],
  setTables: vi.fn(),
  accounts: [] as unknown[],
  reservations: [] as unknown[],
  notify: vi.fn(),
  isGeneral: false,
  branches: [{ id: 's-1', name: 'Miraflores', short: 'MIR' }] as unknown[],
  branchOf: vi.fn(() => ({ short: 'MIR' })),
  activeBranchId: 's-1',
  hasSession: false,
  refreshTables: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./hooks', () => ({ useSalon: () => salon }));

const api = vi.hoisted(() => ({
  createMesa: vi.fn(),
  updateMesa: vi.fn(),
  deleteMesa: vi.fn(),
}));
vi.mock('./api', () => ({ salonApi: api }));

import { SalonTablesView } from './SalonTablesView';

const mesa = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  label: 'Mesa 1',
  seats: 4,
  shape: 'rect',
  status: 'libre',
  zone: 'SalÃ³n',
  apiId: 'api-1',
  branchId: 's-1',
  ...overrides,
});

beforeEach(() => {
  salon.tables = [mesa()];
  salon.setTables.mockReset();
  salon.notify.mockReset();
  salon.refreshTables.mockReset().mockResolvedValue(undefined);
  salon.hasSession = false;
  salon.isGeneral = false;
  salon.activeBranchId = 's-1';
  for (const fn of Object.values(api)) fn.mockReset();
  api.createMesa.mockResolvedValue({});
  api.updateMesa.mockResolvedValue({});
  api.deleteMesa.mockResolvedValue({});
});

afterEach(cleanup);

describe('SalonTablesView demo', () => {
  it('crea una mesa en el estado local', () => {
    render(<SalonTablesView />);
    fireEvent.click(screen.getByText('+ Nueva mesa'));
    fireEvent.change(screen.getByDisplayValue('Mesa 2'), { target: { value: 'Mesa Terraza' } });
    fireEvent.click(screen.getByText('Guardar'));
    expect(salon.setTables).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1 }),
      expect.objectContaining({ id: 2, label: 'Mesa Terraza', status: 'libre' }),
    ]);
    expect(salon.notify).toHaveBeenCalledWith('Mesa creada', expect.any(String));
  });

  it('edita una mesa y permite una zona nueva', () => {
    render(<SalonTablesView />);
    fireEvent.click(screen.getByText('Editar'));
    fireEvent.change(screen.getByDisplayValue('Mesa 1'), { target: { value: 'Mesa Barra' } });
    fireEvent.change(screen.getByDisplayValue('SalÃ³n'), { target: { value: '__otra__' } });
    fireEvent.change(screen.getByPlaceholderText('Ej. Mezzanine'), {
      target: { value: 'Terraza' },
    });
    fireEvent.click(screen.getByText('Guardar'));
    expect(salon.setTables).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1, label: 'Mesa Barra', zone: 'Terraza' }),
    ]);
    expect(salon.notify).toHaveBeenCalledWith('Mesa actualizada', expect.any(String));
  });

  it('elimina una mesa tras confirmar', () => {
    render(<SalonTablesView />);
    fireEvent.click(screen.getByText('Eliminar'));
    fireEvent.click(screen.getAllByText('Eliminar').at(-1)!);
    expect(salon.setTables).toHaveBeenCalledWith([]);
  });
});

describe('SalonTablesView con sesiÃ³n', () => {
  it('crea desde la API y refresca el maestro', async () => {
    salon.hasSession = true;
    render(<SalonTablesView />);
    fireEvent.click(screen.getByText('+ Nueva mesa'));
    fireEvent.click(screen.getByText('Guardar'));
    await waitFor(() =>
      expect(api.createMesa).toHaveBeenCalledWith({
        numero: '2',
        capacidad: 4,
        zona: 'SalÃ³n',
        forma: 'RECTANGULAR',
      }),
    );
    expect(salon.refreshTables).toHaveBeenCalled();
    expect(salon.notify).toHaveBeenCalledWith('Mesa creada', expect.any(String));
  });

  it('exige sucursal al admin global al crear', () => {
    salon.hasSession = true;
    salon.isGeneral = true;
    salon.activeBranchId = 'todas';
    salon.branches = [];
    render(<SalonTablesView />);
    fireEvent.click(screen.getByText('+ Nueva mesa'));
    expect(screen.getByText('Guardar').closest('button')!.disabled).toBe(true);
  });

  it('edita y elimina contra la API', async () => {
    salon.hasSession = true;
    render(<SalonTablesView />);
    fireEvent.click(screen.getByText('Editar'));
    fireEvent.change(screen.getByDisplayValue('Mesa 1'), { target: { value: 'Mesa 9' } });
    fireEvent.click(screen.getByText('Guardar'));
    await waitFor(() =>
      expect(api.updateMesa).toHaveBeenCalledWith(
        'api-1',
        expect.objectContaining({ numero: '9' }),
      ),
    );

    fireEvent.click(screen.getByText('Eliminar'));
    fireEvent.click(screen.getAllByText('Eliminar').at(-1)!);
    await waitFor(() => expect(api.deleteMesa).toHaveBeenCalledWith('api-1'));
    expect(salon.notify).toHaveBeenCalledWith('Mesa eliminada', expect.any(String));
  });

  it('avisa si la API falla al guardar', async () => {
    salon.hasSession = true;
    api.createMesa.mockRejectedValue(new Error('Sin permiso'));
    render(<SalonTablesView />);
    fireEvent.click(screen.getByText('+ Nueva mesa'));
    fireEvent.click(screen.getByText('Guardar'));
    await waitFor(() =>
      expect(salon.notify).toHaveBeenCalledWith('No se pudo guardar la mesa', 'Sin permiso'),
    );
    expect(salon.refreshTables).not.toHaveBeenCalled();
  });

  it('no elimina sin identificador de la API', () => {
    salon.hasSession = true;
    salon.tables = [mesa({ apiId: undefined })];
    render(<SalonTablesView />);
    fireEvent.click(screen.getByText('Eliminar'));
    fireEvent.click(screen.getAllByText('Eliminar').at(-1)!);
    expect(salon.notify).toHaveBeenCalledWith(
      'No se pudo eliminar la mesa',
      'La mesa no tiene identificador de la API.',
    );
    expect(api.deleteMesa).not.toHaveBeenCalled();
  });
});

