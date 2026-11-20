import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  expenses: [] as unknown[],
  setExpenses: () => {},
  notify: () => {},
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { GastosPage } from './GastosPage';

describe('GastosPage', () => {
  it('pinta el panel de gastos y su acceso a registrar', () => {
    const markup = renderToStaticMarkup(<GastosPage />);
    expect(markup).toContain('Registrar gasto');
    expect(markup).toContain('Gastos por categoría');
  });

  it('el resumen sale de los gastos del provider', () => {
    estado.expenses = [
      { id: 1, date: 'Hoy', category: 'Insumos', supplier: 'Gas Perú', amount: '$120.00', status: 'Pagado' },
    ];
    const markup = renderToStaticMarkup(<GastosPage />);
    expect(markup).toContain('$120.00');
    expect(markup).toContain('1 registros');
    estado.expenses = [];
  });
});
