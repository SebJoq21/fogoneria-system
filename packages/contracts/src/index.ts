/**
 * Barrel de contratos para bundlers y type-checking de la web.
 *
 * **La API no importa este barrel**: Node 24 carga los `.ts` por subpath
 * (`@fogoneria/contracts/tiempo-real`) con type stripping, y los reexports sin
 * extensión de este archivo no resuelven en runtime. Usa siempre el subpath.
 */
export * from './bi';
export * from './caja';
export * from './catalogo';
export * from './comprobantes';
export * from './crm';
export * from './gastos';
export * from './inventario';
export * from './mesas';
export * from './ordenes';
export * from './plataforma';
export * from './promociones';
export * from './reservas';
export * from './rrhh';
export * from './tiempo-real';

/**
 * `caja` e `inventario` tienen cada uno su `etiquetaTipoMovimiento` (movimientos
 * de caja vs. kardex). El root conserva el de caja por compatibilidad; el
 * inventario se consume por `@fogoneria/contracts/inventario`.
 */
export { etiquetaTipoMovimiento } from './caja';
