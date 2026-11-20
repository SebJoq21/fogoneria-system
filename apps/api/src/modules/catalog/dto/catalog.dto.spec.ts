import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateCategoryDto, UpdateCategoryDto } from './category.dto.js';
import { CreateDishDto, UpdateDishDto } from './dish.dto.js';
import { ListCatalogQueryDto } from './list-catalog.dto.js';
import {
  AssignModifierGroupsDto,
  CreateModifierGroupDto,
  ModifierOptionDto,
  UpdateModifierGroupDto,
} from './modifier-group.dto.js';

const UUID = '11111111-1111-4111-8111-111111111111';
const UUID2 = '22222222-2222-4222-8222-222222222222';

async function errores<T extends object>(cls: new () => T, plain: Record<string, unknown>) {
  const errores = await validate(plainToInstance(cls, plain));
  return errores.map((error) => error.property);
}

describe('DTOs de categoría', () => {
  it('aceptan nombre, posición y activa', async () => {
    expect(await errores(CreateCategoryDto, { nombre: 'Entradas', posicion: 0, activa: true }))
      .toEqual([]);
    expect(await errores(UpdateCategoryDto, { nombre: 'Fondos', posicion: 2, activa: false }))
      .toEqual([]);
    expect(await errores(UpdateCategoryDto, {})).toEqual([]);
  });

  it('rechazan nombre largo, posición negativa y activa no booleana', async () => {
    expect(
      await errores(CreateCategoryDto, { nombre: 'x'.repeat(121), posicion: -1, activa: 'si' }),
    ).toEqual(expect.arrayContaining(['nombre', 'posicion', 'activa']));
  });
});

describe('DTOs de plato', () => {
  it('aceptan un plato completo', async () => {
    expect(
      await errores(CreateDishDto, {
        categoriaId: UUID,
        sku: 'CEV-001',
        nombre: 'Ceviche',
        descripcion: 'Clásico',
        fotoUrl: 'https://cdn/foto.jpg',
        activo: true,
        costoReal: 8.5,
        grupoIds: [UUID],
      }),
    ).toEqual([]);
    expect(await errores(UpdateDishDto, {})).toEqual([]);
  });

  it('rechazan uuid, SKU, nombre y costo inválidos', async () => {
    expect(
      await errores(CreateDishDto, {
        categoriaId: 'x',
        sku: 'x'.repeat(41),
        nombre: 'x'.repeat(161),
        costoReal: -1,
        grupoIds: ['x'],
      }),
    ).toEqual(
      expect.arrayContaining(['categoriaId', 'sku', 'nombre', 'costoReal', 'grupoIds']),
    );
  });
});

describe('DTOs de modificadores', () => {
  it('aceptan grupo con opciones anidadas y asignación', async () => {
    expect(
      await errores(CreateModifierGroupDto, {
        nombre: 'Término',
        obligatorio: true,
        permiteMultiple: false,
        activo: true,
        opciones: [{ nombre: 'Medio', precioExtra: 1.5 }],
      }),
    ).toEqual([]);
    expect(
      await errores(UpdateModifierGroupDto, {
        nombre: 'Término',
        opciones: [{ id: UUID, nombre: 'Medio' }],
      }),
    ).toEqual([]);
    expect(await errores(AssignModifierGroupsDto, { grupoIds: [UUID, UUID2] })).toEqual([]);
  });

  it('rechazan opciones con nombre largo o precio negativo', async () => {
    expect(
      await errores(ModifierOptionDto, { nombre: 'x'.repeat(121), precioExtra: -1, id: 'x' }),
    ).toEqual(expect.arrayContaining(['nombre', 'precioExtra', 'id']));
  });

  it('rechazan grupo sin nombre y asignación que no es arreglo', async () => {
    expect(await errores(CreateModifierGroupDto, {})).toContain('nombre');
    expect(await errores(AssignModifierGroupsDto, { grupoIds: 'x' })).toContain('grupoIds');
  });
});

describe('ListCatalogQueryDto', () => {
  it('acepta búsqueda, categoría y activo', async () => {
    const dto = plainToInstance(ListCatalogQueryDto, {
      search: 'ceviche',
      categoriaId: UUID,
      activo: 'true',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.activo).toBe(true);
  });

  it('rechaza uuid inválido', async () => {
    expect(await errores(ListCatalogQueryDto, { categoriaId: 'x' })).toContain('categoriaId');
  });
});
