import { describe, expect, it } from 'vitest';
import {
  diferenciaDeArqueo,
  etiquetaEstadoTurno,
  etiquetaMetodo,
  etiquetaTipoMovimiento,
  metodoDeEtiqueta,
  validarCobro,
  validarMovimiento,
} from '@fogoneria/contracts/cash';
import {
  cobroDesdeApi,
  toMovimiento,
  toTurno,
  turnoActualDesdeApi,
  type ApiMovimiento,
  type ApiTurno,
} from './api';

const turnoApi: ApiTurno = {
  id: 't-1',
  sucursal_id: 's-1',
  cajero_id: 'u-1',
  apertura_at: '2026-11-19T10:00:00.000Z',
  cierre_at: null,
  fondo_apertura: '200.00',
  ingresos_total: '41.50',
  egresos_total: '0.00',
  saldo: null,
  efectivo_contado: null,
  diferencia: null,
  observaciones: null,
  estado: 'ABIERTO',
  usuarios: { id: 'u-1', nombre: 'Caja Uno' },
};

const movimientoApi: ApiMovimiento = {
  id: 'm-1',
  turno_id: 't-1',
  tipo: 'EGRESO',
  concepto: 'Compra de hielo',
  monto: '20.00',
  metodo: 'YAPE',
  orden_id: null,
  gasto_id: 'g-1',
  created_at: '2026-11-19T11:00:00.000Z',
  usuarios: { id: 'u-1', nombre: 'Caja Uno' },
};

describe('mapeo API → contrato (caja)', () => {
  it('normaliza el turno con decimales y el nombre del cajero', () => {
    expect(toTurno(turnoApi)).toMatchObject({
      id: 't-1',
      sucursalId: 's-1',
      cajeroId: 'u-1',
      cajero: 'Caja Uno',
      fondoApertura: 200,
      ingresosTotal: 41.5,
      saldo: null,
      estado: 'ABIERTO',
    });
  });

  it('cae a CERRADO ante un estado desconocido y a null sin turno', () => {
    expect(toTurno({ ...turnoApi, estado: 'EN_VEREMOS' }).estado).toBe('CERRADO');
    expect(turnoActualDesdeApi(null)).toBeNull();
    const actual = turnoActualDesdeApi({
      turno: turnoApi,
      arqueo: {
        fondo: 200,
        ingresos: 41.5,
        egresos: 0,
        ingresosEfectivo: 41.5,
        egresosEfectivo: 0,
        esperadoEfectivo: 241.5,
        saldoSistema: 241.5,
        movimientos: 2,
        efectivoContado: null,
        diferencia: null,
      },
    });
    expect(actual?.turno.id).toBe('t-1');
    expect(actual?.arqueo.esperadoEfectivo).toBe(241.5);
  });

  it('normaliza el movimiento y conserva el gasto que lo originó', () => {
    expect(toMovimiento(movimientoApi)).toMatchObject({
      id: 'm-1',
      turnoId: 't-1',
      tipo: 'EGRESO',
      concepto: 'Compra de hielo',
      monto: 20,
      metodo: 'YAPE',
      gastoId: 'g-1',
      actor: 'Caja Uno',
    });
    expect(toMovimiento({ ...movimientoApi, tipo: 'RARO', metodo: 'RARO' })).toMatchObject({
      tipo: 'INGRESO',
      metodo: 'EFECTIVO',
    });
  });

  it('normaliza el resultado del cobro parcial', () => {
    expect(
      cobroDesdeApi({
        ordenId: 'o-1',
        numeroOrden: 'ORD-000001',
        turnoId: 't-1',
        cobrado: 30,
        propina: 5,
        total: 44,
        pendiente: 14,
        pagada: false,
      }),
    ).toMatchObject({ cobrado: 30, propina: 5, pendiente: 14, pagada: false });
  });
});

describe('reglas y etiquetas de caja', () => {
  it('etiqueta turnos, métodos y tipos de movimiento', () => {
    expect(etiquetaEstadoTurno('ABIERTO')).toBe('Abierto');
    expect(etiquetaEstadoTurno('CERRADO')).toBe('Cerrado');
    expect(etiquetaMetodo('EFECTIVO')).toBe('Efectivo');
    expect(etiquetaMetodo('YAPE')).toBe('Yape');
    expect(etiquetaTipoMovimiento('EGRESO')).toBe('Egreso');
    expect(metodoDeEtiqueta('Plin')).toBe('YAPE');
    expect(metodoDeEtiqueta('otro')).toBe('EFECTIVO');
  });

  it('calcula el descuadre del arqueo a 2 decimales', () => {
    expect(diferenciaDeArqueo(850.5, 840.4)).toBe(10.1);
    expect(diferenciaDeArqueo(100, 100)).toBe(0);
  });

  it('valida el cobro y el movimiento manual', () => {
    expect(validarCobro({ ordenId: 'o-1', metodo: 'EFECTIVO' })).toBeNull();
    expect(validarCobro({ metodo: 'EFECTIVO' })).toMatch(/comanda/i);
    expect(validarCobro({ ordenId: 'o-1', metodo: 'BITCOIN' })).toMatch(/método/i);
    expect(validarCobro({ ordenId: 'o-1', metodo: 'EFECTIVO', monto: 0 })).toMatch(/monto/i);
    expect(validarCobro({ ordenId: 'o-1', metodo: 'EFECTIVO', propina: -1 })).toMatch(/propina/i);

    expect(
      validarMovimiento({ tipo: 'INGRESO', concepto: 'Fondo', monto: 10, metodo: 'EFECTIVO' }),
    ).toBeNull();
    expect(
      validarMovimiento({ tipo: 'INGRESO', concepto: ' ', monto: 10, metodo: 'EFECTIVO' }),
    ).toMatch(/concepto/i);
    expect(
      validarMovimiento({ tipo: 'OTRO', concepto: 'x', monto: 10, metodo: 'EFECTIVO' }),
    ).toMatch(/tipo/i);
  });
});
