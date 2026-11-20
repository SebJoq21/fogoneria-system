import { describe, expect, it, vi } from 'vitest';
import { OnboardingController } from './onboarding.controller.js';
import type { OnboardingService } from './onboarding.service.js';

function build() {
  const onboarding = {
    submit: vi.fn().mockResolvedValue({ id: 'e-1' }),
  };
  return {
    controller: new OnboardingController(onboarding as unknown as OnboardingService),
    onboarding,
  };
}

describe('OnboardingController', () => {
  it('delega el alta pública con la IP del request', async () => {
    const { controller, onboarding } = build();
    const dto = { nombreLegal: 'El Fuego' } as never;
    await controller.submit(dto, '1.1.1.1');
    expect(onboarding.submit).toHaveBeenCalledWith(dto, '1.1.1.1');
  });
});
