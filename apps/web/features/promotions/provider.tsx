'use client';

/**
 * Provider del módulo Promociones (F6c2): dueño de los combos y cupones demo.
 *
 * La poda de combos huérfanos se queda en `ModulesProvider` porque necesita el
 * catálogo, que se monta **debajo** de `FeatureProviders`; aquí solo se expone
 * `setCombos`. El importe del descuento lo sigue calculando `lib/domain.ts`
 * (y el servidor con sesión).
 */

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { initialCoupons, type Coupon } from '@/lib/erp';
import { initialCombos, type Combo } from '@/lib/erp-catalog';
import { loadErpState } from '@/lib/persistence';
import {
  migrateLegacyPromotions,
  useModuleStore,
  type LegacyErpState,
  type PromotionsStoreState,
} from '@/lib/module-store';

const EMPTY: PromotionsStoreState = { combos: [], coupons: [] };
const DEMO: PromotionsStoreState = { combos: initialCombos, coupons: initialCoupons };

function readLegacy(tenantKey: string): PromotionsStoreState | null {
  const state = loadErpState(tenantKey) as LegacyErpState | null;
  if (!state) return null;
  return migrateLegacyPromotions(state, null).migrated;
}

type PromotionsContextValue = {
  combos: Combo[];
  setCombos: (combos: Combo[]) => void;
  coupons: Coupon[];
  setCoupons: (coupons: Coupon[]) => void;
  consumeCoupon: (code: string) => void;
  restoreCoupon: (code: string) => void;
  resetPromotions: () => void;
};

const PromotionsContext = createContext<PromotionsContextValue | null>(null);

export function PromotionsProvider({ children }: { children: ReactNode }) {
  const { value, setValue, reset } = useModuleStore<PromotionsStoreState>({
    id: 'promotions',
    empty: EMPTY,
    demo: DEMO,
    readLegacy,
  });

  const setCombos = useCallback<PromotionsContextValue['setCombos']>(
    (combos) => setValue((prev) => ({ ...prev, combos })),
    [setValue],
  );

  const setCoupons = useCallback<PromotionsContextValue['setCoupons']>(
    (coupons) => setValue((prev) => ({ ...prev, coupons })),
    [setValue],
  );

  const consumeCoupon = useCallback<PromotionsContextValue['consumeCoupon']>(
    (code) => {
      setValue((prev) => {
        if (!prev.coupons.some((coupon) => coupon.code === code)) return prev;
        return {
          ...prev,
          coupons: prev.coupons.map((coupon) =>
            coupon.code === code ? { ...coupon, used: coupon.used + 1 } : coupon,
          ),
        };
      });
    },
    [setValue],
  );

  const restoreCoupon = useCallback<PromotionsContextValue['restoreCoupon']>(
    (code) => {
      setValue((prev) => {
        if (!prev.coupons.some((coupon) => coupon.code === code)) return prev;
        return {
          ...prev,
          coupons: prev.coupons.map((coupon) =>
            coupon.code === code ? { ...coupon, used: Math.max(0, coupon.used - 1) } : coupon,
          ),
        };
      });
    },
    [setValue],
  );

  const result = useMemo<PromotionsContextValue>(
    () => ({
      combos: value.combos,
      setCombos,
      coupons: value.coupons,
      setCoupons,
      consumeCoupon,
      restoreCoupon,
      resetPromotions: reset,
    }),
    [consumeCoupon, reset, restoreCoupon, setCombos, setCoupons, value.combos, value.coupons],
  );

  return <PromotionsContext.Provider value={result}>{children}</PromotionsContext.Provider>;
}

export function usePromotions(): PromotionsContextValue {
  const context = useContext(PromotionsContext);
  if (!context) throw new Error('usePromotions debe usarse dentro de PromotionsProvider');
  return context;
}
