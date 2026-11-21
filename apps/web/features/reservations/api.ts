import { salonApi } from '@/components/dashboard/salon/api';

/** API de reservas: la implementación compartida vive en el workspace del salón. */
export const reservationsApi = {
  list: salonApi.listReservas,
  create: salonApi.createReserva,
  update: salonApi.updateReserva,
  status: salonApi.updateReservaEstado,
};

export { salonApi, toReserva } from '@/components/dashboard/salon/api';
export type {
  EstadoReserva,
  Reserva,
  ReservaInput,
  ReservaUpdate,
} from '@fogoneria/contracts/reservations';
