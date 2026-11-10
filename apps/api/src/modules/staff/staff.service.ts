import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TenantContextService } from '../../common/context/tenant-context.service.js';
import { AuditService } from '../audit/audit.service.js';
import { cuentaParaPropinas, diaLima, repartirPropinas } from './staff.rules.js';
import type {
  CalculateTipsDto,
  CreateShiftDto,
  ListDayQueryDto,
  ListEmployeesQueryDto,
  MarkAttendanceDto,
} from './dto/staff.dto.js';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * RRHH de operación: plan de turnos, marcación de asistencia y reparto de
 * propinas (AYCDS-33).
 *
 * Reglas:
 *  - **Una marcación por empleado y día**: la tabla tiene un único
 *    `(empleado_id, fecha)`, así que volver a marcar actualiza en vez de
 *    duplicar (upsert).
 *  - **El pozo sale de la propina cobrada**: suma `ordenes.propina` del día en
 *    la sucursal (la columna que llena el cobro de AYCDS-34).
 *  - **Reparten solo los presentes**: asistencias `PRESENTE` o `TARDANZA`; una
 *    falta no cobra. El reparto es exacto al céntimo (`repartirPropinas`).
 *  - **Un pozo por sucursal y día**: el índice único evita pagar dos veces el
 *    mismo día; confirmarlo es idempotente.
 */
