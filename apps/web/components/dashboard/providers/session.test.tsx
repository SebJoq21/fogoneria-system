import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SessionProvider, useSession } from './session';

function Sonda() {
  const { currentUser, hasSession, ready, login, logout } = useSession();
  return (
    <span>
      {String(currentUser)}|{String(hasSession)}|{String(ready)}|{typeof login}|{typeof logout}
    </span>
  );
}

describe('SessionProvider', () => {
  it('en SSR arranca sin usuario y sin sesión, y expone las acciones', () => {
    const markup = renderToStaticMarkup(
      <SessionProvider>
        <Sonda />
      </SessionProvider>,
    );
    expect(markup).toContain('null|false|false|function|function');
  });

  it('useSession fuera del provider falla cerrado', () => {
    expect(() => renderToStaticMarkup(<Sonda />)).toThrow(
      'useSession debe usarse dentro de SessionProvider',
    );
  });
});
