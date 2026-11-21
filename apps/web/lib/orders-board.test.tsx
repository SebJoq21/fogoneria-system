// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApiError } from './api';
import type { KdsBoard } from './order-mapping';

const api = vi.hoisted(() => ({ getOrdersBoard: vi.fn() }));

vi.mock('./orders-api', () => ({ getOrdersBoard: api.getOrdersBoard }));

import { useOrdersBoard } from './orders-board';

const tablero: KdsBoard = {
  columns: [],
  slaMinutos: 20,
  truncado: false,
  generadoAt: '2026-11-20T12:00:00.000Z',
  metricas: { abiertas: 0, fueraDeSla: 0, promedioEsperaMin: null, promedioPreparacionMin: null },
};

describe('useOrdersBoard', () => {
  beforeEach(() => {
    api.getOrdersBoard.mockReset();
  });

  it('deshabilitado no llama a la API y devuelve offline', () => {
    const { result } = renderHook(() => useOrdersBoard(false));
    expect(result.current.board).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(api.getOrdersBoard).not.toHaveBeenCalled();
  });

  it('carga el tablero al habilitarse', async () => {
    api.getOrdersBoard.mockResolvedValue({
      generadoAt: tablero.generadoAt,
      slaMinutos: 20,
      ventanaDias: 7,
      limite: 200,
      truncado: false,
      columnas: [],
      metricas: tablero.metricas,
    });
    const { result } = renderHook(() => useOrdersBoard(true));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.board).not.toBeNull());
    expect(result.current.error).toBeNull();
    expect(api.getOrdersBoard).toHaveBeenCalled();
  });

  it('expone el mensaje de ApiError y limpia el error al refrescar', async () => {
    api.getOrdersBoard.mockRejectedValueOnce(new ApiError('sin sesión', 401));
    const { result } = renderHook(() => useOrdersBoard(true));
    await waitFor(() => expect(result.current.error).toBe('sin sesión'));

    api.getOrdersBoard.mockResolvedValueOnce({
      generadoAt: tablero.generadoAt,
      slaMinutos: 20,
      ventanaDias: 7,
      limite: 200,
      truncado: false,
      columnas: [],
      metricas: tablero.metricas,
    });
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.board).not.toBeNull();
  });

  it('un error inesperado usa el mensaje genérico', async () => {
    api.getOrdersBoard.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useOrdersBoard(true));
    await waitFor(() =>
      expect(result.current.error).toBe('No se pudo cargar el tablero del KDS.'),
    );
  });

  it('descarta respuestas viejas si dos refrescos se cruzan', async () => {
    let resolverPrimero: (value: never) => void = () => {};
    api.getOrdersBoard
      .mockImplementationOnce(
        () => new Promise((resolve) => {
          resolverPrimero = resolve as never;
        }),
      )
      .mockResolvedValueOnce({
        generadoAt: tablero.generadoAt,
        slaMinutos: 20,
        ventanaDias: 7,
        limite: 200,
        truncado: false,
        columnas: [],
        metricas: tablero.metricas,
      });

    const { result } = renderHook(() => useOrdersBoard(true));
    const primero = result.current.refresh();
    await act(async () => {
      await result.current.refresh();
    });
    resolverPrimero(tablero as never);
    await act(async () => {
      await primero;
    });
    expect(result.current.board).not.toBeNull();
  });
});
