import { expect, test, type Page } from "@playwright/test";

/** Credenciales del seed demo (`apps/api/prisma/seed.ts`). */
const PASSWORD = "Fogoneria123!";
const ADMIN = "admin@mirestaurante.com";
const MESERO = "mesero@mirestaurante.com";
const CAJERO = "caja@mirestaurante.com";

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/");
  // Espera a que hidrate el formulario cliente antes de escribir/click.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo Electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test.describe("autenticación y RBAC reales", () => {
  test("la pantalla de login carga con sus campos", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Bienvenido de nuevo" }),
    ).toBeVisible();
    await expect(page.getByLabel("Correo Electrónico")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  });

  test("admin entra al dashboard", async ({ page }) => {
    await login(page, ADMIN);

    await expect(page).toHaveURL(/\/app$/);
    await expect(
      page.getByRole("heading", { name: "Hoy en tu restaurante" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "Inicio", exact: true }),
    ).toBeVisible();
  });

  test("mesero entra a Mis órdenes y no puede abrir caja", async ({ page }) => {
    await login(page, MESERO);

    await expect(page).toHaveURL(/\/app\/mozo$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Mis órdenes", exact: true }),
    ).toBeVisible();

    await page.goto("/app/caja");
    await expect(page).toHaveURL(/\/app\/mozo$/);
  });

  test("admin navega a mesas, comensales y caja", async ({ page }) => {
    await login(page, ADMIN);
    await expect(page).toHaveURL(/\/app$/);

    await page.getByRole("link", { name: "Mesas", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/mesas$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Mapa de mesas", exact: true }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Comensales", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/clientes$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Comensales", exact: true }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Caja", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/caja$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Caja", exact: true }),
    ).toBeVisible();
  });

  test("cajero entra a caja y no puede abrir mesas", async ({ page }) => {
    await login(page, CAJERO);

    await expect(page).toHaveURL(/\/app\/caja$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Caja", exact: true }),
    ).toBeVisible();

    await page.goto("/app/mesas");
    await expect(page).toHaveURL(/\/app\/caja$/);
  });
});
