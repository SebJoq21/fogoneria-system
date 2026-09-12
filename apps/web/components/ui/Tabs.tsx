"use client";

/** Pestañas píldora 14px: activa negra, resto borde. */
export function Tabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`px-5 h-10 rounded-full text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
            value === o.id
              ? "bg-primary text-white"
              : "bg-surface text-ink-600 border border-ink-900/15 hover:border-ink-900"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
