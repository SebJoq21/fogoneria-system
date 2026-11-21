// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
  products: [] as unknown[],
  ingredients: [] as unknown[],
  setIngredients: vi.fn(),
  movements: [] as unknown[],
  setMovements: vi.fn(),
  combos: [] as unknown[],
  setCombos: vi.fn(),
  coupons: [] as unknown[],
  setCoupons: vi.fn(),
  expenses: [] as unknown[],
  setExpenses: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('@/components/dashboard/ModulesProvider', () => ({ useModules: () => estado }));

import { CombosPage } from './promotions/CombosPage';
import { GastosPage } from './expenses/GastosPage';
import { InventoryPage } from './inventory/InventoryPage';
import { PromocionesPage } from './promotions/PromocionesPage';

const insumo = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Lomo',
  category: 'Carnes',
  stock: 5,
  min: 3,
  unit: 'kg',
  state: 'Óptimo',
  ...overrides,
});

const plato = (overrides: Record<string, unknown> = {}) => ({
  id: 'p-1',
  name: 'Lomo Saltado',
  sku: 'LOM',
  categoryId: 'c-1',
  price: 24.9,
  status: 'Activo',
  ...overrides,
});

const combo = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Dúo Criollo',
  description: 'Para compartir',
  productIds: ['p-1'],
  price: 39.9,
  status: 'Activo',
  ...overrides,
});

beforeEach(() => {
  estado.products = [plato(), plato({ id: 'p-2', name: 'Chicha', sku: 'CHI', status: 'Activo' })];
  estado.ingredients = [
    insumo(),
    insumo({ id: 2, name: 'Ají', stock: 0, min: 2, state: 'Agotado' }),
  ];
  estado.movements = [{ id: 1, datetime: 'Ayer', type: 'Entrada', ingredient: 'Lomo', qty: '+2 kg', reason: 'Compra' }];
  estado.combos = [combo(), combo({ id: 2, name: 'Retirado', productIds: ['p-9'] })];
  estado.coupons = [{ code: 'BURGER10', discount: '10% OFF', used: 2, limit: 10, expires: '30 Nov 2026' }];
  estado.expenses = [
    { id: 1, date: 'Hoy', category: 'Insumos', supplier: 'AgroAndina', amount: '$120.00', status: 'Pagado' },
    { id: 2, date: 'Ayer', category: 'Servicios', supplier: 'Luz', amount: '$80.00', status: 'Pendiente' },
  ];
  for (const fn of [
    estado.setIngredients,
    estado.setMovements,
    estado.setCombos,
    estado.setCoupons,
    estado.setExpenses,
    estado.notify,
  ]) {
    fn.mockReset();
  }
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});

afterEach(cleanup);

describe('InventoryPage', () => {
  it('muestra la alerta crítica y ajusta stock al alza', () => {
    render(<InventoryPage />);
    expect(screen.getByText(/nivel crítico/)).toBeTruthy();
    fireEvent.click(screen.getAllByText('+ Ajustar Stock')[0]!);
    fireEvent.change(screen.getByPlaceholderText('Ej. 5 o -2'), { target: { value: '5' } });
    fireEvent.click(screen.getByText('Aplicar ajuste'));
    expect(estado.setIngredients).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1, stock: 10, state: 'Óptimo' }),
      expect.any(Object),
    ]);
    expect(estado.setMovements).toHaveBeenCalled();
    expect(estado.notify).toHaveBeenCalledWith('Stock ajustado', expect.stringContaining('10 kg'));
  });

  it('descuenta stock sin bajar de cero', () => {
    estado.ingredients = [insumo({ stock: 1 })];
    render(<InventoryPage />);
    fireEvent.click(screen.getByText('+ Ajustar Stock'));
    fireEvent.change(screen.getByPlaceholderText('Ej. 5 o -2'), { target: { value: '-9' } });
    fireEvent.click(screen.getByText('Aplicar ajuste'));
    expect(estado.setIngredients).toHaveBeenCalledWith([
      expect.objectContaining({ stock: 0, state: 'Agotado' }),
    ]);
  });

  it('guarda la ficha técnica del escandallo', () => {
    render(<InventoryPage />);
    fireEvent.click(screen.getByText('Escandallo (ficha técnica)'));
    fireEvent.change(screen.getByPlaceholderText('Cant.'), { target: { value: '2' } });
    fireEvent.click(screen.getByText('+ Añadir ingrediente'));
    expect(screen.getAllByPlaceholderText('Cant.')).toHaveLength(2);
    fireEvent.click(screen.getByText('Guardar ficha'));
    expect(estado.notify).toHaveBeenCalledWith('Escandallo guardado', expect.stringContaining('Lomo Saltado'));
  });

  it('filtra solo los insumos críticos', () => {
    render(<InventoryPage onlyCritical />);
    expect(screen.queryByText('Lomo')).toBeNull();
    expect(screen.getByText('Ají')).toBeTruthy();
  });
});

