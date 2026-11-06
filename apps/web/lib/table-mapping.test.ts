import { describe, expect, it } from "vitest";
import type { ApiReservation } from "./reservations-api";
import type { ApiTable } from "./tables-api";
import {
  apiReservationStatusOf,
  limaDateKey,
  limaTimeOf,
  reservationDateIso,
  reservationFromApi,
  reservationsFromApi,
  shapeToApi,
  stableTableId,
  tableNumberFromLabel,
  tableStatusFromApi,
  tablesFromApi,
} from "./table-mapping";

const table = (overrides: Partial<ApiTable> = {}): ApiTable => ({
  id: "11111111-1111-4111-8111-111111111111",
  numero: "3",
  capacidad: 4,
  zona: "Salón",
  estado: "LIBRE",
  forma: "RECTANGULAR",
  sucursal_id: "suc-1",
  ...overrides,
});

const reservation = (overrides: Partial<ApiReservation> = {}): ApiReservation => ({
  id: "22222222-2222-4222-8222-222222222222",
  codigo: "RSV-20261029-0001",
  empresa_id: "emp-1",
  sucursal_id: "suc-1",
  mesa_id: "11111111-1111-4111-8111-111111111111",
  cliente_nombre: "Familia Rojas",
  telefono: "987654321",
  nro_comensales: 4,
  fecha_hora: "2026-10-30T01:00:00.000Z",
  estado: "CONFIRMADA",
  canal: "Presencial",
  notas: "Junto a la ventana",
  creada_por: null,
  mesas: { id: "11111111-1111-4111-8111-111111111111", numero: "3", zona: "Salón" },
  ...overrides,
});

describe("stableTableId", () => {
  it("es estable y positivo para el mismo UUID", () => {
    const id = stableTableId("11111111-1111-4111-8111-111111111111");
    expect(id).toBe(stableTableId("11111111-1111-4111-8111-111111111111"));
    expect(id).toBeGreaterThan(0);
    expect(Number.isInteger(id)).toBe(true);
  });

  it("distingue UUID distintos", () => {
    expect(stableTableId("mesa-a")).not.toBe(stableTableId("mesa-b"));
  });
});

describe("tablesFromApi", () => {
  it("traduce estados, forma y etiqueta", () => {
    const [libre] = tablesFromApi([table()]);
    expect(libre).toMatchObject({
      label: "Mesa 3",
      seats: 4,
      zone: "Salón",
      shape: "rect",
      status: "libre",
      apiId: "11111111-1111-4111-8111-111111111111",
      branchId: "suc-1",
      blocked: false,
    });
  });

  it("OCUPADA y RESERVADA mandan sobre el estado local", () => {
    const [ocupada, reservada] = tablesFromApi([
      table({ id: "a", estado: "OCUPADA" }),
      table({ id: "b", estado: "RESERVADA", forma: "REDONDA" }),
    ]);
    expect(ocupada.status).toBe("ocupada");
    expect(reservada.status).toBe("reservada");
    expect(reservada.shape).toBe("round");
  });

  it("MANTENIMIENTO se muestra como bloqueada", () => {
    const [bloqueada] = tablesFromApi([table({ estado: "MANTENIMIENTO" })]);
    expect(bloqueada.blocked).toBe(true);
    expect(bloqueada.status).toBe("reservada");
  });

  it("usa Salón cuando la API no trae zona", () => {
    const [mesa] = tablesFromApi([table({ zona: null })]);
    expect(mesa.zone).toBe("Salón");
  });
});

describe("tableStatusFromApi", () => {
  it("mapea los cuatro estados de la API", () => {
    expect(tableStatusFromApi("LIBRE")).toBe("libre");
    expect(tableStatusFromApi("OCUPADA")).toBe("ocupada");
    expect(tableStatusFromApi("RESERVADA")).toBe("reservada");
    expect(tableStatusFromApi("MANTENIMIENTO")).toBe("reservada");
  });
});

describe("reservas", () => {
  it("convierte el estado de la API al de la agenda", () => {
    expect(apiReservationStatusOf("por_confirmar")).toBe("POR_CONFIRMAR");
    expect(apiReservationStatusOf("confirmada")).toBe("CONFIRMADA");
    expect(apiReservationStatusOf("llego")).toBe("EJECUTADA");
    expect(apiReservationStatusOf("cancelada")).toBe("CANCELADA");
    expect(apiReservationStatusOf("no_show")).toBe("NO_SHOW");
  });

  it("resuelve la mesa por UUID y conserva el folio", () => {
    const tables = tablesFromApi([table()]);
    const mapped = reservationFromApi(reservation(), tables);
    expect(mapped).toMatchObject({
      id: "22222222-2222-4222-8222-222222222222",
      code: "RSV-20261029-0001",
      customer: "Familia Rojas",
      guests: 4,
      phone: "987654321",
      status: "confirmada",
      tableId: tables[0].id,
      tableApiId: "11111111-1111-4111-8111-111111111111",
    });
    expect(mapped.time).toBe("20:00");
  });

  it("deja tableId null si la mesa ya no está en el mapa", () => {
    const mapped = reservationsFromApi([reservation()], []);
    expect(mapped[0].tableId).toBeNull();
  });

  it("traduce POR_CONFIRMAR y NO_SHOW", () => {
    const mapped = reservationsFromApi(
      [reservation({ estado: "POR_CONFIRMAR" }), reservation({ id: "x", estado: "NO_SHOW" })],
      [],
    );
    expect(mapped.map((item) => item.status)).toEqual(["por_confirmar", "no_show"]);
  });
});

describe("fechas de Lima", () => {
  it("arma el ISO con offset fijo -05:00", () => {
    expect(reservationDateIso("2026-10-29", "20:00")).toBe("2026-10-29T20:00:00-05:00");
    expect(reservationDateIso("2026-10-29", "9:5")).toBe("2026-10-29T09:05:00-05:00");
  });

  it("no corre el día al pasar a UTC", () => {
    expect(limaDateKey("2026-10-30T01:00:00.000Z")).toBe("2026-10-29");
    expect(limaTimeOf("2026-10-30T01:00:00.000Z")).toBe("20:00");
  });
});

describe("forma y número de mesa", () => {
  it("mapea la forma de la UI a la API", () => {
    expect(shapeToApi("round")).toBe("REDONDA");
    expect(shapeToApi("rect")).toBe("RECTANGULAR");
  });

  it("extrae el número de la etiqueta", () => {
    expect(tableNumberFromLabel("Mesa 12")).toBe("12");
    expect(tableNumberFromLabel("Barra 2")).toBe("Barra 2");
    expect(tableNumberFromLabel("Mesa Terraza Principal")).toBe("Terraza Pr");
  });
});
