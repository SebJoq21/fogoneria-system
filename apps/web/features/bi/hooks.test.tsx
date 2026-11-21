// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  pnl: vi.fn(),
  serie: vi.fn(),
  platosTop: vi.fn(),
  cobrosPorMetodo: vi.fn(),
  rangoVista: vi.fn(() => ({ desde: '2026-11-14', hasta: '2026-11-20' })),
}));

const sesion = vi.hoisted(() => ({ hasSession: true }));

vi.mock('./api', () => ({
  biApi: {
    pnl: api.pnl,
    serie: api.serie,
    platosTop: api.platosTop,
    cobrosPorMetodo: api.cobrosPorMetodo,
  },
  rangoVista: api.rangoVista,
}));
vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => sesion }));

import { useBi } from './hooks';

const pnl = {
  desde: '2026-11-14',
  hasta: '2026-11-20',
  sucursalId: null,
  ventas: 288,
  comprobado: 200,
  ventaSinComprobante: 88,
  gastos: 100,
  margen: 188,
  propinas: 40,
};

describe('useBi', () => {
  beforeEach(() => {
    sesion.hasSession = true;
    api.pnl.mockReset();
    api.serie.mockReset();
    api.platosTop.mockReset();
    api.cobrosPorMetodo.mockReset();
    api.pnl.mockResolvedValue(pnl);
    api.serie.mockResolvedValue([{ fecha: '2026-11-20', ventas: 288, gastos: 100, margen: 188 }]);
    api.platosTop.mockResolvedValue([{ platoId: 'p-1', nombre: 'Lomo', unidades: 5, ingresos: 120 }]);
    api.cobrosPorMetodo.mockResolvedValue([{ metodo: 'EFECTIVO', cobros: 4, monto: 198 }]);
  });

  it('sin sesión no llama a la API', async () => {
    sesion.hasSession = false;
    const { result } = renderHook(() => useBi());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.pnl).toBeNull();
    expect(api.pnl).not.toHaveBeenCalled();
  });

  it('carga P&L, serie, platos y métodos', async () => {
    const { result } = renderHook(() => useBi(7));
    await waitFor(() => expect(result.current.pnl).toEqual(pnl));
    expect(result.current.serie).toHaveLength(1);
    expect(result.current.platos).toHaveLength(1);
    expect(result.current.metodos).toHaveLength(1);
    expect(result.current.error).toBeNull();
    expect(api.rangoVista).toHaveBeenCalledWith(7);
  });

  it('expone el error de la carga sin romper', async () => {
    api.pnl.mockRejectedValue(new Error('API caída'));
    const { result } = renderHook(() => useBi());
    await waitFor(() => expect(result.current.error).toBe('API caída'));
    expect(result.current.pnl).toBeNull();
  });

  it('un error no-Error usa el mensaje por defecto', async () => {
    api.pnl.mockRejectedValue('boom');
    const { result } = renderHook(() => useBi());
    await waitFor(() =>
      expect(result.current.error).toBe('No se pudieron cargar las analíticas.'),
    );
  });
});
