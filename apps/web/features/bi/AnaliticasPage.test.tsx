import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const bi = vi.hoisted(() => ({
  pnl: {
    desde: '2026-11-14',
    hasta: '2026-11-20',
    sucursalId: null,
    ventas: 288,
    comprobado: 200,
    ventaSinComprobante: 88,
    gastos: 100,
    margen: 188,
    propinas: 40,
  },
  serie: [{ fecha: '2026-11-20', ventas: 288, gastos: 100, margen: 188 }],
  platos: [{ platoId: 'p-1', sku: 'LOM', nombre: 'Lomo', unidades: 5, ingresos: 120 }],
  metodos: [{ metodo: 'EFECTIVO', cobros: 4, monto: 198 }],
  error: null,
}));

vi.mock('./hooks', () => ({ useBi: () => bi }));

const estado = vi.hoisted(() => ({ expenses: [] }));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { AnaliticasPage } from './AnaliticasPage';

describe('AnaliticasPage', () => {
  it('pinta el P&L, la serie y el ranking', () => {
    const markup = renderToStaticMarkup(<AnaliticasPage />);
    expect(markup).toContain('Ventas');
    expect(markup).toContain('Lomo');
    expect(markup).toContain('Efectivo');
  });

  it('sin datos de la API cae al demo del provider', () => {
    bi.pnl = null as never;
    bi.serie = [];
    bi.platos = [];
    bi.metodos = [];
    const markup = renderToStaticMarkup(<AnaliticasPage />);
    expect(markup.length).toBeGreaterThan(0);
  });
});
