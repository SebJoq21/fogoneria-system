'use client';

/**
 * Datos de la vista de analíticas (AYCDS-45): P&L, serie diaria, ranking de
 * platos y cobros por método, en una sola carga y con el rango de 7 días de
 * Lima. Sin sesión no se llama a la API: la página cae al demo del provider.
 */

import { useEffect, useState } from 'react';
import {
  DIAS_VISTA_BI,
  type CobroMetodo,
  type Pnl,
  type PnlDia,
  type PlatoTop,
} from '@fogoneria/contracts/bi';
import { useModules } from '@/components/dashboard/ModulesProvider';
import { biApi, rangoVista } from './api';

export type BiData = {
  pnl: Pnl | null;
  serie: PnlDia[];
  platos: PlatoTop[];
  metodos: CobroMetodo[];
};

const VACIO: BiData = { pnl: null, serie: [], platos: [], metodos: [] };

function mensaje(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudieron cargar las analíticas.';
}

export function useBi(dias: number = DIAS_VISTA_BI) {
  const { hasSession } = useModules();
  const [datos, setDatos] = useState<BiData>(VACIO);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSession) return;
    const controller = new AbortController();
    const rango = rangoVista(dias);
    // Diferido al siguiente tick: el efecto no debe disparar renders en cascada.
    const timer = setTimeout(() => {
      Promise.all([
        biApi.pnl(rango, controller.signal),
        biApi.serie(rango, controller.signal),
        biApi.platosTop({ ...rango, limit: 5 }, controller.signal),
        biApi.cobrosPorMetodo(rango, controller.signal),
      ])
        .then(([pnl, serie, platos, metodos]) => {
          setDatos({ pnl, serie, platos, metodos });
          setError(null);
        })
        .catch((problema: unknown) => {
          if (controller.signal.aborted) return;
          setError(mensaje(problema));
        });
    }, 0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [hasSession, dias]);

  return { ...datos, error };
}
