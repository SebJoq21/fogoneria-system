import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ANON_TENANT_KEY,
  ERP_STORAGE_KEY,
  erpStorageKey,
  loadErpState,
  resetErpState,
} from './persistence';

function storageFalso(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => void data.set(key, value),
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', storageFalso());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('claves legacy por tenant', () => {
  it('namespacan el ErpState por empresa', () => {
    expect(ERP_STORAGE_KEY).toBe('fogoneria:erp:v2');
    expect(ANON_TENANT_KEY).toBe('anon');
    expect(erpStorageKey('emp-1')).toBe('fogoneria:erp:v2:emp-1');
  });
});

describe('loadErpState', () => {
  it('recupera un ErpState v2 (legacy)', () => {
    const estado = { version: 2, scopes: { miraflores: { orders: [], tables: [] } } };
    localStorage.setItem('fogoneria:erp:v2:emp-1', JSON.stringify(estado));
    expect(loadErpState('emp-1')).toEqual(estado);
  });

  it('devuelve null sin datos, con JSON roto o versión vieja', () => {
    expect(loadErpState('emp-1')).toBeNull();
    localStorage.setItem('fogoneria:erp:v2:emp-1', '{roto');
    expect(loadErpState('emp-1')).toBeNull();
    localStorage.setItem('fogoneria:erp:v2:emp-1', JSON.stringify({ version: 1 }));
    expect(loadErpState('emp-1')).toBeNull();
  });

  it('no explota si el almacenamiento falla', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('sin storage');
      },
      removeItem: () => {
        throw new Error('sin storage');
      },
    });
    expect(loadErpState('emp-1')).toBeNull();
  });
});

describe('resetErpState', () => {
  it('borra la clave legacy del tenant', () => {
    localStorage.setItem('fogoneria:erp:v2:emp-1', JSON.stringify({ version: 2 }));
    localStorage.setItem('fogoneria:erp:v2:emp-2', JSON.stringify({ version: 2 }));
    resetErpState('emp-1');
    expect(localStorage.getItem('fogoneria:erp:v2:emp-1')).toBeNull();
    expect(localStorage.getItem('fogoneria:erp:v2:emp-2')).not.toBeNull();
  });

  it('no explota si el almacenamiento falla', () => {
    vi.stubGlobal('localStorage', {
      removeItem: () => {
        throw new Error('sin storage');
      },
    });
    expect(() => resetErpState('emp-1')).not.toThrow();
  });
});
