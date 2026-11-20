import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { ConfirmDialog } from './ConfirmDialog';
import { KpiCard } from './KpiCard';
import { Progress } from './Progress';
import { SectionHeader } from './SectionHeader';
import { Tabs } from './Tabs';
import { Toggle } from './Toggle';
import { Toolbar } from './Toolbar';
import { Field, Select, Textarea, TextInput } from './fields';
import { EmptyRow, RowActions, TD, TH, THead, TR, TableCard } from './data-table';

const html = (element: React.ReactElement) => renderToStaticMarkup(element);

describe('Badge', () => {
  it('pinta los cinco tonos y el punto de color', () => {
    for (const tone of ['neutral', 'success', 'danger', 'warning', 'dark'] as const) {
      expect(html(<Badge tone={tone}>{tone}</Badge>)).toContain(tone);
    }
    expect(html(<Badge tone="success" dot>ok</Badge>)).toContain('bg-emerald-500');
    expect(html(<Badge tone="danger" dot>no</Badge>)).toContain('bg-red-500');
    expect(html(<Badge tone="warning" dot>ojo</Badge>)).toContain('bg-amber-500');
    expect(html(<Badge tone="dark" dot>dark</Badge>)).toContain('bg-surface');
    expect(html(<Badge dot>neutral</Badge>)).toContain('bg-ink-400');
  });
});

describe('Button', () => {
  it('renderiza un button con variantes y clases', () => {
    for (const variant of ['primary', 'secondary', 'ghost', 'light', 'danger'] as const) {
      expect(html(<Button variant={variant}>{variant}</Button>)).toContain('<button');
    }
    expect(html(<Button className="extra">Guardar</Button>)).toContain('extra');
    expect(html(<Button type="submit" disabled>Guardar</Button>)).toContain('disabled');
  });

  it('renderiza un enlace cuando recibe href', () => {
    const markup = html(<Button href="/app/caja">Caja</Button>);
    expect(markup).toContain('<a');
    expect(markup).toContain('href="/app/caja"');
  });
});

describe('Card', () => {
  it('usa un div por defecto y el tag o enlace cuando se pide', () => {
    expect(html(<Card>contenido</Card>)).toContain('<div');
    expect(html(<Card as="section">sección</Card>)).toContain('<section');
    expect(html(<Card as="article" className="x">artículo</Card>)).toContain('<article');
    expect(html(<Card href="/app">ir</Card>)).toContain('href="/app"');
  });
});

describe('KpiCard, Progress y SectionHeader', () => {
  it('pinta KPI completo y sin hint', () => {
    expect(html(<KpiCard label="Ventas" value="$100" hint="hoy" />)).toContain('$100');
    expect(html(<KpiCard label="Ventas" value="$100" />)).not.toContain('hoy');
  });

  it('limita el progreso entre 0 y 100', () => {
    expect(html(<Progress value={5} max={10} />)).toContain('width:50%');
    expect(html(<Progress value={50} max={10} />)).toContain('width:100%');
    expect(html(<Progress value={-5} max={10} />)).toContain('width:0%');
    expect(html(<Progress value={1} max={10} className="extra" />)).toContain('extra');
  });

  it('renderiza encabezados con eyebrow, descripción y variantes', () => {
    const completo = html(
      <SectionHeader eyebrow="ERP" title="Título" description="Detalle" dark />,
    );
    expect(completo).toContain('ERP');
    expect(completo).toContain('Título');
    expect(completo).toContain('Detalle');
    expect(html(<SectionHeader title="Izquierda" align="left" />)).toContain('text-left');
    expect(html(<SectionHeader title="Simple" />)).not.toContain('ERP');
  });
});

