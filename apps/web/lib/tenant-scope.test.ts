import { describe, expect, it } from "vitest";
import { GENERAL_BRANCH, type Branch } from "./tenancy";
import { branchIdsOf, matchesBranch, resolveActiveBranch } from "./tenant-scope";

const realIds = ["s-1", "s-2", "s-3"];

const branch = (id: string): Branch => ({
  id,
  name: id,
  short: id,
  address: "",
  phone: "",
  isMain: false,
  status: "Abierta",
});

describe("resolveActiveBranch", () => {
  it("prioriza la sucursal del usuario sobre la recordada", () => {
    expect(resolveActiveBranch({ userBranchId: "s-2", saved: "s-3", realIds })).toBe("s-2");
  });

  it("usa la recordada si sigue vigente y el usuario no trae sucursal", () => {
    expect(resolveActiveBranch({ userBranchId: null, saved: "s-3", realIds })).toBe("s-3");
  });

  it("ignora la recordada obsoleta y cae a la primera real", () => {
    expect(resolveActiveBranch({ userBranchId: null, saved: "s-vieja", realIds })).toBe("s-1");
  });

  it("una sucursal de usuario desconocida no gana a la recordada", () => {
    expect(resolveActiveBranch({ userBranchId: "s-ajena", saved: "s-2", realIds })).toBe("s-2");
  });

  it("sin sucursales reales cae a la vista general", () => {
    expect(resolveActiveBranch({ userBranchId: "s-1", saved: "s-2", realIds: [] })).toBe(
      GENERAL_BRANCH.id,
    );
  });
});

describe("matchesBranch", () => {
  it("iguala el UUID del seed con su slug demo", () => {
    expect(matchesBranch("22222222-2222-4222-8222-222222222222", "miraflores")).toBe(true);
  });

  it("distingue sucursales distintas y tolera datos incompletos", () => {
    expect(matchesBranch("surco", "san-isidro")).toBe(false);
    expect(matchesBranch("surco", "surco")).toBe(true);
    expect(matchesBranch(null, "surco")).toBe(false);
    expect(matchesBranch("surco", undefined)).toBe(false);
  });
});

describe("branchIdsOf", () => {
  it("extrae los ids en orden y sin la vista agregada", () => {
    expect(branchIdsOf([branch("s-1"), branch("s-2")])).toEqual(["s-1", "s-2"]);
    expect(branchIdsOf([])).toEqual([]);
  });
});
