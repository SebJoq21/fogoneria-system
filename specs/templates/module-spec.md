# Plantilla — spec de módulo

> Copia este archivo a `specs/modulos/<modulo>.md` y sustituye los `{{…}}`.
> Una spec debe caber en 1–2 páginas. Si necesita más, enlaza a `docs/` en lugar de duplicar.

```md
# {{Módulo}} — especificación

**Estado:** API real | Mixto | Demo · **Última revisión:** {{YYYY-MM-DD}}

## 1. Propósito
{{Problema de negocio que resuelve, en 2–3 líneas. Qué NO hace.}}

## 2. Superficies

| Capa | Dónde vive | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/{{modulo}}/` | {{real / sin controller}} |
| Web | `apps/web/features/{{feature}}/` o `apps/web/components/erp/{{vista}}` | {{real / demo / mixto}} |
| Contrato | `packages/contracts/src/{{contrato}}.ts` | {{sí / no aplica}} |
| Datos | tablas `{{tabla}}` | {{migración}} |

## 3. API

| Método | Ruta | Roles | Qué hace |
|---|---|---|---|
| `GET` | `/api/v1/{{ruta}}` | {{roles}} | {{…}} |

Reglas que no se pueden romper:
- {{precio calculado en servidor, folio por secuencia, transición válida, etc.}}

## 4. Datos y migraciones
- Tablas: {{…}}
- Migraciones relevantes: {{nombres exactos de `apps/api/prisma/migrations/`}}
- Triggers / RLS / inmutabilidad: {{enlace a `docs/rls-modelo.md` o `docs/errores-db.md`}}

## 5. UI y rutas
- Rutas: `{{/app/...}}`
- Vistas: `{{archivo}}`
- Estados: carga, vacío, error, sin sesión (demo).

## 6. Contratos compartidos
- {{tipos/validadores y subpath de `@fogoneria/contracts`}}

## 7. Pruebas
| Suite | Archivo | Qué cubre |
|---|---|---|
| Unit | `{{*.spec.ts}}` | {{…}} |
| e2e | `{{*.e2e-spec.ts}}` | {{…}} |
| DB | `{{*.db-spec.ts}}` | {{…}} |
| Web | `features/{{feature}}/{{*.test.ts}}` | {{…}} |

## 8. Deuda conocida
- {{deuda con dueño o tarea Jira; si no hay, `sin deuda registrada`.}}

## 9. Trazabilidad
- Jira: {{AYCDS-XX}}
- PR: {{#NN}}
- Evidencia: {{ruta o test}}

## 10. Próximos pasos
1. {{…}}
```

## Reglas de la plantilla

- **No inventar** endpoints ni tablas: se copian del controlador y del `schema.prisma`.
- Si un dato no se pudo verificar, escribir `pendiente de verificar`.
- Todo enlace debe ser relativo y existir en el repo.
- El estado `Mixto` exige decir **qué parte** es real y **qué parte** es demo.
