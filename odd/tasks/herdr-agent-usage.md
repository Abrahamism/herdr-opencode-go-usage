---
titulo: Consumo de Claude en la barra de uso de herdr, con modo compacto de 5 h
feature: herdr-agent-usage
estatus: en_curso
fecha_creacion: 2026-11-03
actualizado: 2026-11-03
siguiente: — (nada abierto; verificación pendiente solo si Ismael pide publicar)
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

- [x] **T1** — Doc ODD, espejo Engram y todo. Spec: S1-S7. Ruta: inline. Commit: `03404c5`.
- [x] **T2** — `collect_claude.py`: token de Claude Code, endpoint de uso, normalizador con
      porcentajes y dólares, errores accionables. Spec: S3-S5, S7. Ruta: inline. Commit: `82c0728`.
- [x] **T3** — Barra: los dos proveedores en una sola lectura y el toggle compacto/completo. Spec: S1, S2, S6. Ruta: inline. Commit: `087a380`.
- [x] **T4** — Diálogo de detalle con una sección por proveedor. Spec: S1, S2, S5. Ruta: inline. Commit: `087a380`.
- [x] **T5** — Pruebas del colector nuevo con payloads sintéticos (ventanas, dólares, buckets
      nulos, sin sesión). Spec: S3-S5, S7. Ruta: inline. Commit: `92c86bc`.
- [x] **T6** — README, RECIPE y NOTAS-LOCALES al día; copia a `~/.config/herdr-app/mods/`. Spec: S1-S7. Ruta: inline. Commit: `dc4d30f`.
- [x] **T7** — Verificación: `unittest` (29 pruebas), `herdr-app check` en las dos carpetas
      (instalada y fuente), lectura real de OpenCode, captura de la barra en compacto y en
      completo, y del diálogo con las dos secciones. Spec: S1-S7. Ruta: inline. Commit: `—`.
- [x] **T8** — Confirmar los números reales de Claude. Hecho: la cuenta de la empresa
      (`ismael.rodriguezr@rappi.com`, `enterprise`) reporta el bloque `spend`; el dato ya sale en la
      barra. Spec: S3, S5, S7. Ruta: inline. Commit: `—`.
- [x] **T9** — Corregir el escalado del dinero (`spend` en unidades menores, `extra_usage` con
      `decimal_places`) y la tipografía de los montos. Spec: S3, S5. Ruta: inline. Commit: `—`.
- [x] **T10** — Botones de detalle y refresco visibles (prefijo `mods/` en la ruta del SVG) y
      diálogo con alto suficiente para la fila de dinero. Spec: S1, S2. Ruta: inline. Commit: `—`.
- [x] **T11** — Botones de detalle y refresco antes de los datos (el espaciador los empujaba al
      extremo derecho y dejaba un hueco grande). Spec: S1, S2. Ruta: inline. Commit: `—`.

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
- **L4** — Cortes de commit (slices) en la rama `feat/claude-usage-and-compact-bar`, con una
  desviación consciente del objetivo de ~400 líneas: (a) el par barra+diálogo va en un solo
  commit porque comparten el contrato del snapshot y partirlo deja el diálogo roto; (b) el
  colector nuevo y sus pruebas van en commits separados en vez de uno de ~700 líneas. Cortes:
  `03404c5` trackeo, `82c0728` colector, `92c86bc` pruebas, `087a380` barra+diálogo, `dc4d30f` docs.
- **L5** — Verificación observada (2026-11-03): `python -m unittest discover -s tests` → 29 pruebas
  OK; `herdr-app check` en las dos carpetas (fuente e instaladas) → `check passed`;
  `herdr-app status` → `errors: []`; lectura real de OpenCode con tres ventanas;
  captura de la barra en compacto (`OpenCode 5h <1% (4h 50m) · Claude !`), en completo
  (`5h · week · month`) y del diálogo con las dos secciones y el error accionable de Claude.
  `NOTAS-LOCALES.md` está en `.gitignore` a propósito: se actualizó en disco, no se commitea.
- **L6** — "ya veo que me da el dato, solo que hay que mejorar el texto mostrado, se ve raro
  ese numero, en este caso 150 dolares y ahi se ven como 15000, hay que mejorar la tipografia e
  igual acomodar o ajustar que salga el cuadro con detalle que antes teniamos, YA NO SALE,
  Sumado a eso corrigue el boton de update, no se ve".
  Evidencia: la cuenta es `ismael.rodriguezr@rappi.com`, plan `enterprise`, y el payload no trae
  ventanas (`five_hour`/`seven_day` nulos, `limits: []`), solo
  `spend: {used: {amount_minor: 0, exponent: 2}, limit: {amount_minor: 15000, exponent: 2}}`,
  o sea **$150.00** de tope mensual de créditos. Causas: (1) el colector leía
  `extra_usage.monthly_limit` (15000, centavos según `decimal_places: 2`) como dólares e ignoraba
  `spend`; (2) `money()` no agrupaba miles y el monto y el límite iban los dos en semibold, así
  que `$0.00 of $15000.00` se leía como un solo número; (3) al reescribir la barra se perdió el
  prefijo `mods/` en la ruta del SVG, así que los botones de detalle y refresco salían como cajas
  vacías (el diálogo sí abría por comando); (4) con la fila de dinero nueva, la última línea de
  Claude quedaba debajo del scroll a 420 px de alto. Arreglado y verificado con capturas: barra
  `Claude month $0.00 of $150.00 (0%)`, botones con ícono, diálogo a 440×460 con las dos secciones
  completas. 35 pruebas OK.
- **L7** — "ajusta los botones de ver consumo y refres para que salgan antes de los datos y no
  despues. Ya que veo un espacio grande entre los botones y la informacion". La barra quedó con
  `[aguja] [refrescar] [datos …]`, sin espaciador entre botones y números.
