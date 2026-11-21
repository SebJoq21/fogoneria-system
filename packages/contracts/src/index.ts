/**
 * Barrel de contratos para bundlers y type-checking de la web.
 *
 * **La API no importa este barrel**: Node 24 carga los `.ts` por subpath
 * (`@fogoneria/contracts/tiempo-real`) con type stripping, y los reexports sin
 * extensión de este archivo no resuelven en runtime. Usa siempre el subpath.
 */
export * from './bi';
export * from './auth';
export * from './audit';
export * from './billing';
export * from './catalog';
export * from './pricing';
export * from './cash';
export * from './receipts';
export * from './crm';
export * from './expenses';
export * from './inventory';
export * from './tables';
export * from './orders';
export * from './onboarding';
export * from './promotions';
export * from './realtime';
export * from './reservations';
export * from './saas';
export * from './staff';
export * from './tenant';

/**
 * `caja` e `inventario` tienen cada uno su `etiquetaTipoMovimiento` (movimientos
 * de caja vs. kardex). El root conserva el de caja por compatibilidad; el
 * inventario se consume por `@fogoneria/contracts/inventory`.
 */
export { etiquetaTipoMovimiento } from './cash';
