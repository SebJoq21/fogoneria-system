import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOrder, getOrder, listOrders } from './orders-api';
import { ThemeProvider, useTheme } from '@/components/theme';

const fetchMock = vi.fn();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('orders-api: consultas y alta', () => {
  function stub(body: unknown = {}) {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(json(body));
    vi.stubGlobal('fetch', fetchMock);
  }

  it('lista con todos los filtros', async () => {
    stub({ items: [] });
    await listOrders({
      estado: 'ENTREGADO',
      sucursalId: 's-1',
      mesaId: 'm-1',
      page: 2,
      limit: 10,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/backend/orders?estado=ENTREGADO&sucursalId=s-1&mesaId=m-1&page=2&limit=10',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('sin filtros no agrega query', async () => {
    stub({ items: [] });
    await listOrders();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/backend/orders',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('busca una comanda por id', async () => {
    stub({ id: 'o-1' });
    await getOrder('o-1');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/backend/orders/o-1',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('crea la comanda con todos los campos opcionales', async () => {
    stub({ id: 'o-1' });
    await createOrder({
      sucursalId: 's-1',
      mesaId: 'm-1',
      clienteId: 'c-1',
      origen: 'MESA',
      listaPrecioId: 'l-1',
      cuponCodigo: 'PARRILLA10',
      items: [{ tipo: 'PLATO', platoId: 'p-1', cantidad: 1 }],
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({
      sucursalId: 's-1',
      mesaId: 'm-1',
      clienteId: 'c-1',
      origen: 'MESA',
      listaPrecioId: 'l-1',
      cuponCodigo: 'PARRILLA10',
      items: [{ tipo: 'PLATO', platoId: 'p-1', cantidad: 1 }],
    });
  });

  it('crea la comanda sin opcionales', async () => {
    stub({ id: 'o-1' });
    await createOrder({ items: [{ tipo: 'PLATO', platoId: 'p-1', cantidad: 1 }] });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      items: [{ tipo: 'PLATO', platoId: 'p-1', cantidad: 1 }],
    });
  });
});

describe('ThemeProvider', () => {
  function Sonda() {
    const { theme } = useTheme();
    return <span>{theme}</span>;
  }

  it('en SSR parte del tema claro y expone el contexto', () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider>
        <Sonda />
      </ThemeProvider>,
    );
    expect(markup).toContain('light');
  });

  it('sin provider useTheme devuelve el contexto por defecto', () => {
    expect(renderToStaticMarkup(<Sonda />)).toContain('light');
  });
});
