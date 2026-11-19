export * from './caja';
export * from './catalogo';
export * from './comprobantes';
export * from './crm';
export * from './gastos';
export * from './inventario';
export * from './mesas';
export * from './ordenes';
export * from './promociones';
export * from './reservas';
export * from './rrhh';

/**
 * `caja` e `inventario` tienen cada uno su `etiquetaTipoMovimiento` (movimientos
 * de caja vs. kardex). El root conserva el de caja por compatibilidad; el
 * inventario se consume por `@fogoneria/contracts/inventario`.
 */
export { etiquetaTipoMovimiento } from './caja';
