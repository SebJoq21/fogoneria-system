/** Primitivas de tabla ERP: un solo estilo en toda la web.
 *  Card blanca 16px + header tenue + filas con hover. Todo jala de aquí. */

import { cn } from "./cn";

export function TableCard({
  children,
  header,
  footer,
  className = "",
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-surface rounded-2xl border border-ink-900/10 overflow-hidden", className)}>
      {header && (
        <div className="p-4 border-b border-ink-900/[0.06] flex flex-wrap gap-2">{header}</div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">{children}</table>
      </div>
      {footer && (
        <div className="p-4 border-t border-ink-900/[0.06]">{footer}</div>
      )}
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-primary/[0.03] text-ink-400 border-b border-ink-900/10">
      {children}
    </thead>
  );
}

export function TH({
  children,
  right = false,
  className = "",
}: {
  children: React.ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-4 py-3 font-medium text-nav",
        right ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TR({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr className={cn("border-b border-ink-900/[0.04] last:border-0", className)}>{children}</tr>
  );
}

type TDTone = "body" | "strong" | "muted";

const tones: Record<TDTone, string> = {
  body: "text-ink-600",
  strong: "text-ink-900 font-medium",
  muted: "text-ink-400",
};

export function TD({
  children,
  tone = "body",
  right = false,
  nowrap = false,
  colSpan,
  className = "",
}: {
  children: React.ReactNode;
  tone?: TDTone;
  right?: boolean;
  nowrap?: boolean;
  colSpan?: number;
  className?: string;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "px-4 py-3 text-sm",
        tones[tone],
        right && "text-right",
        nowrap && "whitespace-nowrap",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-ink-400">
        {children}
      </td>
    </tr>
  );
}

/** Acciones de fila: Editar + Eliminar con estado deshabilitado. */
export function RowActions({
  onEdit,
  onDelete,
  editLabel = "Editar",
  deleteDisabled = false,
  deleteTitle,
}: {
  onEdit: () => void;
  onDelete: () => void;
  editLabel?: string;
  deleteDisabled?: boolean;
  deleteTitle?: string;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onEdit}
        className="text-ink-900 hover:underline font-medium text-nav mr-3 cursor-pointer"
      >
        {editLabel}
      </button>
      <button
        type="button"
        disabled={deleteDisabled}
        onClick={onDelete}
        className="text-ink-400 hover:text-ink-900 font-medium text-nav disabled:opacity-40 cursor-pointer"
        title={deleteTitle}
      >
        Eliminar
      </button>
    </>
  );
}
