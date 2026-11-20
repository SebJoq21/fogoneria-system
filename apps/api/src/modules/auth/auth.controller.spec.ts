import { describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller.js';
import type { AuthService } from './auth.service.js';

function build() {
  const auth = {
    login: vi.fn().mockResolvedValue({ accessToken: 'jwt' }),
    me: vi.fn().mockResolvedValue({ id: 'u-1', tenant: null }),
    issueWsTicket: vi.fn().mockResolvedValue({ ticket: 'ws' }),
  };
  return { controller: new AuthController(auth as unknown as AuthService), auth };
}

const user = { sub: 'u-1', empresaId: 'e-1' } as never;

describe('AuthController', () => {
  it('delega el login con el DTO', async () => {
    const { controller, auth } = build();
    const dto = { email: 'a@b.com', password: 'x' } as never;
    await expect(controller.login(dto)).resolves.toEqual({ accessToken: 'jwt' });
    expect(auth.login).toHaveBeenCalledWith(dto);
  });

  it('delega el usuario del token y el ticket de WebSockets', async () => {
    const { controller, auth } = build();
    await controller.me(user);
    expect(auth.me).toHaveBeenCalledWith(user);
    await expect(controller.wsTicket(user)).resolves.toEqual({ ticket: 'ws' });
    expect(auth.issueWsTicket).toHaveBeenCalledWith(user);
  });
});
