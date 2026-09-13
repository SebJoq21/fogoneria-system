---
description: Retoma el contexto del proyecto (lee memoria + git)
agent: build
---

Retoma el proyecto donde quedó la última sesión.

1. Lee en orden: `AGENTS.md`, `docs/arquitectura.md`, `docs/decisiones.md`, `docs/SESION.md`.
2. Ejecuta `git log --oneline -10` y `git status --short` para contrastar memoria vs realidad.
3. Responde con: dónde quedamos, qué está pendiente y propone el próximo paso concreto. Si hay contradicción entre `docs/SESION.md` y git, repórtala primero.
4. No modifiques archivos en este comando.
