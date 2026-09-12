type Tone = "neutral" | "success" | "danger" | "warning" | "dark";

const tones: Record<Tone, string> = {
  neutral: "bg-primary/[0.05] text-ink-600",
  success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  danger: "bg-red-50 text-red-700 border border-red-200",
  warning: "bg-amber-50 text-amber-700 border border-amber-200",
  dark: "bg-primary text-white",
};

/** Badge 12px medium. Tonos funcionales solo para estados. */
export function Badge({
  tone = "neutral",
  dot = false,
  children,
  className = "",
}: {
  tone?: Tone;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const dotColor =
    tone === "success"
      ? "bg-emerald-500"
      : tone === "danger"
        ? "bg-red-500"
        : tone === "warning"
          ? "bg-amber-500"
          : tone === "dark"
            ? "bg-surface"
            : "bg-ink-400";
  return (
    <span
      className={`inline-flex w-max items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${tones[tone]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />}
      {children}
    </span>
  );
}
