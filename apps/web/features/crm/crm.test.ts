import { describe, expect, it } from 'vitest';
import {
  esSegmentoCliente,
  esTipoMovimientoPuntos,
  etiquetaMovimientoPuntos,
  etiquetaSegmento,
  ultimaVisitaLabel,
  validarAjustePuntos,
} from '@fogoneria/contracts/crm';
import {
  toCliente,
  toClienteDetalle,
  toConfigLealtad,
  toMovimientoPuntos,
  type ApiCliente,
  type ApiMovimientoPuntos,
} from './api';

const clienteApi: ApiCliente = {
  id: 'c-1',
  nombre: 'Rosa Pérez',
  telefono: '987654321',
  segmento: 'VIP',
  visitas: 21,
  puntos: 1240,
  ultima_visita: '2026-11-18T20:30:00.000Z',
  created_at: '2026-01-05T10:00:00.000Z',
};

const movimientoApi: ApiMovimientoPuntos = {
  id: 'm-1',
  tipo: 'GANANCIA',
  puntos: 36,
  motivo: 'Consumo',
  created_at: '2026-11-18T20:30:00.000Z',
  orden_id: 'o-1',
};

describe('segmentos del CRM', () => {
  it('etiqueta los tres segmentos como los pinta el ERP', () => {
    expect(etiquetaSegmento('NUEVO')).toBe('Nuevo');
    expect(etiquetaSegmento('FRECUENTE')).toBe('Frecuente');
    expect(etiquetaSegmento('VIP')).toBe('VIP');
  });

  it('un segmento desconocido cae a Nuevo y el guard lo rechaza', () => {
    expect(etiquetaSegmento('PLATINO')).toBe('Nuevo');
    expect(esSegmentoCliente('VIP')).toBe(true);
    expect(esSegmentoCliente('PLATINO')).toBe(false);
  });
});

describe('movimientos de puntos', () => {
  it('etiqueta los tres tipos y valida el enum', () => {
    expect(etiquetaMovimientoPuntos('GANANCIA')).toBe('Ganancia');
    expect(etiquetaMovimientoPuntos('CANJE')).toBe('Canje');
    expect(etiquetaMovimientoPuntos('CADUCIDAD')).toBe('Caducidad');
    expect(esTipoMovimientoPuntos('CANJE')).toBe(true);
    expect(esTipoMovimientoPuntos('REGALO')).toBe(false);
  });

  it('normaliza el movimiento con su comanda de origen', () => {
    expect(toMovimientoPuntos(movimientoApi)).toMatchObject({
      id: 'm-1',
      tipo: 'GANANCIA',
      puntos: 36,
      motivo: 'Consumo',
      ordenId: 'o-1',
    });
    expect(toMovimientoPuntos({ ...movimientoApi, orden_id: null }).ordenId).toBeNull();
  });
});

describe('última visita', () => {
  it('pinta dd/mm/aaaa desde fecha o ISO y guion si nunca vino', () => {
    expect(ultimaVisitaLabel('2026-11-18')).toBe('18/11/2026');
    expect(ultimaVisitaLabel('2026-11-18T20:30:00.000Z')).toBe('18/11/2026');
    expect(ultimaVisitaLabel(null)).toBe('—');
    expect(ultimaVisitaLabel(undefined)).toBe('—');
  });
});

describe('validación del ajuste de puntos', () => {
  it('acepta una cortesía con puntos enteros positivos', () => {
    expect(validarAjustePuntos({ tipo: 'GANANCIA', puntos: 50 })).toBeNull();
  });

  it('rechaza tipo inválido y puntos no enteros o en cero', () => {
    expect(validarAjustePuntos({ tipo: 'REGALO', puntos: 10 })).toMatch(/tipo/i);
    expect(validarAjustePuntos({ tipo: 'GANANCIA', puntos: 0 })).toMatch(/puntos/i);
    expect(validarAjustePuntos({ tipo: 'GANANCIA', puntos: 2.5 })).toMatch(/puntos/i);
  });

  it('no deja descontar más puntos de los que el cliente tiene', () => {
    expect(validarAjustePuntos({ tipo: 'CANJE', puntos: 30, saldo: 26 })).toMatch(
      /solo tiene 26 puntos/,
    );
    expect(validarAjustePuntos({ tipo: 'CANJE', puntos: 26, saldo: 26 })).toBeNull();
    expect(validarAjustePuntos({ tipo: 'CADUCIDAD', puntos: 5, saldo: 26 })).toBeNull();
  });
});

describe('mapeo API → contrato (CRM)', () => {
  it('traduce el cliente de snake_case y conserva su segmento', () => {
    expect(toCliente(clienteApi)).toMatchObject({
      id: 'c-1',
      nombre: 'Rosa Pérez',
      telefono: '987654321',
      segmento: 'VIP',
      visitas: 21,
      puntos: 1240,
      ultimaVisita: '2026-11-18T20:30:00.000Z',
    });
  });

  it('cae a NUEVO y cero si la API trae valores raros o nulos', () => {
    const cliente = toCliente({
      ...clienteApi,
      segmento: 'PLATINO',
      visitas: null as unknown as number,
      puntos: null as unknown as number,
      ultima_visita: null,
    });
    expect(cliente.segmento).toBe('NUEVO');
    expect(cliente.visitas).toBe(0);
    expect(cliente.puntos).toBe(0);
    expect(cliente.ultimaVisita).toBeNull();
  });

  it('la ficha incluye los movimientos traducidos', () => {
    const detalle = toClienteDetalle({
      ...clienteApi,
      movimientos_puntos: [movimientoApi],
    });
    expect(detalle.movimientos).toHaveLength(1);
    expect(detalle.movimientos[0]).toMatchObject({ tipo: 'GANANCIA', ordenId: 'o-1' });
  });

  it('configuración de lealtad con decimal en texto se vuelve número', () => {
    expect(
      toConfigLealtad({
        puntos_por_moneda: '1.50',
        caducidad_meses: 12,
        umbral_frecuente: 5,
        umbral_vip: 20,
      }),
    ).toEqual({
      puntosPorMoneda: 1.5,
      caducidadMeses: 12,
      umbralFrecuente: 5,
      umbralVip: 20,
    });
  });
});
