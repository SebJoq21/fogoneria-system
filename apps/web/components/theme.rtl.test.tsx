// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './theme';

function Sonda() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle}>
      {theme}
    </button>
  );
}

beforeEach(() => {
  document.documentElement.classList.remove('dark');
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.classList.remove('dark');
});

describe('ThemeProvider', () => {
  it('alterna la clase dark y persiste la preferencia', async () => {
    render(
      <ThemeProvider>
        <Sonda />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'light' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('fogoneria:theme')).toBe('dark');
    await waitFor(() => expect(screen.getByRole('button', { name: 'dark' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'dark' }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('fogoneria:theme')).toBe('light');
  });

  it('no rompe si el almacenamiento no está disponible', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    render(
      <ThemeProvider>
        <Sonda />
      </ThemeProvider>,
    );
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'light' }))).not.toThrow();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('lee el tema actual de la clase del documento al hidratar', () => {
    document.documentElement.classList.add('dark');
    render(
      <ThemeProvider>
        <Sonda />
      </ThemeProvider>,
    );
    expect(screen.getByRole('button', { name: 'dark' })).toBeTruthy();
  });
});
