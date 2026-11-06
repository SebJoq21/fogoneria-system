/* Rate limit en memoria para el login (5 intentos / 10 min por IP).
   En multi-instancia esto debe moverse a Redis; aquí corta fuerza bruta
   básica sin agregar dependencias. */

const MAX_ATTEMPTS = Number(process.env.SESSION_RATE_LIMIT ?? 5);
const WINDOW_MS = Number(process.env.SESSION_RATE_WINDOW_MS ?? 10 * 60 * 1000);

type Entry = { count: number; resetAt: number };

const hits = new Map<string, Entry>();

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfter: number };

export function hitSessionRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

/** Solo para pruebas. */
export function resetSessionRateLimit(): void {
  hits.clear();
}

/** Un login correcto limpia los fallos acumulados de esa IP. */
export function clearSessionRateLimit(key: string): void {
  hits.delete(key);
}
