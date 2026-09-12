"use client";

/** Modal genérico centrado (reemplaza modales ad-hoc). */
export function Modal({
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        className={`bg-surface w-full rounded-2xl shadow-2xl overflow-hidden animate-[scaleUp_0.2s_ease-out] flex flex-col max-h-[90vh] ${
          wide ? "max-w-2xl" : "max-w-lg"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
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
        <div className="p-4 overflow-y-auto no-scrollbar">{children}</div>
        {footer && (
          <div className="p-4 border-t border-ink-900/10 flex justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
