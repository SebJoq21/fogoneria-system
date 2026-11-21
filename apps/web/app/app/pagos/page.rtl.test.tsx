// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  payments: [] as unknown[],
  notify: vi.fn(),
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));
vi.mock('@/components/dashboard/PaymentsView', () => ({
  PaymentsView: ({ paymentHistory }: { paymentHistory: unknown[] }) => (
    <div>pagos:{paymentHistory.length}</div>
  ),
}));
vi.mock('@/components/dashboard/PlanModals', () => ({
  PlanModal: ({
    selectedPlan,
    setSelectedPlan,
    onContinue,
    onClose,
  }: {
    selectedPlan: string;
    setSelectedPlan: (plan: string) => void;
    onContinue: () => void;
    onClose: () => void;
  }) => (
    <div>
      <span>plan:{selectedPlan}</span>
      <button type="button" onClick={() => setSelectedPlan('basico')}>
        Elegir básico
      </button>
      <button type="button" onClick={onContinue}>
        Continuar plan
      </button>
      <button type="button" onClick={onClose}>
        Cerrar plan
      </button>
    </div>
  ),
  SecurityModal: ({
    onConfirmPlanChange,
    onClose,
  }: {
    onConfirmPlanChange: () => void;
    onClose: () => void;
  }) => (
    <div>
      <button type="button" onClick={onConfirmPlanChange}>
        Confirmar plan
      </button>
      <button type="button" onClick={onClose}>
        Cerrar seguridad
      </button>
    </div>
  ),
}));

import PagosPage from './page';

beforeEach(() => {
  estado.payments = [{ id: 1 }, { id: 2 }];
  estado.notify.mockReset();
});

afterEach(cleanup);

describe('PagosPage', () => {
  it('abre el plan, cambia a básico y confirma la suscripción', () => {
    render(<PagosPage />);
    expect(screen.getByText(/Plan Profesional/)).toBeTruthy();
    expect(screen.getByText('pagos:2')).toBeTruthy();

    fireEvent.click(screen.getByText('Gestionar suscripción'));
    expect(screen.getByText('plan:profesional')).toBeTruthy();
    fireEvent.click(screen.getByText('Elegir básico'));
    fireEvent.click(screen.getByText('Continuar plan'));
    fireEvent.click(screen.getByText('Confirmar plan'));

    expect(estado.notify).toHaveBeenCalledWith(
      'Plan actualizado con éxito',
      'Has cambiado al Plan Básico.',
    );
    expect(screen.getByText(/Plan Básico/)).toBeTruthy();
    expect(screen.queryByText('Confirmar plan')).toBeNull();
  });

  it('cierra el modal de plan sin abrir seguridad', () => {
    render(<PagosPage />);
    fireEvent.click(screen.getByText('Gestionar suscripción'));
    fireEvent.click(screen.getByText('Cerrar plan'));
    expect(screen.queryByText('Confirmar plan')).toBeNull();
    expect(screen.getByText(/Plan Profesional/)).toBeTruthy();
  });

  it('cierra la verificación de seguridad sin cambiar el plan', () => {
    render(<PagosPage />);
    fireEvent.click(screen.getByText('Gestionar suscripción'));
    fireEvent.click(screen.getByText('Continuar plan'));
    fireEvent.click(screen.getByText('Cerrar seguridad'));
    expect(estado.notify).not.toHaveBeenCalled();
    expect(screen.getByText(/Plan Profesional/)).toBeTruthy();
  });
});
