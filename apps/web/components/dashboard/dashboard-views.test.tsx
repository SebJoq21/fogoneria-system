import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PaymentsView } from './PaymentsView';
import { SettingsView } from './SettingsView';
import { SupportView } from './SupportView';
import type { Payment, Ticket } from '@/lib/dashboard';

const pago: Payment = {
  id: 1,
  date: '01 Ago 2026',
  concept: 'Plan Profesional',
  amount: '$70.00',
  status: 'Pagado',
  type: 'plan',
  day: 1,
};

const ticket: Ticket = {
  id: '#TK-0012',
  subject: 'Actualizar menú',
  status: 'En proceso',
  updated: 'Hoy',
};

describe('PaymentsView', () => {
  it('pinta el historial de pagos', () => {
    const markup = renderToStaticMarkup(<PaymentsView paymentHistory={[pago]} />);
    expect(markup).toContain('Plan Profesional');
    expect(markup).toContain('$70.00');
  });

  it('sin pagos pinta el estado vacío', () => {
    const markup = renderToStaticMarkup(<PaymentsView paymentHistory={[]} />);
    expect(markup.length).toBeGreaterThan(0);
  });
});

describe('SupportView', () => {
  it('pinta los tickets y el botón de alta', () => {
    const markup = renderToStaticMarkup(
      <SupportView tickets={[ticket]} setTickets={() => {}} onNotify={() => {}} />,
    );
    expect(markup).toContain('Actualizar menú');
    expect(markup).toContain('En proceso');
    expect(markup).toContain('Crear nuevo ticket');
  });

  it('sin tickets pinta el vacío', () => {
    const markup = renderToStaticMarkup(
      <SupportView tickets={[]} setTickets={() => {}} onNotify={() => {}} />,
    );
    expect(markup.length).toBeGreaterThan(0);
  });
});

describe('SettingsView', () => {
  it('pinta los datos del negocio y la seguridad', () => {
    const markup = renderToStaticMarkup(<SettingsView onNotify={() => {}} />);
    expect(markup).toContain('Mi Restaurante');
    expect(markup).toContain('RUC');
    expect(markup).toContain('Seguridad');
  });
});
