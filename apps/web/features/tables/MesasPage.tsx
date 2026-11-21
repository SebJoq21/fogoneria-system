import { BookingsModule } from '@/components/dashboard/salon/BookingsModule';

/** Mapa del salón: estados reales de mesas y cuentas abiertas. */
export function MesasPage() {
  return <BookingsModule view="mapa" />;
}
