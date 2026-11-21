'use client';

/**
 * Provider del módulo Comprobantes (F6c2): dueño del estado demo de
 * comprobantes y del modo contingencia SUNAT.
 *
 * La anulación no revierte caja aquí: la orquesta `ModulesProvider` (que ve
 * caja y cuentas) y usa `patchReceipt`/`addReceipt`. La emisión real con
 * sesión sigue yendo a la API (`features/receipts/api.ts`).
 */

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { nowIso } from '@/lib/domain';
import { initialReceipts, type Receipt } from '@/lib/erp';
import { cpeFromReceipt, getFacturacionPort } from '@/lib/facturacion';
import { loadErpState } from '@/lib/persistence';
import {
  migrateLegacyReceipts,
  useModuleStore,
  type LegacyErpState,
  type ReceiptsStoreState,
} from '@/lib/module-store';

const EMPTY: ReceiptsStoreState = { receipts: [], sunatContingencia: false };
const DEMO: ReceiptsStoreState = { receipts: initialReceipts, sunatContingencia: false };

function readLegacy(tenantKey: string): ReceiptsStoreState | null {
  const state = loadErpState(tenantKey) as LegacyErpState | null;
  if (!state) return null;
  return migrateLegacyReceipts(state, null).migrated;
}

type ReceiptsContextValue = {
  receipts: Receipt[];
  sunatContingencia: boolean;
  addReceipt: (receipt: Receipt) => void;
  setReceipts: (receipts: Receipt[]) => void;
  patchReceipt: (id: string, patch: Partial<Receipt>) => void;
  removeReceipt: (id: string) => void;
  enviarSunat: (receipt: Receipt) => void;
  generarResumenDiario: () => { count: number; resumenId: string } | null;
  toggleSunatContingencia: () => void;
  resetReceipts: () => void;
};

const ReceiptsContext = createContext<ReceiptsContextValue | null>(null);

export function ReceiptsProvider({ children }: { children: ReactNode }) {
  const { value, setValue, reset } = useModuleStore<ReceiptsStoreState>({
    id: 'receipts',
    empty: EMPTY,
    demo: DEMO,
    readLegacy,
  });

  const addReceipt = useCallback<ReceiptsContextValue['addReceipt']>(
    (receipt) => setValue((prev) => ({ ...prev, receipts: [receipt, ...prev.receipts] })),
    [setValue],
  );

  const setReceipts = useCallback<ReceiptsContextValue['setReceipts']>(
    (receipts) => setValue((prev) => ({ ...prev, receipts })),
    [setValue],
  );

  const patchReceipt = useCallback<ReceiptsContextValue['patchReceipt']>(
    (id, patch) => {
      setValue((prev) => ({
        ...prev,
        receipts: prev.receipts.map((receipt) =>
          receipt.id === id ? { ...receipt, ...patch } : receipt,
        ),
      }));
    },
    [setValue],
  );

  const removeReceipt = useCallback<ReceiptsContextValue['removeReceipt']>(
    (id) => {
      setValue((prev) => ({ ...prev, receipts: prev.receipts.filter((r) => r.id !== id) }));
    },
    [setValue],
  );

  const enviarSunat = useCallback<ReceiptsContextValue['enviarSunat']>(
    (receipt) => {
      const port = getFacturacionPort();
      port.setContingencia(value.sunatContingencia);
      patchReceipt(receipt.id, {
        estadoSunat: 'enviado',
        intentosEnvio: receipt.intentosEnvio + 1,
        ultimoEnvio: nowIso(),
      });
      void port.enviar(cpeFromReceipt(receipt)).then((res) => {
        patchReceipt(receipt.id, {
          estadoSunat: res.estado,
          cdr: res.cdr ?? receipt.cdr,
          mensajeSunat: res.mensaje,
        });
      });
    },
    [patchReceipt, value.sunatContingencia],
  );

  const generarResumenDiario = useCallback<ReceiptsContextValue['generarResumenDiario']>(() => {
    const pendientes = value.receipts.filter(
      (r) => r.type === '03' && r.status === 'Anulada' && r.bajaResumenId === 'RC-pendiente',
    );
    if (pendientes.length === 0) return null;
    const at = nowIso();
    const dayKey = at.slice(0, 10).replace(/-/g, '');
    const seq =
      value.receipts.filter((r) => (r.bajaResumenId ?? '').startsWith(`RC-${dayKey}-`)).length + 1;
    const resumenId = `RC-${dayKey}-${String(seq).padStart(2, '0')}`;
    const port = getFacturacionPort();
    port.setContingencia(value.sunatContingencia);
    void port.enviarBaja(pendientes.map((r) => r.id)).then((res) => {
      if (res.estado !== 'aceptado') return;
      setValue((prev) => ({
        ...prev,
        receipts: prev.receipts.map((r) =>
          pendientes.some((p) => p.id === r.id) ? { ...r, bajaResumenId: resumenId } : r,
        ),
      }));
    });
    return { count: pendientes.length, resumenId };
  }, [setValue, value.receipts, value.sunatContingencia]);

  const toggleSunatContingencia = useCallback(() => {
    setValue((prev) => ({ ...prev, sunatContingencia: !prev.sunatContingencia }));
  }, [setValue]);

  const result = useMemo<ReceiptsContextValue>(
    () => ({
      receipts: value.receipts,
      sunatContingencia: value.sunatContingencia,
      addReceipt,
      setReceipts,
      patchReceipt,
      removeReceipt,
      enviarSunat,
      generarResumenDiario,
      toggleSunatContingencia,
      resetReceipts: reset,
    }),
    [
      addReceipt,
      enviarSunat,
      generarResumenDiario,
      patchReceipt,
      removeReceipt,
      reset,
      setReceipts,
      toggleSunatContingencia,
      value.receipts,
      value.sunatContingencia,
    ],
  );

  return <ReceiptsContext.Provider value={result}>{children}</ReceiptsContext.Provider>;
}

export function useReceipts(): ReceiptsContextValue {
  const context = useContext(ReceiptsContext);
  if (!context) throw new Error('useReceipts debe usarse dentro de ReceiptsProvider');
  return context;
}
