/**
 * SDK HTTP compartido por los módulos del frontend.
 *
 * Cada módulo crea su cliente con la base del BFF (`/api/backend`) y adjunta el
 * contrato de su módulo. El navegador nunca conoce la URL de la API ni el token:
 * la cookie HttpOnly viaja con `credentials: "include"`.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export type QueryValue = string | number | boolean | undefined | null;

export type ClientOptions = {
  /** Base del BFF, por ejemplo `/api/backend`. */
  baseUrl: string;
  /** Para tests: inyectar un fetch falso. */
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
};

export type RequestOptions = {
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

function messageFrom(data: unknown, status: number): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
    if (Array.isArray(message) && message.length) return message.join(', ');
  }
  return `Error ${status}`;
}

function codeFrom(data: unknown): string | undefined {
  if (data && typeof data === 'object' && 'codigo' in data) {
    const code = (data as { codigo?: unknown }).codigo;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

/** `{ a: 1, b: undefined }` → `?a=1` (omite vacíos). */
export function queryString(params: Record<string, QueryValue> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const texto = search.toString();
  return texto ? `?${texto}` : '';
}

export function createClient(options: ClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request<T>(
    path: string,
    init: RequestInit = {},
    extra: RequestOptions = {},
  ): Promise<T> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      credentials: 'include',
      ...init,
      signal: extra.signal ?? init.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        ...extra.headers,
        ...(init.headers as Record<string, string> | undefined),
      },
    });

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      throw new ApiError(messageFrom(data, response.status), response.status, codeFrom(data));
    }

    return data as T;
  }

  return {
    request,
    get<T>(path: string, extra?: RequestOptions): Promise<T> {
      return request<T>(path, { method: 'GET' }, extra);
    },
    post<T>(path: string, body?: unknown, extra?: RequestOptions): Promise<T> {
      return request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }, extra);
    },
    patch<T>(path: string, body?: unknown, extra?: RequestOptions): Promise<T> {
      return request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }, extra);
    },
    put<T>(path: string, body?: unknown, extra?: RequestOptions): Promise<T> {
      return request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }, extra);
    },
    delete<T>(path: string, extra?: RequestOptions): Promise<T> {
      return request<T>(path, { method: 'DELETE' }, extra);
    },
  };
}

export type SdkClient = ReturnType<typeof createClient>;