describe('CombosPage', () => {
  it('crea un combo con dos platos', () => {
    render(<CombosPage />);
    fireEvent.click(screen.getByText('+ Nuevo combo'));
    fireEvent.change(screen.getByPlaceholderText(/D.o Criollo/), { target: { value: 'Trío' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '59' } });
    fireEvent.click(screen.getByText('Lomo Saltado'));
    fireEvent.click(screen.getByText('Chicha'));
    fireEvent.click(screen.getByText('Guardar combo'));
    expect(estado.setCombos).toHaveBeenCalledWith([
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({ name: 'Trío', price: 59, productIds: ['p-1', 'p-2'] }),
    ]);
    expect(estado.notify).toHaveBeenCalledWith('Combo creado', expect.any(String));
  });

  it('edita un combo y muestra platos retirados', () => {
    render(<CombosPage />);
    expect(screen.getByText(/Plato retirado/)).toBeTruthy();
    fireEvent.click(screen.getAllByText('Editar')[0]!);
    fireEvent.change(screen.getByDisplayValue('Dúo Criollo'), { target: { value: 'Dúo Nuevo' } });
    fireEvent.click(screen.getByText('Guardar combo'));
    expect(estado.setCombos).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1, name: 'Dúo Nuevo' }),
      expect.any(Object),
    ]);
    expect(estado.notify).toHaveBeenCalledWith('Combo actualizado', expect.any(String));
  });

  it('bloquea el guardado sin platos', () => {
    render(<CombosPage />);
    fireEvent.click(screen.getByText('+ Nuevo combo'));
    expect(screen.getByText('Guardar combo').closest('button')!.disabled).toBe(true);
  });
});

describe('PromocionesPage', () => {
  it('crea un cupón y lo pinta en la lista', () => {
    render(<PromocionesPage />);
    fireEvent.click(screen.getByText('+ Crear Cupón'));
    fireEvent.change(screen.getByPlaceholderText('BURGER10'), { target: { value: 'pisco5' } });
    fireEvent.change(screen.getByPlaceholderText('10% OFF'), { target: { value: '$5 OFF' } });
    fireEvent.change(screen.getByPlaceholderText('100'), { target: { value: '5' } });
    fireEvent.click(screen.getAllByText('Crear cupón').at(-1)!);
    expect(estado.setCoupons).toHaveBeenCalledWith([
      expect.objectContaining({ code: 'PISCO5', discount: '$5 OFF', limit: 5 }),
      expect.any(Object),
    ]);
    expect(estado.notify).toHaveBeenCalledWith('Cupón creado', expect.stringContaining('PISCO5'));
  });

  it('pausa y reactiva una promoción programada', () => {
    render(<PromocionesPage />);
    fireEvent.click(screen.getByLabelText('Activar Happy Hour Pisco'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Pausar' }).at(-1)!);
    expect(estado.notify).toHaveBeenCalledWith('Promoción pausada', '"Happy Hour Pisco".');

    fireEvent.click(screen.getByLabelText('Activar Domingo Familiar'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Activar' }).at(-1)!);
    expect(estado.notify).toHaveBeenCalledWith('Promoción activada', '"Domingo Familiar".');
  });
});

describe('GastosPage', () => {
  it('registra un gasto desde la pestaña de gestión', () => {
    render(<GastosPage />);
    fireEvent.click(screen.getByText('Gastos registrados'));
    expect(screen.getByText(/Total registrado/)).toBeTruthy();
    fireEvent.click(screen.getByText('+ Registrar gasto'));
    fireEvent.change(screen.getByPlaceholderText('Ej. AgroAndina'), { target: { value: 'Verduras SAC' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '150' } });
    fireEvent.click(screen.getByText('Guardar gasto'));
    expect(estado.setExpenses.mock.calls[0]![0][0]).toEqual(
      expect.objectContaining({ supplier: 'Verduras SAC', amount: '$150.00', status: 'Pagado' }),
    );
    expect(estado.notify).toHaveBeenCalledWith('Gasto registrado', expect.any(String));
  });

  it('bloquea el gasto sin proveedor o monto', () => {
    render(<GastosPage />);
    fireEvent.click(screen.getAllByText('Registrar gasto')[0]!);
    expect(screen.getByText('+ Registrar gasto')).toBeTruthy();
    fireEvent.click(screen.getByText('+ Registrar gasto'));
    expect(screen.getByText('Guardar gasto').closest('button')!.disabled).toBe(true);
  });
});
