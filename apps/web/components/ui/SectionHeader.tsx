/** Título sección 24px medium #292929 + subtítulo 14px #5D5D5D + eyebrow 12px #9E9E9E */
export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
  dark = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  dark?: boolean;
}) {
  const alignCls = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <div className={`max-w-2xl mb-10 ${alignCls}`}>
      {eyebrow ? (
        <span
          className={`font-medium uppercase text-xs mb-3 block ${
            dark ? "text-white/50" : "text-ink-400"
          }`}
        >
          {eyebrow}
        </span>
      ) : null}
      <h2
        className={`text-section font-medium leading-tight ${
          dark ? "text-white" : "text-ink-900"
        }`}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={`text-sm mt-3 leading-relaxed ${
            dark ? "text-white/70" : "text-ink-600"
          }`}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
