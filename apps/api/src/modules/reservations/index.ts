/**
 * API pública del módulo Reservas.
 *
 * Otros módulos no deben importar `reservations.service`, los DTOs ni el
 * repositorio: solo este punto de entrada.
 */
export { ReservationsModule } from './reservations.module.js';
export { ReservationsService } from './reservations.service.js';
