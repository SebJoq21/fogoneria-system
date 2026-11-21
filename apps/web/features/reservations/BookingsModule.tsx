/**
 * Reexporta la vista compartida del salón (mapa + agenda).
 *
 * La implementación vive en `components/dashboard/salon` porque el mapa lo usan
 * Mesas y Reservas; el split de UI fino llega en una fase posterior.
 */
export { BookingsModule } from '@/components/dashboard/salon/BookingsModule';
