/** KPI card 16px: etiqueta 12px ink-400 + valor 24px ink-900. */
export function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-surface p-4 rounded-2xl border border-ink-900/10 flex flex-col justify-between">
      <p className="text-xs font-medium text-ink-400 mb-2 uppercase">
        {label}
      </p>
      <p className="text-display font-medium text-ink-900">{value}</p>
      {hint && <p className="text-xs text-ink-600 mt-1">{hint}</p>}
    </div>
  );
}
