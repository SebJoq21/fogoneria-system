"use client";

import { useEffect, useRef, useState } from "react";
import { useModules } from "@/components/dashboard/ModulesProvider";

function Toast({
  title,
  message,
  onDone,
}: {
  title: string;
  message: string;
  onDone: () => void;
}) {
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);
  useEffect(() => {
    const timer = setTimeout(() => doneRef.current(), 4000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[80] max-w-sm bg-surface border border-ink-900/10 rounded-2xl shadow-lg p-4 animate-[fadeIn_0.2s_ease-out]"
    >
      <p className="text-sm font-medium text-ink-900">{title}</p>
      <p className="text-xs text-ink-600 mt-0.5">{message}</p>
    </div>
  );
}

/** Campana discreta: aviso transitorio de la última notificación (4s). */
export function Toasts() {
  const { notifications } = useModules();
  const [dismissedAt, setDismissedAt] = useState(0);
  const latest = notifications[0];
  if (!latest || latest.timestamp <= dismissedAt) return null;
  return (
    <Toast
      key={latest.id}
      title={latest.title}
      message={latest.message}
      onDone={() => setDismissedAt(latest.timestamp)}
    />
  );
}
