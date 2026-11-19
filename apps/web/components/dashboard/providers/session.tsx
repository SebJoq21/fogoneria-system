"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AppUser } from "@/lib/auth";
import { createSession, logoutUrl } from "@/lib/session-api";
import {
  clearSessionUser,
  parseSessionUser,
  SESSION_USER_KEY,
  storeSessionUser,
} from "@/lib/session-state";

export type SessionContextValue = {
  /** Usuario del shell (el token real vive en la cookie HttpOnly). */
  currentUser: AppUser | null;
  /** Hay empresa en el token: las vistas operan contra la API. */
  hasSession: boolean;
  /** La hidratación del usuario desde `localStorage` ya terminó. */
  ready: boolean;
  login: (email: string, password: string) => Promise<AppUser>;
  logout: () => void;
};

const Ctx = createContext<SessionContextValue | null>(null);

/**
 * Sesión del shell. El login canjea credenciales en el BFF `/api/session`
 * (que fija las cookies HttpOnly) y el logout navega a `/api/session/logout`.
 * Aquí solo vive la identidad que pinta la UI; el proxy sigue siendo la
 * autoridad de acceso.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);

  /* Hidratación del usuario al montar (solo cliente). */
  useEffect(() => {
    try {
      const found = parseSessionUser(localStorage.getItem(SESSION_USER_KEY));
      if (found) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación de sesión (solo cliente)
        setCurrentUser(found);
      }
    } catch {
      /* almacenamiento no disponible */
    } finally {
      setReady(true);
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AppUser> => {
    const { user } = await createSession(email, password);
    setCurrentUser(user);
    setReady(true);
    storeSessionUser(user);
    return user;
  }, []);

  const logout = useCallback(() => {
    // Limpia la sesión del usuario actual y navega al logout del servidor,
    // que borra las cookies HttpOnly y redirige. El estado operativo del
    // restaurante (cuentas y caja) se conserva.
    clearSessionUser(currentUser);
    window.location.assign(logoutUrl());
  }, [currentUser]);

  const hasSession = Boolean(currentUser?.empresaId);

  const value = useMemo(
    () => ({ currentUser, hasSession, ready, login, logout }),
    [currentUser, hasSession, ready, login, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession debe usarse dentro de SessionProvider");
  return ctx;
}
