---
description: Guarda el contexto de la sesión en docs/SESION.md (y decisiones si aplica)
agent: build
---

Actualiza la memoria del proyecto para que la próxima sesión retome sin perder contexto.

1. Lee `docs/SESION.md`, `docs/decisiones.md` y el diff reciente (`git log --oneline -10`, `git status --short`, `git diff --stat HEAD`).
2. Reescribe `docs/SESION.md` con este formato, corto y sin pegar código:
   - Fecha (UTC), objetivo de la sesión
   - Hecho (bullets con `ruta:línea` de lo tocado/decidido)
   - Pendiente / próximo paso concreto
   - Mantén las últimas 3 sesiones como historial, resume o elimina lo más viejo
3. Solo si hubo una decisión que cambia arquitectura/stack/contratos, agrega una entrada a `docs/decisiones.md` con fecha y motivo. Si no, no lo toques.
4. No commitees. Al final responde con 3 líneas máximo: qué guardaste y cuál es el próximo paso.
