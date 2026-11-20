import { describe, expect, it } from 'vitest';
import {
  diferenciaDeArqueo,
  esEstadoTurno,
  esMetodoPago,
  esTipoMovimiento,
  etiquetaEstadoTurno,
  etiquetaMetodo,
  etiquetaTipoMovimiento,
  metodoDeEtiqueta,
  validarCobro,
  validarMovimiento,
} from './caja';

describe('guardas de caja', () => {
  it('reconoce estados, tipos y métodos válidos', () => {
    expect(esEstadoTurno('ABIERTO')).toBe(true);
    expect(esEstadoTurno('CERRADO')).toBe(true);
    expect(esEstadoTurno('abierto')).toBe(false);
    expect(esTipoMovimiento('INGRESO')).toBe(true);
    expect(esTipoMovimiento('EGRESO')).toBe(true);
    expect(esTipoMovimiento('SALIDA')).toBe(false);
    expect(esMetodoPago('YAPE')).toBe(true);
    expect(esMetodoPago('PLIN')).toBe(false);
  });
});

describe('validarCobro', () => {
  it('acepta un cobro completo', () => {
    expect(validarCobro({ ordenId: 'o-1', metodo: 'EFECTIVO' })).toBeNull();
    expect(validarCobro({ ordenId: 'o-1', metodo: 'TARJETA', monto: 20, propina: 0 })).toBeNull();
  });

  it('rechaza comanda, método, monto y propina inválidos', () => {
    expect(validarCobro({})).toBe('Falta la comanda a cobrar');
    expect(validarCobro({ ordenId: '   ' })).toBe('Falta la comanda a cobrar');
    expect(validarCobro({ ordenId: 'o-1' })).toBe('Método de pago inválido');
    expect(validarCobro({ ordenId: 'o-1', metodo: 'BITCOIN' })).toBe('Método de pago inválido');
    expect(validarCobro({ ordenId: 'o-1', metodo: 'YAPE', monto: 0 })).toBe(
      'El monto debe ser mayor a cero',
    );
    expect(validarCobro({ ordenId: 'o-1', metodo: 'YAPE', propina: -1 })).toBe(
      'La propina no puede ser negativa',
    );
  });
});

describe('validarMovimiento', () => {
  it('acepta el movimiento manual válido', () => {
    expect(
      validarMovimiento({ tipo: 'EGRESO', concepto: 'Compra', monto: 12.5, metodo: 'EFECTIVO' }),
    ).toBeNull();
  });

  it('rechaza cada campo inválido en orden', () => {
    expect(validarMovimiento({})).toBe('Tipo de movimiento inválido');
    expect(validarMovimiento({ tipo: 'SALIDA' })).toBe('Tipo de movimiento inválido');
    expect(validarMovimiento({ tipo: 'INGRESO' })).toBe('Falta el concepto');
    expect(validarMovimiento({ tipo: 'INGRESO', concepto: '  ' })).toBe('Falta el concepto');
    expect(validarMovimiento({ tipo: 'INGRESO', concepto: 'Venta' })).toBe(
      'El monto debe ser mayor a cero',
    );
    expect(validarMovimiento({ tipo: 'INGRESO', concepto: 'Venta', monto: -3 })).toBe(
      'El monto debe ser mayor a cero',
    );
    expect(validarMovimiento({ tipo: 'INGRESO', concepto: 'Venta', monto: 3 })).toBe(
      'Método de pago inválido',
    );
  });
});

describe('diferenciaDeArqueo', () => {
  it('calcula el descuadre con dos decimales', () => {
    expect(diferenciaDeArqueo(380, 380)).toBe(0);
    expect(diferenciaDeArqueo(375.5, 380)).toBe(-4.5);
    expect(diferenciaDeArqueo(0.3, 0.1)).toBe(0.2);
  });
});

describe('etiquetas de caja', () => {
  it('traduce métodos en ambos sentidos', () => {
    expect(etiquetaMetodo('TARJETA')).toBe('Tarjeta');
    expect(etiquetaMetodo('TRANSFERENCIA')).toBe('Transferencia');
    expect(etiquetaMetodo('YAPE')).toBe('Yape');
    expect(etiquetaMetodo('EFECTIVO')).toBe('Efectivo');
    expect(metodoDeEtiqueta('Tarjeta')).toBe('TARJETA');
    expect(metodoDeEtiqueta('PLIN')).toBe('YAPE');
    expect(metodoDeEtiqueta('Yape')).toBe('YAPE');
    expect(metodoDeEtiqueta('Transferencia')).toBe('TRANSFERENCIA');
    expect(metodoDeEtiqueta('otro')).toBe('EFECTIVO');
  });

  it('traduce tipo de movimiento y estado del turno', () => {
    expect(etiquetaTipoMovimiento('INGRESO')).toBe('Ingreso');
    expect(etiquetaTipoMovimiento('EGRESO')).toBe('Egreso');
    expect(etiquetaEstadoTurno('ABIERTO')).toBe('Abierto');
    expect(etiquetaEstadoTurno('CERRADO')).toBe('Cerrado');
  });
});
