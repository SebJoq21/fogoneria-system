import { describe, expect, it, vi } from 'vitest';
import { CatalogController } from './catalog.controller.js';
import type { CatalogService } from './catalog.service.js';

function build() {
  const catalog = {
    listCategories: vi.fn().mockResolvedValue(['cat']),
    createCategory: vi.fn().mockResolvedValue({ id: 'cat-1' }),
    updateCategory: vi.fn().mockResolvedValue({ id: 'cat-1' }),
    deactivateCategory: vi.fn().mockResolvedValue({ id: 'cat-1' }),
    listDishes: vi.fn().mockResolvedValue({ items: [] }),
    getDish: vi.fn().mockResolvedValue({ id: 'p-1' }),
    createDish: vi.fn().mockResolvedValue({ id: 'p-1' }),
    updateDish: vi.fn().mockResolvedValue({ id: 'p-1' }),
    deleteDish: vi.fn().mockResolvedValue({ id: 'p-1' }),
    assignModifierGroups: vi.fn().mockResolvedValue({ id: 'p-1' }),
    listModifierGroups: vi.fn().mockResolvedValue([]),
    createModifierGroup: vi.fn().mockResolvedValue({ id: 'g-1' }),
    updateModifierGroup: vi.fn().mockResolvedValue({ id: 'g-1' }),
    deleteModifierGroup: vi.fn().mockResolvedValue({ id: 'g-1' }),
  };
  return { controller: new CatalogController(catalog as unknown as CatalogService), catalog };
}

const dto = {} as never;

describe('CatalogController', () => {
  it('delega el CRUD de categorías', async () => {
    const { controller, catalog } = build();
    await expect(controller.listCategories()).resolves.toEqual(['cat']);
    expect(catalog.listCategories).toHaveBeenCalledWith();
    await controller.createCategory(dto);
    expect(catalog.createCategory).toHaveBeenCalledWith(dto);
    await controller.updateCategory('cat-1', dto);
    expect(catalog.updateCategory).toHaveBeenCalledWith('cat-1', dto);
    await controller.deleteCategory('cat-1');
    expect(catalog.deactivateCategory).toHaveBeenCalledWith('cat-1');
  });

  it('delega el CRUD de platos y los grupos asignados', async () => {
    const { controller, catalog } = build();
    const query = { page: 1 } as never;
    await controller.listDishes(query);
    expect(catalog.listDishes).toHaveBeenCalledWith(query);
    await controller.getDish('p-1');
    expect(catalog.getDish).toHaveBeenCalledWith('p-1');
    await controller.createDish(dto);
    expect(catalog.createDish).toHaveBeenCalledWith(dto);
    await controller.updateDish('p-1', dto);
    expect(catalog.updateDish).toHaveBeenCalledWith('p-1', dto);
    await controller.deleteDish('p-1');
    expect(catalog.deleteDish).toHaveBeenCalledWith('p-1');
    await controller.assignGroups('p-1', { grupoIds: ['g-1'] } as never);
    expect(catalog.assignModifierGroups).toHaveBeenCalledWith('p-1', ['g-1']);
  });

  it('delega el CRUD de grupos de modificadores', async () => {
    const { controller, catalog } = build();
    await controller.listGroups();
    expect(catalog.listModifierGroups).toHaveBeenCalledWith();
    await controller.createGroup(dto);
    expect(catalog.createModifierGroup).toHaveBeenCalledWith(dto);
    await controller.updateGroup('g-1', dto);
    expect(catalog.updateModifierGroup).toHaveBeenCalledWith('g-1', dto);
    await controller.deleteGroup('g-1');
    expect(catalog.deleteModifierGroup).toHaveBeenCalledWith('g-1');
  });
});
