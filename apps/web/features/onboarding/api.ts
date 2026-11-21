/**
 * API del alta pública. La implementación compartida vive en
 * `lib/platform-api.ts`; el BFF reenvía `POST /onboarding` sin sesión.
 */
import { plataformaApi } from '@/lib/platform-api';

export const onboardingApi = {
  submit: plataformaApi.onboarding,
};

export { toOnboardingResultado } from '@/lib/platform-api';
export type {
  OnboardingInput,
  OnboardingResultado,
  RangoSucursales,
} from '@fogoneria/contracts/onboarding';
