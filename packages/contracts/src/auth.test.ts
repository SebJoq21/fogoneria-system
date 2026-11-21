import { describe, expect, it } from 'vitest';
import { esRolWeb, etiquetaRol, rolDesdeApi, ROLES_WEB } from './auth';

describe('contrato de auth', () => {
  it('mapea los roles de la API y rechaza desconocidos', () => {
    expect(rolDesdeApi('ADMIN_GLOBAL')).toBe('admin');
    expect(rolDesdeApi('GERENTE_SUCURSAL')).toBe('sucursal');
    expect(rolDesdeApi('SUPERADMIN')).toBe('superadmin');
    expect(rolDesdeApi('ROBOT')).toBeNull();
    expect(esRolWeb('cajero')).toBe(true);
    expect(esRolWeb('ROBOT')).toBe(false);
  });

  it('etiqueta los roles del shell', () => {
    expect(etiquetaRol('mesero')).toBe('Mesero');
    expect(etiquetaRol('admin')).toBe('Dueño franquicia');
    expect(ROLES_WEB).toHaveLength(6);
  });
});
