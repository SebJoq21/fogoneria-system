import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { RolUsuario } from '../types/authenticated-user.js';

export interface TenantContext {
  userId: string | null;
  empresaId: string | null;
  sucursalId: string | null;
  rol: RolUsuario | null;
  /** SUPERADMIN opera sin filtro de tenant (consola SaaS). */
  bypass: boolean;
  /** Transacción con el contexto `app.*` ya fijado (RLS, tarea 62). */
  tx?: Prisma.TransactionClient;
}

const EMPTY_CONTEXT: TenantContext = {
  userId: null,
  empresaId: null,
  sucursalId: null,
  rol: null,
  bypass: false,
};

/**
 * Contexto de tenant por request usando AsyncLocalStorage.
 * Lo escribe TenantContextInterceptor y lo lee la extensión de Prisma.
 */
@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContext>();

  run<T>(context: Partial<TenantContext>, callback: () => T): T {
    return this.storage.run({ ...EMPTY_CONTEXT, ...context }, callback);
  }

  get(): TenantContext | undefined {
    return this.storage.getStore();
  }

  getOrEmpty(): TenantContext {
    return this.storage.getStore() ?? EMPTY_CONTEXT;
  }

  /** Asocia la transacción RLS del request al contexto actual. */
  setTransaction(tx: Prisma.TransactionClient): void {
    const store = this.storage.getStore();
    if (store) store.tx = tx;
  }
}
