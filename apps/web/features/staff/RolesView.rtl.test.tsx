// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  roles: [] as unknown[],
  setRoles: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { RolesView } from './RolesView';

beforeEach(() => {
  estado.roles = [
    { id: 'mozo', name: 'Mozo', description: 'Atiende mesas' },
    { id: 'anfitrion', name: 'Anfitrión', description: 'Recibe' },
  ];
  estado.setRoles.mockReset();
  estado.notify.mockReset();
});

afterEach(cleanup);

describe('RolesView', () => {
  it('crea un rol nuevo', () => {
    render(<RolesView />);
    fireEvent.click(screen.getByText('+ Nuevo rol'));
    fireEvent.change(screen.getByPlaceholderText(/Anfitri/), { target: { value: 'Anfitrión' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(estado.setRoles).toHaveBeenCalledWith([
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({ id: 'anfitri-n', name: 'Anfitrión' }),
    ]);
    expect(estado.notify).toHaveBeenCalledWith('Rol creado', expect.any(String));
  });

  it('edita la descripción de un rol', () => {
    render(<RolesView />);
    fireEvent.click(screen.getAllByText('Editar')[0]!);
    fireEvent.change(screen.getByDisplayValue('Atiende mesas'), {
      target: { value: 'Atiende y cobra' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(estado.setRoles).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'mozo', description: 'Atiende y cobra' }),
      expect.any(Object),
    ]);
  });

  it('protege el rol con empleados y elimina el libre', () => {
    render(<RolesView />);
    fireEvent.click(screen.getAllByText('Eliminar')[0]!);
    fireEvent.click(screen.getAllByText('Eliminar').at(-1)!);
    expect(estado.setRoles).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByText('Eliminar')[1]!);
    fireEvent.click(screen.getAllByText('Eliminar').at(-1)!);
    expect(estado.setRoles).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'mozo' }),
    ]);
  });
});
