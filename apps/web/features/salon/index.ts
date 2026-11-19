export { MesasPage } from './MesasPage';
export { ReservasPage } from './ReservasPage';
export { SalonTablesPage } from './SalonTablesPage';
export { salonApi, toMesa, toReserva } from './api';
export type {
  EstadoMesa,
  Mesa,
  MesaInput,
  MesaUpdate,
} from '@fogoneria/contracts/mesas';
export type {
  EstadoReserva,
  Reserva,
  ReservaInput,
  ReservaUpdate,
} from '@fogoneria/contracts/reservas';
