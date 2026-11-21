import { describe, expect, it } from 'vitest';
import {
  ahorroCombo,
  estadoCupon,
  etiquetaDescuento,
  type Cupon,
} from '@fogoneria/contracts/promotions';
import { horaDeApi, toCombo, toCupon, toReglaHoraria } from './api';

describe('etiquetas de descuento', () => {
  it('pinta el porcentaje sin decimales de más', () => {
    expect(etiquetaDescuento('PORCENTAJE', 20)).toBe('20% OFF');
    expect(etiquetaDescuento('PORCENTAJE', 12.5)).toBe('12.5% OFF');
  });

  it('pinta el monto en soles con dos decimales', () => {
    expect(etiquetaDescuento('MONTO', 5)).toBe('$5.00 de descuento');
    expect(etiquetaDescuento('MONTO', 7.25)).toBe('$7.25 de descuento');
  });
});

describe('estado de un cupón', () => {
  const base: Cupon = {
    id: 'c-1',
    codigo: 'VERANO20',
    tipoDescuento: 'PORCENTAJE',
    valor: 20,
    limiteUsos: 10,
    usosActuales: 2,
    vencimiento: '2026-12-31',
    activo: true,
  };
  const ahora = new Date('2026-06-15T20:00:00.000Z');

  it('está vigente dentro de usos y fecha', () => {
    expect(estadoCupon(base, ahora)).toBe('VIGENTE');
  });

  it('se agota al llegar al límite de usos', () => {
    expect(estadoCupon({ ...base, usosActuales: 10 }, ahora)).toBe('AGOTADO');
  });

  it('vence al terminar el día de Lima', () => {
    expect(estadoCupon({ ...base, vencimiento: '2026-01-01' }, ahora)).toBe('VENCIDO');
    // 23:00 de Lima del último día todavía vale (04:00Z del día siguiente).
    expect(
      estadoCupon({ ...base, vencimiento: '2026-06-15' }, new Date('2026-06-16T03:59:00.000Z')),
    ).toBe('VIGENTE');
  });

  it('un cupón inactivo no se ofrece', () => {
    expect(estadoCupon({ ...base, activo: false }, ahora)).toBe('INACTIVO');
  });
});

describe('combos', () => {
  it('calcula el ahorro y lo deja nulo sin referencia', () => {
    expect(ahorroCombo(45, 30)).toBe(15);
    expect(ahorroCombo(null, 30)).toBeNull();
  });

  it('mapea el combo de la API con sus platos y el ahorro del servidor', () => {
    const combo = toCombo({
      id: 'cb-1',
      nombre: 'Dúo criollo',
      descripcion: 'Para compartir',
      precio_fijo: '35.50',
      activo: true,
      combos_platos: [
        { plato_id: 'p-1', cantidad: 2, platos: { id: 'p-1', nombre: 'Lomo' } },
      ],
      precioReferencia: '45.00',
      ahorro: '9.50',
    });

    expect(combo).toMatchObject({
      nombre: 'Dúo criollo',
      precioFijo: 35.5,
      precioReferencia: 45,
      ahorro: 9.5,
      platos: [{ platoId: 'p-1', cantidad: 2, nombre: 'Lomo' }],
    });
  });

  it('recalcula el ahorro si la API no lo manda', () => {
    expect(
      toCombo({
        id: 'cb-2',
        nombre: 'Solo',
        descripcion: null,
        precio_fijo: 20,
        activo: true,
        precioReferencia: 25,
      }).ahorro,
    ).toBe(5);
  });
});

describe('cupones y reglas horarias de la API', () => {
  it('mapea el cupón con el día de vencimiento', () => {
    expect(
      toCupon({
        id: 'c-1',
        codigo: 'PISCO5',
        tipo_descuento: 'MONTO',
        valor: '5.00',
        limite_usos: 50,
        usos_actuales: 12,
        vencimiento: '2026-12-15T05:00:00.000Z',
        activo: true,
      }),
    ).toMatchObject({
      codigo: 'PISCO5',
      tipoDescuento: 'MONTO',
      valor: 5,
      usosActuales: 12,
      vencimiento: '2026-12-15',
    });
  });

  it('convierte el Time de Postgres a HH:MM y conserva aplicaAhora', () => {
    expect(horaDeApi('1970-01-01T18:00:00.000Z')).toBe('18:00');

    expect(
      toReglaHoraria({
        id: 'r-1',
        nombre: 'Happy hour',
        beneficio: '2x1 en barra',
        dias_semana: [1, 2, 3, 4, 5],
        hora_inicio: '1970-01-01T18:00:00.000Z',
        hora_fin: '1970-01-01T20:00:00.000Z',
        activa: true,
        aplicaAhora: true,
      }),
    ).toMatchObject({
      nombre: 'Happy hour',
      horaInicio: '18:00',
      horaFin: '20:00',
      aplicaAhora: true,
      diasSemana: [1, 2, 3, 4, 5],
    });
  });
});
