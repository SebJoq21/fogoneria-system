import { describe, expect, it, vi } from 'vitest';
import { TablesController } from './tables.controller.js';
import type { TablesService } from './tables.service.js';

function build() {
  const tables = {
    list: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue({ id: 'm-1' }),
    create: vi.fn().mockResolvedValue({ id: 'm-1' }),
    update: vi.fn().mockResolvedValue({ id: 'm-1' }),
    updateStatus: vi.fn().mockResolvedValue({ id: 'm-1', estado: 'MANTENIMIENTO' }),
    remove: vi.fn().mockResolvedValue({ id: 'm-1' }),
  };
  return { controller: new TablesController(tables as unknown as TablesService), tables };
}

const dto = {} as never;

describe('TablesController', () => {
  it('delega listado, detalle, alta y edición', async () => {
    const { controller, tables } = build();
    const query = { zona: 'Salón' } as never;
    await controller.list(query);
    expect(tables.list).toHaveBeenCalledWith(query);
    await controller.findOne('m-1');
    expect(tables.findOne).toHaveBeenCalledWith('m-1');
    await controller.create(dto);
    expect(tables.create).toHaveBeenCalledWith(dto);
    await controller.update('m-1', dto);
    expect(tables.update).toHaveBeenCalledWith('m-1', dto);
  });

  it('delega el bloqueo y la baja lógica', async () => {
    const { controller, tables } = build();
    await controller.updateStatus('m-1', { estado: 'MANTENIMIENTO' } as never);
    expect(tables.updateStatus).toHaveBeenCalledWith('m-1', { estado: 'MANTENIMIENTO' });
    await controller.remove('m-1');
    expect(tables.remove).toHaveBeenCalledWith('m-1');
  });
});