@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  /* ------------------------------ empleados ------------------------------ */

  async listEmployees(query: ListEmployeesQueryDto) {
    const sucursalId = this.resolveSucursalFiltro(query.sucursalId);
    return this.prisma.scoped.empleados.findMany({
      where: {
        deleted_at: null,
        ...(sucursalId ? { sucursal_id: sucursalId } : {}),
        ...(query.activo === undefined ? { activo: true } : { activo: query.activo }),
      },
      orderBy: { nombre: 'asc' },
      include: { roles_empresa: { select: { id: true, nombre: true } } },
    });
  }

  /* -------------------------------- turnos ------------------------------- */

  async listShifts(query: ListDayQueryDto) {
    const sucursalId = this.resolveSucursalFiltro(query.sucursalId);
    if (!sucursalId) {
      throw new BadRequestException(
        'Indica sucursalId: tu usuario no está atado a una sucursal',
      );
    }

    return this.prisma.scoped.turnos_plan.findMany({
      where: { sucursal_id: sucursalId, fecha: this.dia(query.fecha) },
      orderBy: [{ bloque: 'asc' }, { empleados: { nombre: 'asc' } }],
      include: { empleados: { select: { id: true, nombre: true } } },
    });
  }

  async createShift(dto: CreateShiftDto) {
    const { empresaId, userId } = this.tenant();
    const sucursalId = await this.resolveSucursal(dto.sucursalId);
    const empleado = await this.requireEmpleado(dto.empleadoId, sucursalId);

    let turno;
    try {
      turno = await this.prisma.scoped.turnos_plan.create({
        data: {
          empresa_id: empresaId,
          sucursal_id: sucursalId,
          empleado_id: empleado.id,
          fecha: this.dia(dto.fecha),
          bloque: dto.bloque,
        },
        include: { empleados: { select: { id: true, nombre: true } } },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'Ese empleado ya tiene un turno en ese bloque y día',
        );
      }
      throw error;
    }

    await this.audit.record({
      empresaId,
      sucursalId,
      usuarioId: userId,
      accion: 'turno.creado',
      entidad: 'turnos_plan',
      entidadId: turno.id,
      detalle: { empleado: turno.empleados.nombre, fecha: dto.fecha, bloque: dto.bloque },
    });

    return turno;
  }

  async removeShift(id: string) {
    const { empresaId, userId } = this.tenant();
    const turno = await this.prisma.scoped.turnos_plan.findFirst({
      where: { id },
      select: { id: true, sucursal_id: true, empleado_id: true, fecha: true, bloque: true },
    });
    if (!turno) throw new NotFoundException('Turno no encontrado');

    // El plan se corrige: no es contabilidad, se puede borrar.
    await this.prisma.scoped.turnos_plan.delete({ where: { id } });

    await this.audit.record({
      empresaId,
      sucursalId: turno.sucursal_id,
      usuarioId: userId,
      accion: 'turno.borrado',
      entidad: 'turnos_plan',
      entidadId: id,
      detalle: { empleadoId: turno.empleado_id, bloque: turno.bloque },
    });

    return { id, eliminado: true };
  }

  /* ------------------------------ asistencia ----------------------------- */

  async listAttendance(query: ListDayQueryDto) {
    const sucursalId = this.resolveSucursalFiltro(query.sucursalId);
    if (!sucursalId) {
      throw new BadRequestException(
        'Indica sucursalId: tu usuario no está atado a una sucursal',
      );
    }

    return this.prisma.scoped.asistencias.findMany({
      where: { sucursal_id: sucursalId, fecha: this.dia(query.fecha) },
      orderBy: { empleados: { nombre: 'asc' } },
      include: { empleados: { select: { id: true, nombre: true } } },
    });
  }

  /**
   * Marcación del día. Es un upsert por `(empleado, fecha)`: el portero puede
   * corregir una marcación, pero no crear dos.
   */
  async markAttendance(dto: MarkAttendanceDto) {
    const { empresaId, userId } = this.tenant();
    const sucursalId = await this.resolveSucursal(dto.sucursalId);
    await this.requireEmpleado(dto.empleadoId, sucursalId);

    const fecha = this.dia(dto.fecha);
    const data = {
      estado: dto.estado,
      ...(dto.horaEntrada ? { hora_entrada: new Date(dto.horaEntrada) } : {}),
      ...(dto.horaSalida ? { hora_salida: new Date(dto.horaSalida) } : {}),
      ...(dto.fuente ? { fuente: dto.fuente } : {}),
    };

    const asistencia = await this.prisma.scoped.asistencias.upsert({
      where: { empleado_id_fecha: { empleado_id: dto.empleadoId, fecha } },
      create: {
        empresa_id: empresaId,
        sucursal_id: sucursalId,
        empleado_id: dto.empleadoId,
        fecha,
        ...data,
      },
      update: data,
      include: { empleados: { select: { id: true, nombre: true } } },
    });

    await this.audit.record({
      empresaId,
      sucursalId,
      usuarioId: userId,
      accion: 'asistencia.marcada',
      entidad: 'asistencias',
      entidadId: asistencia.id,
      detalle: {
        empleado: asistencia.empleados.nombre,
        estado: dto.estado,
        fuente: asistencia.fuente,
      },
    });

    return asistencia;
  }

  /* -------------------------------- propinas ----------------------------- */

  async listPools(query: ListDayQueryDto) {
    const sucursalId = this.resolveSucursalFiltro(query.sucursalId);
    return this.prisma.scoped.pozos_propinas.findMany({
      where: sucursalId ? { sucursal_id: sucursalId } : {},
      orderBy: { fecha: 'desc' },
      take: 30,
      include: { _count: { select: { repartos_propinas: true } } },
    });
  }

  async getPool(id: string) {
    const pozo = await this.prisma.scoped.pozos_propinas.findFirst({
      where: { id },
      include: {
        repartos_propinas: {
          include: { empleados: { select: { id: true, nombre: true } } },
          orderBy: { monto: 'desc' },
        },
      },
    });
    if (!pozo) throw new NotFoundException('Pozo de propinas no encontrado');
    return pozo;
  }

  /**
   * Calcula el pozo del día y lo reparte entre los presentes.
   *
   * El total sale de `ordenes.propina` (lo que el cobro registró) y los
   * beneficiarios de las asistencias del día. Se crea el pozo en `CALCULADO`
   * con sus repartos; `confirm` lo pasa a `REPARTIDO` cuando se paga.
   */
  async calculateTips(dto: CalculateTipsDto) {
    const { empresaId, userId } = this.tenant();
    const sucursalId = await this.resolveSucursal(dto.sucursalId);
    const fechaTexto = dto.fecha ?? diaLima();
    const fecha = this.dia(fechaTexto);

    const existente = await this.prisma.scoped.pozos_propinas.findFirst({
      where: { sucursal_id: sucursalId, fecha },
      select: { id: true },
    });
    if (existente) {
      throw new ConflictException(
        'El pozo de propinas de ese día ya fue calculado',
      );
    }

    const { start, end } = this.rangoDia(fechaTexto);
    const propinas = await this.prisma.scoped.ordenes.aggregate({
      where: { sucursal_id: sucursalId, created_at: { gte: start, lt: end } },
      _sum: { propina: true },
    });
    const total = round2(Number(propinas._sum.propina ?? 0));
    if (total <= 0) {
      throw new BadRequestException(
        'No hay propinas cobradas ese día en esta sucursal',
      );
    }

    const asistencias = await this.prisma.scoped.asistencias.findMany({
      where: { sucursal_id: sucursalId, fecha },
      select: { empleado_id: true, estado: true },
    });
    const beneficiarios = asistencias
      .filter((asistencia) => cuentaParaPropinas(asistencia.estado))
      .map((asistencia) => asistencia.empleado_id);
    if (beneficiarios.length === 0) {
      throw new BadRequestException(
        'No hay personal presente ese día: marca la asistencia antes de repartir',
      );
    }

    const montos = repartirPropinas(total, beneficiarios.length);
    const pozo = await this.prisma.scoped.pozos_propinas.create({
      data: {
        empresa_id: empresaId,
        sucursal_id: sucursalId,
        fecha,
        total,
        nro_beneficiarios: beneficiarios.length,
        estado: 'CALCULADO',
        repartos_propinas: {
          create: beneficiarios.map((empleadoId, indice) => ({
            empleado_id: empleadoId,
            monto: montos[indice],
            presente: true,
          })),
        },
      },
      include: {
        repartos_propinas: {
          include: { empleados: { select: { id: true, nombre: true } } },
        },
      },
    });

    await this.audit.record({
      empresaId,
      sucursalId,
      usuarioId: userId,
      accion: 'propinas.calculadas',
      entidad: 'pozos_propinas',
      entidadId: pozo.id,
      detalle: {
        fecha: fechaTexto,
        total,
        beneficiarios: beneficiarios.length,
      },
    });

    return pozo;
  }

  /** Marca el pozo como pagado. Repetirlo no cambia nada (idempotente). */
  async confirmPool(id: string) {
    const { empresaId, userId } = this.tenant();
    const pozo = await this.prisma.scoped.pozos_propinas.findFirst({
      where: { id },
      select: { id: true, sucursal_id: true, estado: true, total: true },
    });
    if (!pozo) throw new NotFoundException('Pozo de propinas no encontrado');

    if (pozo.estado === 'REPARTIDO') return this.getPool(id);

    await this.prisma.scoped.pozos_propinas.updateMany({
      where: { id, estado: 'CALCULADO' },
      data: { estado: 'REPARTIDO' },
    });

    await this.audit.record({
      empresaId,
      sucursalId: pozo.sucursal_id,
      usuarioId: userId,
      accion: 'propinas.repartidas',
      entidad: 'pozos_propinas',
      entidadId: id,
      detalle: { total: Number(pozo.total) },
    });

    return this.getPool(id);
  }

  /* ------------------------------- internos ------------------------------ */

  /** `YYYY-MM-DD` → medianoche de Lima como `Date` para columnas `@db.Date`. */
  private dia(fecha?: string): Date {
    const texto = fecha ?? diaLima();
    return new Date(`${texto}T00:00:00-05:00`);
  }

  /** Rango [inicio, fin) del día de Lima, para filtrar timestamps. */
  private rangoDia(fecha: string): { start: Date; end: Date } {
    const start = new Date(`${fecha}T00:00:00-05:00`);
    return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
  }

  private async requireEmpleado(empleadoId: string, sucursalId: string) {
    const empleado = await this.prisma.scoped.empleados.findFirst({
      where: { id: empleadoId, deleted_at: null },
      select: { id: true, nombre: true, sucursal_id: true },
    });
    if (!empleado) throw new NotFoundException('Empleado no encontrado');
    if (empleado.sucursal_id !== sucursalId) {
      throw new BadRequestException('El empleado pertenece a otra sucursal');
    }
    return empleado;
  }

  private resolveSucursalFiltro(solicitada?: string): string | null {
    const delToken = this.tenantContext.get()?.sucursalId ?? null;
    if (delToken) {
      if (solicitada && solicitada !== delToken) {
        throw new BadRequestException(
          'El token está atado a otra sucursal: no se puede indicar sucursalId',
        );
      }
      return delToken;
    }
    return solicitada ?? null;
  }

  private async resolveSucursal(solicitada?: string): Promise<string> {
    const delToken = this.tenantContext.get()?.sucursalId ?? null;
    if (delToken) {
      if (solicitada && solicitada !== delToken) {
        throw new BadRequestException(
          'El token está atado a otra sucursal: no se puede indicar sucursalId',
        );
      }
      return delToken;
    }
    if (!solicitada) {
      throw new BadRequestException(
        'Indica sucursalId: tu usuario no está atado a una sucursal',
      );
    }
    const sucursal = await this.prisma.scoped.sucursales.findFirst({
      where: { id: solicitada, deleted_at: null },
      select: { id: true },
    });
    if (!sucursal) throw new NotFoundException('Sucursal no encontrada');
    return sucursal.id;
  }

  private tenant(): { empresaId: string; userId: string | null } {
    const context = this.tenantContext.get();
    if (!context?.empresaId) {
      throw new BadRequestException('La operación requiere empresa en el token');
    }
    return { empresaId: context.empresaId, userId: context.userId ?? null };
  }
}
