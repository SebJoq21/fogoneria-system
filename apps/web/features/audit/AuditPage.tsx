'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { TableCard, THead, TH, TR, TD } from '@/components/ui/data-table';
import { auditApi, type EventoAuditoria } from './api';

const accionTone: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  CREATE: 'success',
  UPDATE: 'warning',
  DELETE: 'danger',
  VOID: 'danger',
  LOGIN: 'neutral',
};

function fecha(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('es-PE');
}

/** Auditoría de la empresa: últimos eventos sensibles, solo lectura. */
export function AuditPage() {
  const [items, setItems] = useState<EventoAuditoria[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    auditApi
      .list({ limit: 100, signal: controller.signal })
      .then((lista) => setItems(lista.items))
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar la auditoría.');
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

  if (items === null) {
    return (
      <Card>
        <p className="text-sm text-ink-400">Cargando auditoría…</p>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <p className="text-sm text-ink-400">Aún no hay eventos de auditoría.</p>
      </Card>
    );
  }

  return (
    <TableCard>
      <THead>
        <tr>
          <TH>Fecha</TH>
          <TH>Acción</TH>
          <TH>Entidad</TH>
          <TH>Usuario</TH>
          <TH>Detalle</TH>
        </tr>
      </THead>
      <tbody>
        {items.map((evento) => (
          <TR key={evento.id}>
            <TD tone="muted" nowrap>
              {fecha(evento.createdAt)}
            </TD>
            <TD>
              <Badge tone={accionTone[evento.accion] ?? 'neutral'} dot>
                {evento.accion}
              </Badge>
            </TD>
            <TD tone="strong">
              {evento.entidad}
              {evento.entidadId ? <span className="block text-xs text-ink-400">{evento.entidadId}</span> : null}
            </TD>
            <TD tone="muted">{evento.usuarioId ?? '—'}</TD>
            <TD tone="muted">{Object.keys(evento.detalle).length > 0 ? JSON.stringify(evento.detalle) : '—'}</TD>
          </TR>
        ))}
      </tbody>
    </TableCard>
  );
}
