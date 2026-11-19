import { describe, expect, it } from 'vitest';
import {
  CATEGORIAS_GASTO,
  etiquetaCategoria,
  etiquetaEstadoPago,
  esCategoriaGasto,
  esEstadoPago,
  pagoSaleDeCaja,
  validarGasto,
} from '@fogoneria/contracts/gastos';
import { toGasto, type ApiGasto } from './api';

const gastoApi: ApiGasto = {
  id: 'g-1',
  sucursal_id: 's-1',
  concepto: 'Compra de carbón',
  monto: '350.50',
  categoria: 'INSUMOS',
  estado_pago: 'PAGADO',
  pagado_en_caja: true,
  turno_id: 't-1',
  proveedor_id: 'p-1',
  vencimiento: '2026-12-15',
  registrado_por: 'u-1',
  created_at: '2026-11-19T10:00:00.000Z',
  proveedores: { id: 'p-1', nombre: 'AgroAndina' },
};

describe('mapeo API → contrato (gastos)', () => {
  it('normaliza el gasto con su proveedor y el pago en caja', () => {
    expect(toGasto(gastoApi)).toMatchObject({
      id: 'g-1',
      concepto: 'Compra de carbón',
      monto: 350.5,
      categoria: 'INSUMOS',
      estadoPago: 'PAGADO',
      pagadoEnCaja: true,
      turnoId: 't-1',
      proveedor: 'AgroAndina',
      vencimiento: '2026-12-15',
    });
  });

  it('cae a OTROS/PENDIENTE ante valores desconocidos', () => {
    const gasto = toGasto({ ...gastoApi, categoria: 'FIESTA', estado_pago: 'RARO' });
    expect(gasto.categoria).toBe('OTROS');
    expect(gasto.estadoPago).toBe('PENDIENTE');
  });
});

describe('estados y categorías de gasto', () => {
  it('etiqueta los dos estados de pago', () => {
    expect(etiquetaEstadoPago('PENDIENTE')).toBe('Pendiente');
    expect(etiquetaEstadoPago('PAGADO')).toBe('Pagado');
    expect(esEstadoPago('PAGADO')).toBe(true);
    expect(esEstadoPago('ANULADO')).toBe(false);
  });

  it('etiqueta las seis categorías del dominio', () => {
    expect(CATEGORIAS_GASTO).toHaveLength(6);
    expect(etiquetaCategoria('ALQUILER')).toBe('Alquiler');
    expect(etiquetaCategoria('MARKETING')).toBe('Marketing');
    expect(esCategoriaGasto('INSUMOS')).toBe(true);
    expect(esCategoriaGasto('FIESTA')).toBe(false);
  });

  it('solo el efectivo sale de la caja', () => {
    expect(pagoSaleDeCaja('EFECTIVO')).toBe(true);
    expect(pagoSaleDeCaja('TARJETA')).toBe(false);
    expect(pagoSaleDeCaja('TRANSFERENCIA')).toBe(false);
    expect(pagoSaleDeCaja('YAPE')).toBe(false);
  });

  it('valida concepto, monto y categoría antes de registrar', () => {
    expect(validarGasto({ concepto: 'Carbón', monto: 10, categoria: 'INSUMOS' })).toBeNull();
    expect(validarGasto({ monto: 10, categoria: 'INSUMOS' })).toMatch(/concepto/i);
    expect(validarGasto({ concepto: 'Carbón', monto: 0, categoria: 'INSUMOS' })).toMatch(
      /monto/i,
    );
    expect(validarGasto({ concepto: 'Carbón', monto: 10, categoria: 'FIESTA' })).toMatch(
      /categoría/i,
    );
  });
});
