import { describe, expect, it } from 'vitest';
import {
  BLOQUES_TURNO,
  ESTADOS_ASISTENCIA,
  etiquetaAsistencia,
  etiquetaBloque,
  isBloqueTurno,
  isEstadoAsistencia,
  validarMarcacion,
} from './rrhh';

describe('guardas de RRHH', () => {
  it('reconoce estados de asistencia y bloques', () => {
    for (const estado of ESTADOS_ASISTENCIA) expect(isEstadoAsistencia(estado)).toBe(true);
    expect(isEstadoAsistencia('VACACIONES')).toBe(false);
    for (const bloque of BLOQUES_TURNO) expect(isBloqueTurno(bloque)).toBe(true);
    expect(isBloqueTurno('MADRUGADA')).toBe(false);
  });
});

describe('validarMarcacion', () => {
  it('acepta empleado y estado válidos', () => {
    expect(validarMarcacion({ empleadoId: 'emp-1', estado: 'PRESENTE' })).toBeNull();
  });

  it('rechaza empleado vacío o estado inválido', () => {
    expect(validarMarcacion({})).toBe('Falta el empleado');
    expect(validarMarcacion({ empleadoId: '   ' })).toBe('Falta el empleado');
    expect(validarMarcacion({ empleadoId: 'emp-1' })).toBe('Estado de asistencia inválido');
    expect(validarMarcacion({ empleadoId: 'emp-1', estado: 'VACACIONES' })).toBe(
      'Estado de asistencia inválido',
    );
  });
});

describe('etiquetas de RRHH', () => {
  it('traduce la asistencia', () => {
    expect(etiquetaAsistencia('PRESENTE')).toBe('Presente');
    expect(etiquetaAsistencia('TARDANZA')).toBe('Tardanza');
    expect(etiquetaAsistencia('FALTA')).toBe('Falta');
    expect(etiquetaAsistencia('DESCANSO')).toBe('Descanso');
  });

  it('traduce el bloque del turno', () => {
    expect(etiquetaBloque('MANANA')).toBe('Mañana');
    expect(etiquetaBloque('TARDE')).toBe('Tarde');
    expect(etiquetaBloque('NOCHE')).toBe('Noche');
  });
});
