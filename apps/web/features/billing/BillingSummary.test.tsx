// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ resumen: vi.fn() }));
vi.mock('./api', () => ({ billingApi: api }));

import { BillingSummary } from './BillingSummary';

beforeEach(() => api.resumen.mockReset());
afterEach(cleanup);

describe('BillingSummary', () => {
  it('pinta el MRR y la distribución de estados', async () => {
    api.resumen.mockResolvedValue({
      mrr: 480.5,
      total: 5,
      trial: 2,
      active: 2,
      suspended: 1,
      expired: 0,
    });
    render(<BillingSummary />);
    await waitFor(() => expect(screen.getByText('$480.50')).toBeTruthy());
    expect(screen.getByText('Facturación')).toBeTruthy();
    expect(screen.getByText('Activas')).toBeTruthy();
  });
});
