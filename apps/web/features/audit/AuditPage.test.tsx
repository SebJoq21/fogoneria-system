// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('./api', () => ({ auditApi: api }));

import { AuditPage } from './AuditPage';

const evento = {
  id: 'a-1',
  empresaId: 'e-1',
  sucursalId: null,
  usuarioId: 'u-1',
  accion: 'CREATE',
  entidad: 'orden',
  entidadId: 'o-1',
  detalle: { total: 24.9 },
  ip: null,
  createdAt: '2026-11-21T10:00:00.000Z',
};

beforeEach(() => api.list.mockReset());
afterEach(cleanup);

describe('AuditPage', () => {
  it('pinta los eventos de la empresa', async () => {
    api.list.mockResolvedValue({ items: [evento] });
    render(<AuditPage />);
    await waitFor(() => expect(screen.getByText('CREATE')).toBeTruthy());
    expect(screen.getByText('orden')).toBeTruthy();
    expect(screen.getByText('u-1')).toBeTruthy();
  });

  it('muestra el vacío', async () => {
    api.list.mockResolvedValue({ items: [] });
    render(<AuditPage />);
    await waitFor(() => expect(screen.getByText(/A.n no hay eventos/)).toBeTruthy());
  });
});
