/**
 * Feature Promociones (combos, cupones y reglas horarias).
 *
 * Las vistas siguen leyendo el estado demo de `ModulesProvider`; `promocionesApi`
 * deja listo el contrato de la API (con `PRICING_PORT` y el descuento en el
 * servidor) sin duplicar el mapeo. Las rutas solo importan este índice.
 */

export { CombosPage } from './CombosPage';
export { PromocionesPage } from './PromocionesPage';
export {
  horaDeApi,
  promocionesApi,
  promocionesClient,
  toCombo,
  toCupon,
  toReglaHoraria,
} from './api';
export type { ApiCombo, ApiCupon, ApiReglaHoraria, ValidacionCupon } from './api';
export type {
  Combo,
  ComboInput,
  ComboPlato,
  ComboUpdate,
  Cupon,
  CuponInput,
  CuponResuelto,
  CuponUpdate,
  EstadoCupon,
  ReglaHoraria,
  TipoDescuentoCupon,
} from '@fogoneria/contracts/promociones';
