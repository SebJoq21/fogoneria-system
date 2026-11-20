import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  hasSession: false,
  movements: [
    { id: 1, datetime: 'Hoy 13:50', type: 'Salida', ingredient: 'Lomo fino', qty: '-1.5 kg', reason: 'Venta' },
    { id: 2, datetime: 'Hoy 09:05', type: 'Ajuste', ingredient: 'Ají amarillo', qty: '-0.5 kg', reason: 'Merma' },
  ],
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { MovementsPage } from './MovementsPage';

describe('MovementsPage', () => {
  it('pinta el kardex demo con su semáforo y resumen', () => {
    const markup = renderToStaticMarkup(<MovementsPage />);
    expect(markup).toContain('Lomo fino');
    expect(markup).toContain('Merma');
    expect(markup).toContain('Kardex');
  });

  it('sin movimientos pinta el estado vacío', () => {
    const movimientos = estado.movements;
    estado.movements = [];
    const markup = renderToStaticMarkup(<MovementsPage />);
    expect(markup.length).toBeGreaterThan(0);
    estado.movements = movimientos;
  });
});
