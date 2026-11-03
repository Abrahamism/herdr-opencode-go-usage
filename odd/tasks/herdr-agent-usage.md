---
titulo: Consumo de Claude en la barra de uso de herdr, con modo compacto de 5 h
feature: herdr-agent-usage
estatus: en_curso
fecha_creacion: 2026-11-03
actualizado: 2026-11-03
siguiente: T2 — escribir collect_claude.py
modo: implementacion
tags: [herdr, mods, uso, claude, opencode]
---

# herdr-agent-usage

La barra de uso de herdr deja de ser solo de OpenCode Go: muestra también el consumo de
Claude, leído de la sesión de Claude Code de este equipo. La barra puede mostrar todas las
ventanas o solo la de 5 h, y el clic alterna entre los dos modos. El id del mod y el nombre
del repo no cambian en esta entrega.

## Specs

- **S1** — "me das 5 hrs, semana y mes. Hay que modificar eso, que se puede mostrar eso, pero
  que igual solo pueda mostrar el de 5 hrs". La barra conserva las tres ventanas de OpenCode Go
  y gana un modo compacto que muestra solo la de 5 h. Nada de los datos actuales se pierde: el
  diálogo de detalle siempre enseña todas las ventanas.
- **S2** — "quiero que agregues el de consumo de claude". La misma barra muestra el consumo de
  Claude junto al de OpenCode Go, con un solo refresco y un solo diálogo.
- **S3** — "actualmente tengo el de la empresa y no es por plan ee API Usage Billing, pero seria
  bueno tener el consumo que se lleva". Claude no siempre tiene ventanas de plan: cuando la
  cuenta factura por uso, lo que importa son los dólares consumidos. La barra nunca inventa un
  porcentaje que la cuenta no reporta.
- **S4** — "Login de Claude Code de este equipo". El dato sale de la sesión de Claude Code de
  esta máquina (`~/.claude/.credentials.json`). No se usa una llave de Admin API ni se estima
  desde logs locales.
- **S5** — "Lo que la cuenta exponga". Si la cuenta reporta porcentaje de ventana, se muestra
  porcentaje y cuenta regresiva; si reporta dólares, se muestran dólares; si reporta ambas, se
  muestran ambas.
- **S6** — "Clic para alternar compacto/completo". El clic en los números de la barra alterna
  entre mostrar solo la ventana de 5 h y mostrar todas. El modo elegido sobrevive al reinicio.
- **S7** — "Sí, misma máquina con /login". La cuenta de la empresa se usa en este equipo
  cambiando de sesión con `claude auth login`; el mod lee la sesión activa, sea cual sea.
  Sin sesión, la barra dice qué hacer en vez de mostrar números viejos.

## Tasks

- [ ] **T1** — Doc ODD, espejo Engram y todo. Spec: S1-S7. Ruta: inline. Commit: `chore(odd): track agent usage`.
- [ ] **T2** — `collect_claude.py`: token de Claude Code, endpoint de uso, normalizador con
      porcentajes y dólares, errores accionables. Spec: S3-S5, S7. Ruta: inline. Commit: `feat(claude): read usage from the Claude Code session`.
- [ ] **T3** — Barra: los dos proveedores en una sola lectura y el toggle compacto/completo. Spec: S1, S2, S6. Ruta: inline. Commit: `feat(bar): show Claude next to OpenCode with a compact 5h mode`.
- [ ] **T4** — Diálogo de detalle con una sección por proveedor. Spec: S1, S2, S5. Ruta: inline. Commit: `feat(detail): one section per provider`.
- [ ] **T5** — Pruebas del colector nuevo con payloads sintéticos (ventanas, dólares, buckets
      nulos, sin sesión). Spec: S3-S5, S7. Ruta: inline. Commit: `test(claude): cover the usage normalizer`.
- [ ] **T6** — README, RECIPE y NOTAS-LOCALES al día; copia a `~/.config/herdr-app/mods/`. Spec: S1-S7. Ruta: inline. Commit: `docs: document the Claude provider and the compact mode`.
- [ ] **T7** — Verificación: `unittest`, `herdr-app check`, lectura real de OpenCode y el estado
      real de Claude en esta máquina. Spec: S1-S7. Ruta: inline. Commit: `—`.

## Log

- **L1** — "Estabamos trabajando en un mod para ver el consumo de open code go y me das 5 hrs,
  semana y mes. Hay que modificar eso, que se puede mostrar eso, pero que igual solo pueda
  mostrar el de 5 hrs, esto porque quiero que agregues el de consumo de claude, actualmente tengo
  el de la empresa y no es por plan ee API Usage Billing, pero seria bueno tener el consumo que
  se lleva"
- **L2** — Decisiones cerradas por el usuario: fuente de Claude = "Login de Claude Code de este
  equipo"; qué mostrar = "Lo que la cuenta exponga"; alcance del cambio de la barra = "Clic para
  alternar compacto/completo"; cuenta de la empresa = "Sí, misma máquina con /login".
- **L3** — Evidencia de exploración (2026-11-03): `claude auth status` → `{"loggedIn": false}`;
  `~/.claude/.credentials.json` tiene `accessToken: ""` y `expiresAt: 0`. El endpoint
  `GET https://api.anthropic.com/api/oauth/usage` con `anthropic-beta: oauth-2025-04-20`
  responde HTTP 401 `OAuth access token is invalid` con un token falso, así que la ruta es real
  y solo falta una sesión viva. El payload cacheado por Claude Code en `~/.claude.json`
  (`cachedUsageUtilization`) trae `five_hour`/`seven_day` con `utilization`, los campos
  `used_dollars`/`limit_dollars`/`remaining_dollars`, un arreglo `limits` con `kind`
  (`session`, `weekly_all`) y un bloque `extra_usage`. Ese payload es el fixture real de T5.
