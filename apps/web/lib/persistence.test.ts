import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ANON_TENANT_KEY,
  ERP_STORAGE_KEY,
  ERP_SYNC_CHANNEL,
  broadcastErpState,
  erpStorageKey,
  erpSyncChannel,
  loadErpState,
  resetErpState,
  saveErpState,
  subscribeErpSync,
} from './persistence';
import type { ErpState } from './persistence';

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];
  static supported = true;
  readonly name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  readonly posted: unknown[] = [];
  closed = false;

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.instances.push(this);
  }

  postMessage(message: unknown) {
    this.posted.push(message);
  }

  close() {
    this.closed = true;
  }

  emit(message: unknown) {
    this.onmessage?.({ data: message } as MessageEvent);
  }
}

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

const estado = { version: 2, scopes: {} } as unknown as ErpState;

beforeEach(() => {
  FakeBroadcastChannel.instances = [];
  FakeBroadcastChannel.supported = true;
  vi.stubGlobal('localStorage', storageFalso());
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('claves por tenant', () => {
  it('namespacen el estado y el canal por empresa', () => {
    expect(ERP_STORAGE_KEY).toBe('fogoneria:erp:v2');
    expect(ERP_SYNC_CHANNEL).toBe('fogoneria:erp-sync');
    expect(ANON_TENANT_KEY).toBe('anon');
    expect(erpStorageKey('emp-1')).toBe('fogoneria:erp:v2:emp-1');
    expect(erpSyncChannel('emp-1')).toBe('fogoneria:erp-sync:emp-1');
  });
});

describe('loadErpState / saveErpState', () => {
  it('guarda y recupera el estado', () => {
    saveErpState('emp-1', estado);
    expect(localStorage.getItem('fogoneria:erp:v2:emp-1')).toBe(JSON.stringify(estado));
    expect(loadErpState('emp-1')).toEqual(estado);
  });

  it('devuelve null sin datos, con JSON roto o versión vieja', () => {
    expect(loadErpState('emp-1')).toBeNull();
    localStorage.setItem('fogoneria:erp:v2:emp-1', '{roto');
    expect(loadErpState('emp-1')).toBeNull();
    localStorage.setItem('fogoneria:erp:v2:emp-1', JSON.stringify({ version: 1, scopes: {} }));
    expect(loadErpState('emp-1')).toBeNull();
    localStorage.setItem('fogoneria:erp:v2:emp-1', JSON.stringify({ version: 2 }));
    expect(loadErpState('emp-1')).toBeNull();
  });

  it('no explota si el almacenamiento falla', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('sin storage');
      },
      setItem: () => {
        throw new Error('sin storage');
      },
      removeItem: () => {
        throw new Error('sin storage');
      },
    });
    expect(loadErpState('emp-1')).toBeNull();
    expect(() => saveErpState('emp-1', estado)).not.toThrow();
  });
});

describe('resetErpState', () => {
  it('borra la clave y avisa a las otras pestañas', () => {
    saveErpState('emp-1', estado);
    resetErpState('emp-1');
    expect(localStorage.getItem('fogoneria:erp:v2:emp-1')).toBeNull();
    const canal = FakeBroadcastChannel.instances.at(-1)!;
    expect(canal.name).toBe('fogoneria:erp-sync:emp-1');
    expect(canal.posted).toEqual([{ type: 'reset' }]);
    expect(canal.closed).toBe(true);
  });

  it('funciona sin BroadcastChannel', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    saveErpState('emp-1', estado);
    expect(() => resetErpState('emp-1')).not.toThrow();
    expect(localStorage.getItem('fogoneria:erp:v2:emp-1')).toBeNull();
  });
});

describe('sincronización entre pestañas', () => {
  it('escucha los mensajes del mismo tenant y cierra el canal al desuscribirse', () => {
    const onMessage = vi.fn();
    const stop = subscribeErpSync('emp-1', onMessage);
    const canal = FakeBroadcastChannel.instances.at(-1)!;
    expect(canal.name).toBe('fogoneria:erp-sync:emp-1');

    canal.emit({ type: 'state', state: estado });
    expect(onMessage).toHaveBeenCalledWith({ type: 'state', state: estado });

    stop();
    expect(canal.closed).toBe(true);
  });

  it('sin BroadcastChannel devuelve un cleanup inofensivo', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const stop = subscribeErpSync('emp-1', vi.fn());
    expect(() => stop()).not.toThrow();
  });

  it('emite el estado a las otras pestañas', () => {
    broadcastErpState('emp-1', estado);
    const canal = FakeBroadcastChannel.instances.at(-1)!;
    expect(canal.posted).toEqual([{ type: 'state', state: estado }]);
    expect(canal.closed).toBe(true);
  });

  it('sin BroadcastChannel no hace nada', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    expect(() => broadcastErpState('emp-1', estado)).not.toThrow();
  });
});
