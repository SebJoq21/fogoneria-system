/* Persistencia legacy del ERP.
   F6c3: todo el estado de negocio vive en los providers
   (`fogoneria:<id>:v1:<tenant>`). Este archivo solo conserva la lectura del
   `ErpState` v2 que dejaron las versiones anteriores, para que el loader de
   `ModulesProvider` migre y borre la clave una última vez. */

export const ERP_STORAGE_KEY = "fogoneria:erp:v2";

/** Clave de tenant para el estado mostrado sin sesión (demo offline). */
export const ANON_TENANT_KEY = "anon";

export function erpStorageKey(tenantKey: string): string {
  return `${ERP_STORAGE_KEY}:${tenantKey}`;
}

/** Estado legacy: sin campos propios, solo la marca de versión. */
export type ErpState = {
  version: 2;
};

export function loadErpState(tenantKey: string): ErpState | null {
  try {
    const raw = localStorage.getItem(erpStorageKey(tenantKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ErpState;
    if (parsed?.version !== 2) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Borra el `ErpState` legacy del tenant (tras migrarlo a los providers). */
export function resetErpState(tenantKey: string): void {
  try {
    localStorage.removeItem(erpStorageKey(tenantKey));
  } catch {
    /* almacenamiento no disponible */
  }
}
