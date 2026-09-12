---
name: conventional-commits
description: Convención de Commits (Conventional Commits) en español. Asegura que todos los commits sigan el formato estándar con tipos como feat, fix, docs, chore, etc.
---

# Convención de Commits (Conventional Commits)

Siempre que vayas a realizar un commit, DEBES seguir este formato estrictamente en español:

`<tipo>(<scope>): <descripción corta en español>`

### Tipos de Commit

| Tipo | Cuándo Usarlo |
|---|---|
| feat | Nueva funcionalidad (historia de usuario) |
| fix | Corrección de un bug |
| docs | Cambios en documentación |
| style | Cambios de formato/estilo (sin lógica) |
| refactor | Refactorización de código sin nueva funcionalidad |
| chore | Tareas de mantenimiento (dependencias, configs) |

### Ejemplos

- feat(auth): agregar pantalla de registro con email y contraseña
- fix(dashboard): corregir error al cargar datos del usuario
- docs(readme): actualizar instrucciones de instalación
- chore(deps): actualizar expo a la versión 54.0.33

### Reglas Adicionales

- **Commits Atómicos:** Si hay múltiples cambios independientes en el proyecto (por ejemplo, dependencias, nuevas funciones web, documentación, etc.), **DEBES dividir los cambios en múltiples commits individuales**. Agrupa los archivos lógicamente y haz un commit por cada grupo. NUNCA hagas un solo commit gigante ("monolítico") que mezcle diferentes tipos de tareas.
