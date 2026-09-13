"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Card } from "@/components/ui/Card";

/** Link de bloque de hub: navega (href) o selecciona tab (onSelect). */
export type HubLink = {
  label: string;
  href?: string;
  onSelect?: () => void;
};

function HubLinkItem({ link }: { link: HubLink }) {
  const inner = (
    <>
      {link.label}
      <ArrowUpRight size={14} className="text-ink-400 shrink-0" />
    </>
  );
  if (link.onSelect) {
    return (
      <button
        type="button"
        onClick={link.onSelect}
        className="flex items-center gap-2 text-sm text-ink-600 hover:text-ink-900 transition-colors w-max cursor-pointer"
      >
        {inner}
      </button>
    );
  }
  return (
    <Link
      href={link.href ?? "#"}
      className="flex items-center gap-2 text-sm text-ink-600 hover:text-ink-900 transition-colors w-max"
    >
      {inner}
    </Link>
  );
}

/**
 * Norma de hub operable por dueño: resumen arriba, luego `Acceso rápido`
 * (acciones) e `Informes y másteres` (maestros + reportes), ambos 18px semibold.
 * Si un bloque llega vacío, no se pinta (ej: Analíticas sin acceso).
 */
export function HubBlocks({ acceso, informes }: { acceso: HubLink[]; informes: HubLink[] }) {
  return (
    <>
      {acceso.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-ink-900 mb-6">Acceso rápido</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {acceso.map((l) => (
              <HubLinkItem key={l.label} link={l} />
            ))}
          </div>
        </div>
      )}
      <div>
        <h3 className="text-lg font-semibold text-ink-900 mb-6">Informes y másteres</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {informes.map((l) => (
            <HubLinkItem key={l.label} link={l} />
          ))}
        </div>
      </div>
    </>
  );
}

/** Tarjeta de gráfico del workspace. */
export function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="mb-6">
      <h3 className="text-sm font-medium text-ink-900">{title}</h3>
      {subtitle && <p className="text-xs text-ink-400 mt-0.5 mb-2">{subtitle}</p>}
      <div className="h-44 w-full mt-2">{children}</div>
    </Card>
  );
}
