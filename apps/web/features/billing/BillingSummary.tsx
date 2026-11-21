'use client';

import { useEffect, useState } from 'react';
import { KpiCard } from '@/components/ui/KpiCard';
import { Card } from '@/components/ui/Card';
import { billingApi, type ResumenFacturacion } from './api';

/**
 * Sección de facturación de la consola SaaS: MRR y distribución de estados.
 * Se compone desde la ruta `/saas` para no acoplar SaaS ↔ billing.
 */
export function BillingSummary() {
  const [resumen, setResumen] = useState<ResumenFacturacion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    billingApi
      .resumen(controller.signal)
      .then(setResumen)
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar la facturación.');
        }
      });
    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <Card>
        <p className="text-sm text-persimmon-600" role="alert">
          {error}
        </p>
      </Card>
    );
  }

  if (!resumen) {
    return (
      <Card>
        <p className="text-sm text-ink-400">Cargando facturación…</p>
      </Card>
    );
  }

  return (
    <section aria-label="Facturación">
      <h3 className="text-sm font-medium text-ink-900 mb-3">Facturación</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="MRR" value={`$${resumen.mrr.toFixed(2)}`} hint="suscripciones activas" />
        <KpiCard label="Activas" value={String(resumen.active)} hint={`de ${resumen.total}`} />
        <KpiCard label="Trial" value={String(resumen.trial)} hint="en prueba" />
        <KpiCard
          label="Suspendidas"
          value={String(resumen.suspended)}
          hint={`${resumen.expired} expiradas`}
        />
      </div>
    </section>
  );
}
