/**
 * Feature plataforma: login, alta pública de restaurantes y consola SaaS.
 *
 * Las rutas `/`, `/onboarding` y `/saas` solo importan este índice. La sesión
 * (cookie HttpOnly, BFF y `proxy.ts`) no se toca: `LoginPage` delega en
 * `ModulesProvider.login`, que usa `/api/session`. La feature tampoco crea un
 * `TenantProvider`: `ModulesProvider` sigue siendo el dueño del estado hasta la
 * Fase 4.
 */

export { LoginPage } from './LoginPage';
export { OnboardingPage } from './OnboardingPage';
export { DropZone } from './DropZone';
export { SaasPage } from './SaasPage';
export {
  plataformaApi,
  plataformaClient,
  toEmpresa,
  toEmpresaSaas,
  toMetricas,
  toOnboardingResultado,
  toSucursal,
  toUsuarioSesion,
} from './api';
export type {
  ApiEmpresa,
  ApiEmpresaList,
  ApiEmpresaSaas,
  ApiOnboardingResultado,
  ApiSucursal,
  ApiUsuarioLogin,
  ListaEmpresasSaas,
} from './api';
export type {
  Empresa,
  EmpresaSaas,
  EmpresaSesion,
  EstadoEmpresa,
  EstadoEmpresaUi,
  MetricasSaas,
  OnboardingInput,
  OnboardingResultado,
  PlanEmpresa,
  RangoSucursales,
  RespuestaLogin,
  RolWeb,
  Sucursal,
  TonoEstado,
  UsuarioSesion,
} from '@fogoneria/contracts/plataforma';
