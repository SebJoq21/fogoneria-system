import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NotificationsProvider, useNotifications } from './notifications';

function Sonda() {
  const { notifications, hasUnread, notify, clearUnread } = useNotifications();
  return (
    <span>
      {notifications.length}|{String(hasUnread)}|{typeof notify}|{typeof clearUnread}
    </span>
  );
}

describe('NotificationsProvider', () => {
  it('arranca sin avisos y expone notify/clearUnread', () => {
    const markup = renderToStaticMarkup(
      <NotificationsProvider>
        <Sonda />
      </NotificationsProvider>,
    );
    expect(markup).toContain('0|false|function|function');
  });

  it('useNotifications fuera del provider falla cerrado', () => {
    expect(() => renderToStaticMarkup(<Sonda />)).toThrow(
      'useNotifications debe usarse dentro de NotificationsProvider',
    );
  });
});
