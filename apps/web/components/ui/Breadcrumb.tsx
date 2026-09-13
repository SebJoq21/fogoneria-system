"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = {
  label: string;
  href?: string;
};

/** Miga de pan del ERP: Inicio / Sección / Subfunción. El último tramo es la página actual. */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-nav text-ink-400">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.label} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <ChevronRight size={14} className="shrink-0" aria-hidden />}
              {last || !item.href ? (
                <span aria-current={last ? "page" : undefined} className={last ? "font-medium text-ink-900 truncate" : "truncate"}>
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="hover:text-ink-900 transition-colors truncate">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
