"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/** Links de acceso rápido con badge de conteo (estilo workspace ERP). */
export function QuickLink({
  href,
  label,
  badge,
}: {
  href: string;
  label: string;
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 text-sm text-ink-900 hover:underline w-max"
    >
      {label}
      <ArrowUpRight size={14} className="text-ink-400 shrink-0" />
      {badge}
    </Link>
  );
}

/** Link de columna Másteres/Transacciones/Informes. */
export function ColumnLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 text-sm text-ink-600 hover:text-ink-900 transition-colors w-max"
    >
      {label}
      <ArrowUpRight size={14} className="text-ink-400 shrink-0" />
    </Link>
  );
}

/** Columna de links del workspace. */
export function LinkColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-sm font-medium text-ink-900 mb-3">{title}</h4>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

import { Card } from "@/components/ui/Card";

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
