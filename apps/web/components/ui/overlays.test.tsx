import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Drawer } from './Drawer';
import { Modal } from './Modal';

describe('Drawer', () => {
  it('cerrado no pinta nada y abierto pinta título y contenido', () => {
    expect(renderToStaticMarkup(<Drawer open={false} title="Reserva" onClose={() => {}}>x</Drawer>))
      .toBe('');
    const markup = renderToStaticMarkup(
      <Drawer open title="Reserva" onClose={() => {}}>
        <p>Detalle</p>
      </Drawer>,
    );
    expect(markup).toContain('Reserva');
    expect(markup).toContain('Detalle');
  });
});

describe('Modal', () => {
  it('pinta cabecera, cuerpo y pie', () => {
    const markup = renderToStaticMarkup(
      <Modal title="Cobrar" onClose={() => {}} footer={<button>Cobrar</button>}>
        <p>Total</p>
      </Modal>,
    );
    expect(markup).toContain('Cobrar');
    expect(markup).toContain('Total');
  });

  it('wide cambia el ancho máximo y sin footer no lo pinta', () => {
    const normal = renderToStaticMarkup(
      <Modal title="Normal" onClose={() => {}}>
        <p>x</p>
      </Modal>,
    );
    const ancho = renderToStaticMarkup(
      <Modal title="Ancho" onClose={() => {}} wide>
        <p>x</p>
      </Modal>,
    );
    expect(normal).toContain('max-w-lg');
    expect(ancho).toContain('max-w-2xl');
  });
});
