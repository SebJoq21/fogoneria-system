// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/dashboard/providers/session', () => ({
  useSession: () => ({ currentUser: null }),
}));

import { InventoryProvider, useInventory } from './provider';
import { initialIngredients, initialMovements } from '@/lib/erp';

function Probe() {
  const { ingredients, setIngredients, movements, setMovements, resetInventory } = useInventory();
  return (
    <div>
      <span data-testid="ingredients">{ingredients.length}</span>
      <span data-testid="movements">{movements.length}</span>
      <button type="button" onClick={() => setIngredients(ingredients.slice(0, 1))}>
        recortar insumos
      </button>
      <button type="button" onClick={() => setMovements(movements.slice(0, 2))}>
        recortar kardex
      </button>
      <button type="button" onClick={resetInventory}>
        reiniciar
      </button>
    </div>
  );
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('InventoryProvider', () => {
  it('hidrata el demo y persiste insumos y kardex sin pisarse', async () => {
    render(
      <InventoryProvider>
        <Probe />
      </InventoryProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('ingredients').textContent).toBe(String(initialIngredients.length)),
    );
    expect(screen.getByTestId('movements').textContent).toBe(String(initialMovements.length));

    fireEvent.click(screen.getByText('recortar insumos'));
    expect(screen.getByTestId('ingredients').textContent).toBe('1');
    expect(screen.getByTestId('movements').textContent).toBe(String(initialMovements.length));

    fireEvent.click(screen.getByText('recortar kardex'));
    expect(screen.getByTestId('ingredients').textContent).toBe('1');
    expect(screen.getByTestId('movements').textContent).toBe('2');

    const saved = JSON.parse(localStorage.getItem('fogoneria:inventory:v1:anon') ?? '{}');
    expect(saved.ingredients).toHaveLength(1);
    expect(saved.movements).toHaveLength(2);
  });

  it('reinicia el inventario demo', async () => {
    render(
      <InventoryProvider>
        <Probe />
      </InventoryProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('ingredients').textContent).toBe(String(initialIngredients.length)),
    );

    fireEvent.click(screen.getByText('recortar insumos'));
    fireEvent.click(screen.getByText('reiniciar'));
    await waitFor(() =>
      expect(screen.getByTestId('ingredients').textContent).toBe(String(initialIngredients.length)),
    );
  });
});
