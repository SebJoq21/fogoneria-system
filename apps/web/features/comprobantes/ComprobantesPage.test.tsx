import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const hoy = new Date().toISOString();

const estado = vi.hoisted(() => ({
  hasSession: false,
  receipts: [] as unknown[],
  setReceipts: () => {},
  annulReceipt: () => {},
  enviarSunat: () => {},
  generarResumenDiario: () => {},
  sunatContingencia: false,
  toggleSunatContingencia: () => {},
  notify: () => {},
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { ComprobantesPage } from './ComprobantesPage';

describe('ComprobantesPage', () => {
  it('pinta el panel demo de comprobantes con sus KPIs', () => {
    const markup = renderToStaticMarkup(<ComprobantesPage />);
    expect(markup).toContain('Emitir comprobante');
    expect(markup).toContain('Pagadas vs anuladas');
    expect(markup).toContain('series B001/F001/NC01');
  });

  it('sin comprobantes el panel queda en cero', () => {
    const markup = renderToStaticMarkup(<ComprobantesPage />);
    expect(markup).toContain('>0<');
    expect(markup).toContain('sin anulaciones');
  });

  it('con comprobantes pagados y anulados resume los importes', () => {
    estado.receipts = [
      {
        id: 'B001-1',
        type: '03',
        at: hoy,
        date: 'Hoy',
        customer: 'Ana',
        docType: '',
        docNumber: '',
        subtotal: 50,
        igv: 9,
        total: 59,
        status: 'Pagada',
        source: 'Mesa 4',
        estadoSunat: 'aceptado',
        intentosEnvio: 1,
      },
      {
        id: 'B001-2',
        type: '03',
        at: hoy,
        date: 'Hoy',
        customer: 'Luis',
        docType: '',
        docNumber: '',
        subtotal: 10,
        igv: 1.8,
        total: 11.8,
        status: 'Anulada',
        source: 'Mesa 2',
        estadoSunat: 'anulado',
        intentosEnvio: 0,
        motivoAnulacion: 'Duplicado',
      },
    ];
    const markup = renderToStaticMarkup(<ComprobantesPage />);
    expect(markup).toContain('requieren revisión');
    expect(markup).toContain('$59.00');
    estado.receipts = [];
  });
});
