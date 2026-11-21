import { BookingsModule } from '@/components/dashboard/salon/BookingsModule';

/** Agenda de reservas por día (hora de Lima) con confirmación y llegada. */
export function ReservasPage() {
  return <BookingsModule view="agenda" />;
}
