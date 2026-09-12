import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

const inputBase =
  "w-full px-4 h-10 rounded-full border border-ink-900/15 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all text-sm text-ink-900 placeholder:text-ink-400 bg-surface";

/** Input píldora del sistema (texto, número, email, password…). */
export function TextInput({
  className = "",
  variant = "default",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  variant?: "default" | "code";
}) {
  if (variant === "code") {
    return (
      <input
        {...props}
        className={cn(
          "w-full px-4 py-3 rounded-2xl border border-ink-900/15 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all text-sm text-ink-900 placeholder:text-ink-400 bg-surface text-center tracking-[0.3em]",
          className,
        )}
      />
    );
  }
  return <input {...props} className={cn(inputBase, className)} />;
}

/** Textarea del sistema (cards y modales). */
export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full px-4 py-2.5 rounded-2xl border border-ink-900/15 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none resize-none transition-all text-sm text-ink-900 placeholder:text-ink-400 bg-surface",
        className,
      )}
    />
  );
}

/** Select píldora del sistema. */
export function Select({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputBase, "bg-surface cursor-pointer", className)} />;
}

/** Etiqueta + campo + ayuda opcional. */
export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-nav font-medium text-ink-600 mb-1"
      >
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-400 mt-1">{hint}</p>}
    </div>
  );
}