describe('Tabs, Toggle y Toolbar', () => {
  it('marca la pestaña activa y pinta todas', () => {
    const markup = html(
      <Tabs
        options={[
          { id: 'a', label: 'Uno' },
          { id: 'b', label: 'Dos' },
        ]}
        value="b"
        onChange={() => {}}
      />,
    );
    expect(markup).toContain('Uno');
    expect(markup).toContain('Dos');
    expect(markup).toContain('bg-primary text-white');
  });

  it('toggle refleja el estado y la etiqueta', () => {
    const activo = html(<Toggle checked onChange={() => {}} label="Activo" />);
    expect(activo).toContain('aria-checked="true"');
    expect(activo).toContain('left-[18px]');
    const inactivo = html(<Toggle checked={false} onChange={() => {}} />);
    expect(inactivo).toContain('aria-checked="false"');
    expect(inactivo).toContain('left-0.5');
  });

  it('toolbar pinta ambos lados y omite el derecho', () => {
    expect(html(<Toolbar left="12 mesas" right={<button>Nuevo</button>} />)).toContain('Nuevo');
    expect(html(<Toolbar left="12 mesas" />)).not.toContain('Nuevo');
  });
});

describe('Campos de formulario', () => {
  it('renderiza inputs normal y de código, select y textarea', () => {
    expect(html(<TextInput placeholder="Nombre" />)).toContain('placeholder="Nombre"');
    expect(html(<TextInput variant="code" defaultValue="123" />)).toContain('tracking-[0.3em]');
    expect(html(<Select defaultValue="a"><option value="a">A</option></Select>)).toContain('<select');
    expect(html(<Textarea placeholder="Notas" />)).toContain('<textarea');
  });

  it('Field pinta etiqueta, ayuda y htmlFor', () => {
    const markup = html(
      <Field label="Correo" hint="Tu correo" htmlFor="email">
        <TextInput id="email" />
      </Field>,
    );
    expect(markup).toContain('Correo');
    expect(markup).toContain('Tu correo');
    expect(markup).toContain('for="email"');
    expect(html(<Field label="Sin ayuda"><span /></Field>)).not.toContain('text-xs');
  });
});

describe('Tabla de datos', () => {
  it('pinta cabecera, filas, celdas, vacío y acciones', () => {
    const tabla = html(
      <TableCard header={<span>Filtros</span>} footer={<span>Pie</span>} className="extra">
        <THead>
          <TR>
            <TH>Nombre</TH>
            <TH right>Total</TH>
          </TR>
        </THead>
        <tbody>
          <TR className="fila">
            <TD tone="strong">Lomo</TD>
            <TD tone="muted" right nowrap colSpan={2}>$24.90</TD>
          </TR>
          <EmptyRow colSpan={2}>Sin datos</EmptyRow>
        </tbody>
      </TableCard>,
    );
    expect(tabla).toContain('Filtros');
    expect(tabla).toContain('Pie');
    expect(tabla).toContain('Lomo');
    expect(tabla).toContain('text-right');
    expect(tabla).toContain('whitespace-nowrap');
    expect(tabla).toContain('Sin datos');
    expect(tabla).toContain('extra');
    expect(html(<TableCard><tbody /></TableCard>)).not.toContain('border-b');
  });

  it('RowActions usa etiquetas y deshabilita el borrado', () => {
    const markup = html(
      <RowActions onEdit={() => {}} onDelete={() => {}} editLabel="Cambiar" deleteDisabled deleteTitle="No se puede" />,
    );
    expect(markup).toContain('Cambiar');
    expect(markup).toContain('disabled');
    expect(markup).toContain('title="No se puede"');
    expect(html(<RowActions onEdit={() => {}} onDelete={() => {}} />)).toContain('Editar');
  });
});

describe('ConfirmDialog', () => {
  it('no pinta nada cerrado y pinta el contenido abierto', () => {
    const cerrar = vi.fn();
    expect(html(<ConfirmDialog open={false} title="¿Seguro?" message="Se anulará" onCancel={cerrar} onConfirm={cerrar} />))
      .toBe('');
    const abierto = html(
      <ConfirmDialog open title="¿Seguro?" message="Se anulará" confirmLabel="Anular" danger onCancel={cerrar} onConfirm={cerrar} />,
    );
    expect(abierto).toContain('¿Seguro?');
    expect(abierto).toContain('Se anulará');
    expect(abierto).toContain('Anular');
  });
});
