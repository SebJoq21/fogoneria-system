// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ createSession: vi.fn(), logoutUrl: vi.fn(() => '/api/session/logout') }));
vi.mock('@/lib/session-api', () => ({ createSession: api.createSession, logoutUrl: api.logoutUrl }));

import { SessionProvider, useSession } from './session';
import { NotificationsProvider, useNotifications } from './notifications';

const usuario = {
  id: 'u-1',
  name: 'Ana',
  email: 'ana@fogoneria.pe',
  role: 'admin' as const,
  empresaId: 'e-1',
  branchId: null,
  initials: 'AN',
};

function SesionSonda() {
  const { currentUser, hasSession, ready, login, logout } = useSession();
  return (
    <div>
      <span data-testid="estado">{String(currentUser?.email)}|{String(hasSession)}|{String(ready)}</span>
      <button onClick={() => void login('ana@fogoneria.pe', 'secreta').catch(() => {})}>Entrar</button>
      <button onClick={logout}>Salir</button>
    </div>
  );
}

function AvisosSonda() {
  const { notifications, hasUnread, notify, clearUnread } = useNotifications();
  return (
    <div>
      <span data-testid="avisos">{notifications.length}|{String(hasUnread)}</span>
      <button onClick={() => notify('Comanda lista', 'Mesa 4')}>Avisar</button>
      <button onClick={clearUnread}>Limpiar</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  api.createSession.mockReset();
  document.cookie = 'fogoneria.user=; Max-Age=0';
});

afterEach(cleanup);

describe('SessionProvider', () => {
  it('hidrata sin usuario y permite login', async () => {
    api.createSession.mockResolvedValue({ user: usuario });
    render(
      <SessionProvider>
        <SesionSonda />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('estado').textContent).toContain('|false|true'));

    await act(async () => {
      screen.getByText('Entrar').click();
    });
    await waitFor(() =>
      expect(screen.getByTestId('estado').textContent).toContain('ana@fogoneria.pe|true|true'),
    );
    expect(api.createSession).toHaveBeenCalledWith('ana@fogoneria.pe', 'secreta');
  });

  it('un login fallido no cambia la sesión', async () => {
    api.createSession.mockRejectedValue(new Error('401'));
    render(
      <SessionProvider>
        <SesionSonda />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('estado').textContent).toContain('|false|true'));
    await act(async () => {
      screen.getByText('Entrar').click();
    });
    expect(screen.getByTestId('estado').textContent).toContain('|false|true');
  });

  it('logout limpia el usuario y navega al endpoint del servidor', async () => {
    api.createSession.mockResolvedValue({ user: usuario });
    const assign = vi.fn();
    Object.defineProperty(window, 'location', { value: { assign }, writable: true });
    render(
      <SessionProvider>
        <SesionSonda />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('estado').textContent).toContain('|false|true'));
    await act(async () => {
      screen.getByText('Entrar').click();
    });
    await waitFor(() => expect(screen.getByTestId('estado').textContent).toContain('|true|true'));

    act(() => {
      screen.getByText('Salir').click();
    });
    expect(assign).toHaveBeenCalledWith('/api/session/logout');
    expect(localStorage.getItem('fogoneria:user')).toBeNull();
  });
});

describe('NotificationsProvider', () => {
  it('agrega avisos, marca no leído y limpia', () => {
    render(
      <NotificationsProvider>
        <AvisosSonda />
      </NotificationsProvider>,
    );
    expect(screen.getByTestId('avisos').textContent).toBe('0|false');
    act(() => {
      screen.getByText('Avisar').click();
    });
    expect(screen.getByTestId('avisos').textContent).toBe('1|true');
    act(() => {
      screen.getByText('Limpiar').click();
    });
    expect(screen.getByTestId('avisos').textContent).toBe('1|false');
  });
});
