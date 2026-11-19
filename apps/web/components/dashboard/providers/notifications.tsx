"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { Notification } from "@/lib/dashboard";
import { appendNotification } from "@/lib/notifications";

export type NotificationsContextValue = {
  notifications: Notification[];
  hasUnread: boolean;
  notify: (title: string, message: string) => void;
  clearUnread: () => void;
};

const Ctx = createContext<NotificationsContextValue | null>(null);

/**
 * Avisos del shell en memoria (no `localStorage`): el histórico no sobrevive a
 * una recarga ni se comparte entre pestañas, igual que un toast.
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasUnread, setHasUnread] = useState(false);

  const notify = useCallback((title: string, message: string) => {
    setNotifications((list) => appendNotification(list, { title, message }));
    setHasUnread(true);
  }, []);

  const clearUnread = useCallback(() => setHasUnread(false), []);

  const value = useMemo(
    () => ({ notifications, hasUnread, notify, clearUnread }),
    [notifications, hasUnread, notify, clearUnread],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNotifications debe usarse dentro de NotificationsProvider");
  return ctx;
}
