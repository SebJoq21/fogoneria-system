import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChartCard, HubBlocks } from './workspace-ui';
import { ModuleSummary } from './summaries/ModuleSummary';
import { MiniArea, MiniBars, MiniDonut, MiniLine, chartTick } from './summaries/charts';

const html = (element: React.ReactElement) => renderToStaticMarkup(element);

describe('ChartCard', () => {
  it('pinta título, subtítulo y contenido; sin subtítulo lo omite', () => {
    const completo = html(
      <ChartCard title="Ventas" subtitle="Últimos 7 días">
        <span>gráfico</span>
      </ChartCard>,
    );
    expect(completo).toContain('Ventas');
    expect(completo).toContain('Últimos 7 días');
    expect(completo).toContain('gráfico');

    const simple = html(<ChartCard title="Ventas"><span /></ChartCard>);
    expect(simple).not.toContain('Últimos');
  });
});

describe('HubBlocks', () => {
  it('pinta accesos rápidos e informes por separado', () => {
    const markup = html(
      <HubBlocks
        acceso={[{ label: 'Nuevo plato', href: '/app/productos/platos/nuevo' }]}
        informes={[{ label: 'Categorías', href: '/app/productos/categorias' }]}
      />,
    );
    expect(markup).toContain('Acceso rápido');
    expect(markup).toContain('Nuevo plato');
    expect(markup).toContain('Informes y másteres');
    expect(markup).toContain('Categorías');
  });

  it('omite el acceso rápido vacío pero mantiene informes', () => {
    const markup = html(<HubBlocks acceso={[]} informes={[]} />);
    expect(markup).not.toContain('Acceso rápido');
    expect(markup).toContain('Informes y másteres');
  });

  it('un enlace con onSelect se pinta como botón', () => {
    const markup = html(
      <HubBlocks acceso={[{ label: 'Cambiar tab', onSelect: () => {} }]} informes={[]} />,
    );
    expect(markup).toContain('<button');
    expect(markup).toContain('Cambiar tab');
  });
});

describe('ModuleSummary', () => {
  const kpis = [
    { label: 'Ventas', value: '$100', hint: 'hoy' },
    { label: 'Ticket', value: '$25' },
  ];

  it('pinta KPIs y el gráfico; sin KPIs no pinta nada', () => {
    const markup = html(
      <ModuleSummary kpis={kpis} chartTitle="Resumen" chartSubtitle="del día" ariaLabel="Caja">
        <span>chart</span>
      </ModuleSummary>,
    );
    expect(markup).toContain('Ventas');
    expect(markup).toContain('Resumen');
    expect(markup).toContain('chart');
    expect(markup).toContain('aria-label="Caja"');
    expect(html(<ModuleSummary kpis={[]} chartTitle="X"><span /></ModuleSummary>)).toBe('');
  });
});

describe('gráficos', () => {
  const data = [
    { name: 'Lun', v: 10 },
    { name: 'Mar', v: 20 },
  ];

  it('muestran un vacío cuando no hay datos', () => {
    expect(html(<MiniBars data={[]} label="Barras" />)).toContain('Sin datos aún');
    expect(html(<MiniArea data={[]} label="Área" id="a" />)).toContain('Sin datos aún');
    expect(html(<MiniLine data={[]} label="Línea" />)).toContain('Sin datos aún');
    expect(html(<MiniDonut data={[]} label="Donut" />)).toContain('Sin datos aún');
    expect(html(<MiniDonut data={[{ name: 'A', v: 0 }]} label="Donut" />)).toContain(
      'Sin datos aún',
    );
  });

  it('pintan las series con datos y su etiqueta accesible', () => {
    expect(html(<MiniBars data={data} label="Barras" barSize={12} />)).toContain(
      'aria-label="Barras"',
    );
    expect(html(<MiniArea data={data} label="Área" id="area-1" />)).toContain(
      'aria-label="Área"',
    );
    expect(html(<MiniLine data={data} label="Línea" />)).toContain('aria-label="Línea"');
    const donut = html(<MiniDonut data={data} label="Donut" />);
    expect(donut).toContain('Lun');
    expect(donut).toContain('Mar');
    expect(donut).toContain('aria-label="Donut"');
  });

  it('el tick del gráfico usa la fuente del sistema', () => {
    expect(chartTick.fontSize).toBe(12);
  });
});
