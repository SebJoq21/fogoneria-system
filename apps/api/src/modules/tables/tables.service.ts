import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TenantContextService } from '../../common/context/tenant-context.service.js';
import {
  ACTIVE_RESERVATION_STATES,
  OPEN_ORDER_STATES,
} from '../../common/constants/estados.js';
import type {
  CreateTableDto,
  ListTablesQueryDto,
  UpdateTableDto,
  UpdateTableStatusDto,
} from './dto/table.dto.js';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

/**
 * Mesas de la sucursal (AYCDS-16).
 *
 * `OCUPADA` y `RESERVADA` son estados derivados: los escriben las órdenes y
 * las reservas. Este servicio solo permite fijar `LIBRE` y `MANTENIMIENTO`,
 * y nunca deja una mesa bloqueada con actividad abierta.
 */
@Injectable()
export class TablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  list(query: ListTablesQueryDto) {
    const sucursalId = this.resolveSucursalFilter(query.sucursalId);
    return this.prisma.scoped.mesas.findMany({
      where: {
        deleted_at: null,
        ...(sucursalId ? { sucursal_id: sucursalId } : {}),
        ...(query.estado ? { estado: query.estado } : {}),
        ...(query.zona ? { zona: query.zona } : {}),
      },
      orderBy: [{ zona: 'asc' }, { numero: 'asc' }],
    });
  }

  async findOne(id: string) {
    return this.requireTable(id);
  }

  async create(dto: CreateTableDto) {
    const { empresaId } = this.tenant();
    const sucursalId = await this.resolveSucursal(dto.sucursalId);
    try {
      return await this.prisma.scoped.mesas.create({
        data: {
          empresa_id: empresaId,
          sucursal_id: sucursalId,
          numero: dto.numero.trim(),
          capacidad: dto.capacidad,
          zona: dto.zona?.trim() || 'Salón',
          forma: dto.forma ?? 'RECTANGULAR',
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'Ya existe una mesa con ese número en la sucursal',
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateTableDto) {
    await this.requireTable(id);
    try {
      return await this.prisma.scoped.mesas.update({
        where: { id },
        data: {
          ...(dto.numero !== undefined ? { numero: dto.numero.trim() } : {}),
          ...(dto.capacidad !== undefined ? { capacidad: dto.capacidad } : {}),
          ...(dto.zona !== undefined ? { zona: dto.zona.trim() } : {}),
          ...(dto.forma !== undefined ? { forma: dto.forma } : {}),
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'Ya existe una mesa con ese número en la sucursal',
        );
      }
      throw error;
    }
  }

  async updateStatus(id: string, dto: UpdateTableStatusDto) {
    await this.requireTable(id);
    await this.assertIdle(id, dto.estado);

    return this.prisma.scoped.mesas.update({
      where: { id },
      data: { estado: dto.estado },
    });
  }

  /** Baja lógica: el trigger `soft_delete_row` ya convierte DELETE, pero Prisma
   *  no reporta filas; se escribe `deleted_at` explícitamente. */
  async remove(id: string) {
    await this.requireTable(id);
    await this.assertIdle(id, 'LIBRE');

    const { userId } = this.tenantContext.get() ?? {};
    return this.prisma.scoped.mesas.update({
      where: { id },
      data: { deleted_at: new Date(), deleted_by: userId ?? null },
    });
  }

  /** Una mesa con orden abierta o reserva activa no se bloquea ni se borra. */
  private async assertIdle(mesaId: string, destino: string): Promise<void> {
    const [orden, reserva] = await Promise.all([
      this.prisma.scoped.ordenes.findFirst({
        where: { mesa_id: mesaId, estado: { in: [...OPEN_ORDER_STATES] } },
        select: { id: true, estado: true },
      }),
      this.prisma.scoped.reservas.findFirst({
        where: {
          mesa_id: mesaId,
          estado: { in: [...ACTIVE_RESERVATION_STATES] },
        },
        select: { id: true, fecha_hora: true },
      }),
    ]);

    if (orden) {
      throw new ConflictException(
        `La mesa tiene la orden ${orden.id} en estado ${orden.estado}`,
      );
    }
    if (reserva) {
      throw new ConflictException(
        `La mesa tiene una reserva activa (${reserva.id}) para ${reserva.fecha_hora.toISOString()}`,
      );
    }
    if (destino !== 'LIBRE' && destino !== 'MANTENIMIENTO') {
      throw new BadRequestException(
        'Solo se puede fijar LIBRE o MANTENIMIENTO manualmente',
      );
    }
  }

  private async requireTable(id: string) {
    const mesa = await this.prisma.scoped.mesas.findFirst({
      where: { id, deleted_at: null },
    });
    if (!mesa) throw new NotFoundException('Mesa no encontrada');
    return mesa;
  }

  private tenant(): { empresaId: string } {
    const context = this.tenantContext.get();
    if (!context?.empresaId) {
      throw new BadRequestException('La operación requiere empresa en el token');
    }
    return { empresaId: context.empresaId };
  }

  /**
   * Sucursal donde se crea la mesa. Los roles operativos la llevan en el JWT;
   * `ADMIN_GLOBAL` no, así que debe indicarla y se valida contra su empresa.
   */
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

  /** Filtro de lectura: el rol atado a sucursal nunca ve las demás. */
  private resolveSucursalFilter(solicitada?: string): string | null {
    const delToken = this.tenantContext.get()?.sucursalId ?? null;
    if (delToken) return delToken;
    return solicitada ?? null;
  }
}
