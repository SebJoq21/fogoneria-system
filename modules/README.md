# modules/

Fuente de verdad de la **paridad de módulos** backend ↔ frontend ↔ contratos ↔ specs.

- `catalog.json` — catálogo canónico de los 20 módulos (ID, tipo, owner, estado, rutas, legado).
- El script `scripts/check-module-parity.mjs` (`pnpm check:modules`) reporta brechas; `--strict` será el gate cuando termine la migración.
- En la fase 1, cada módulo tendrá su `modules/<id>/module.json` (metadata/nav/owner) y `scripts/gen-modules.mjs` generará los registries de API/web. No se editan los archivos generados a mano.

Documento completo: [`docs/plan-paridad-modulos.md`](../docs/plan-paridad-modulos.md).
