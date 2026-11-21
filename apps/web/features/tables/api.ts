import { salonApi } from '@/components/dashboard/salon/api';

/** API de mesas: la implementación compartida vive en el workspace del salón. */
export const tablesApi = {
  list: salonApi.listMesas,
  create: salonApi.createMesa,
  update: salonApi.updateMesa,
  status: salonApi.updateMesaEstado,
  remove: salonApi.deleteMesa,
};

export { salonApi, toMesa } from '@/components/dashboard/salon/api';
export type { EstadoMesa, Mesa, MesaInput, MesaUpdate } from '@fogoneria/contracts/tables';
