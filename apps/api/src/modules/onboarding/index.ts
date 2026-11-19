/**
 * API pública del alta de tenants (`POST /onboarding`, ruta `@Public()`).
 *
 * El rate limit por IP y la validación de RUC siguen en el controlador/servicio;
 * el BFF solo reenvía esta ruta sin sesión.
 */
export { OnboardingModule } from './onboarding.module.js';
export { OnboardingService } from './onboarding.service.js';
