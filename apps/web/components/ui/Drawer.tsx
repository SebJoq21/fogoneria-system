"use client";

/** Drawer lateral derecho (detalle de reserva). */
export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] animate-[fadeIn_0.2s_ease-out]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-sm bg-surface shadow-2xl flex flex-col animate-[scaleUp_0.2s_ease-out]">
        <div className="p-4 border-b border-ink-900/10 flex justify-between items-center shrink-0">
          <h3 className="text-sm font-medium text-ink-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-ink-400 hover:text-ink-900 p-2 rounded-lg cursor-pointer"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 overflow-y-auto no-scrollbar flex-1">{children}</div>
      </aside>
    </div>
  );
}
