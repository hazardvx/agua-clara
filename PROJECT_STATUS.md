# PROJECT_STATUS — Agua Clara (PWA de pedidos de agua purificada)

> Archivo de continuidad entre sesiones. Refleja el estado real del repositorio,
> no lo recordado de una conversación. Actualizar al terminar cada sesión.

**Última actualización:** 2026-10-25
**Sesión:** Rediseño completo estilo Apple (emojis → SVG, catálogo de 3 marcas, responsive, auditoría de usabilidad de los 3 roles)

### Continuación verificada — 2026-10-25

- **Navegación responsive:** comprobada en `390×844`, `768×1024`, `899×800`, `900×800` y `1440×900`. La navegación es inferior fija por debajo de `900px` y barra lateral izquierda desde `900px`, sin solapar el contenido.
- **Catálogo/imágenes:** `img/aquaviva.jpg`, `img/cristalina.jpg` y `img/purissima.jpg` cargan localmente y se muestran en `ProductCard`; la migración local `catalogVersion: 3` añade imágenes sin cambiar precios editados. Las imágenes ya presentes en el proyecto no tienen metadatos de licencia/fuente verificables, por lo que no se declaran oficiales ni aptas para publicación comercial sin confirmación.
- **Ubicación del cliente:** el checkout ahora ofrece `Usar mi ubicación` mediante permiso explícito del navegador, conserva el flujo manual ante rechazo/error, permite referencia, y persiste `addressId`, `addressReference`, `latitude` y `longitude` en el pedido local. La coordenada sigue siendo opcional. Las direcciones guardadas se seleccionan por ID y conservan referencia/coordenadas.
- **Corrección adicional:** el pedido confirmado actualiza correctamente el hash a `#confirmacion`; se eliminó la declaración duplicada detectada durante la revisión del checkout.
- **Verificación:** `npm test` → **48/48 OK**. Playwright manual → sin errores de consola ni overflow en los cinco tamaños; GPS concedido → “Ubicación lista para este pedido”; GPS denegado → mensaje de continuidad manual; pedido manual → dirección y referencia persistidas.
- **Migraciones:** no se creó una nueva; `002_additional_tables.sql` ya contiene `addresses.latitude/longitude`, `orders.address_reference` y `products.image_url`. No hay credenciales/proyecto Supabase para aplicar migraciones o verificar RLS en backend real.
- **Limitaciones:** esta carpeta sigue sin repositorio Git; no se ejecutó `npm run test:e2e` porque el proyecto no tiene `playwright.config.js` ni specs formales, aunque sí se ejecutó un script Playwright de verificación contra `http://localhost:4173`.

### Refinamiento visual Apple — 2026-10-25

- Tarjetas del catálogo refinadas: imágenes con escala homogénea, descripciones limitadas a dos líneas, precio menos dominante y badge orientado a “5 galones”.
- Selector de rol conservado para la demo, pero identificado visualmente como “Demo” y con etiqueta accesible más clara.
- `npm test` → **48/48 OK** después del ajuste.

### Verificación de usabilidad por roles — 2026-10-25

- Cliente demo: login rápido, catálogo, selección de producto, carrito, checkout, dirección manual, referencia y confirmación probados en `390×844`; sin errores de consola.
- Administradora demo: acceso rápido, panel de pedidos, reparto, productos, ventas, configuración y pedido manual probados en `1440×900`; sin errores de consola ni solicitudes fallidas.
- Repartidor demo: acceso rápido, entregas e historial probados; navegación funcional y sin errores de consola ni solicitudes fallidas.
- La persistencia entre roles pertenece al mismo `localStorage` del navegador en modo demo. No equivale todavía a un backend multiusuario: para operación real debe conectarse Supabase y aplicar las migraciones existentes.

---

## 1. Objetivo del proyecto

PWA para un negocio de venta y distribución de agua purificada en botellones de 5 galones (Panamá):

- El cliente crea su cuenta, pide por internet y elige entrega a domicilio o recogida.
- La administradora gestiona los pedidos desde casa, asigna repartos, ve ventas y precios.
- El repartidor consulta entregas, abre la ubicación y registra entrega + cobro.
- Tarifa comercial obligatoria: entrega **B/.4.50 por pedido** (una sola vez, no por botellón),
  recogida **B/.0.00**. El agua se cobra aparte. Precios del agua configurables.

## 2. Arquitectura y tecnologías

| Capa | Tecnología | Estado |
|------|-----------|--------|
| Frontend | SPA vanilla ES modules, sin framework, sin bundler | Activa |
| Estilos | `styles.css` (design system propio estilo Apple, 25.8 KB, sistema pila SF sin fuentes externas) | Activa |
| Estado | `js/store.js` + pub/sub, persistencia en `localStorage` (`agua-clara-v3`) | Activa (modo demo) |
| Backend | `server.js` — Node 20+ `node:http`, estático + SPA fallback + CSP | Activa |
| Base de datos | Supabase (Postgres) — 2 migraciones SQL, RLS, `create_order()` | Esquema listo, **no aplicado** |
| Auth | `js/auth.js` — capa conmutable: Supabase Auth (REST) si hay credenciales; si no, cuentas locales demo en `localStorage` | **Activa en modo local**; Supabase sin credenciales |
| PWA | `manifest.json` + `sw.js` (network-first navegación, cache-first assets) | Activa |
| Pruebas | `node --test` (48 tests) + verificación E2E con Playwright (script temporal por sesión, sin config en repo) | Unitarias OK |
| Deploy | `infra/Caddyfile` (Caddy + HTTPS) | Plantilla |
| Gestor de paquetes | npm; **sin dependencias runtime** (`@playwright/test` solo dev) | — |

No hay repositorio Git (`git status` → *not a git repository*). No hay `AGENTS.md`.

## 3. Estructura de carpetas

```
Sistema_Agua/
├── index.html              # Punto de entrada
├── styles.css              # Sistema de diseño
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
├── server.js               # Servidor estático + cabeceras de seguridad
├── package.json            # scripts: start / test / test:e2e
├── .env.example            # Variables de entorno (sin secretos)
├── README.md               # Documentación principal
├── PROJECT_STATUS.md       # Este archivo
├── icons/favicon.svg
├── js/
│   ├── app.js              # Arranque, render por rol, guards de auth, registro del SW
│   ├── auth.js             # Autenticación: validadores, cuentas, sesión, guard de rutas
│   ├── store.js            # Estado + helpers de negocio (money, esc, calcOrderTotal…)
│   ├── router.js           # Hash router + guards de navegación + bind de eventos globales
│   ├── icons.js            # Set de iconos SVG inline (stroke 1.8) — cero emojis en la UI
│   ├── ui.js               # Componentes reutilizables (tarjetas, nav, toasts)
│   └── views/
│       ├── auth.js         # Pantallas de login y registro de cliente
│       ├── cliente.js      # Inicio, catálogo, carrito/checkout, pedidos, cuenta
│       ├── admin.js        # Pedidos, reparto, productos, ventas, config, manual
│       └── repartidor.js   # Entregas, modal de entrega/cobro, fallos, historial
├── supabase/migrations/
│   ├── 001_initial.sql     # 10 tablas + RLS + is_staff() + create_order()
│   └── 002_additional_tables.sql  # 5 tablas + índices + trigger + settings
├── tests/
│   ├── pricing.test.js     # 16 tests de precios/reglas (replican la lógica)
│   ├── roles.test.js       # 11 tests de roles/seguridad (replican la lógica)
│   ├── flows.test.js       # Tests que IMPORTAN el código real de js/store.js
│   └── auth.test.js        # 11 tests que IMPORTAN js/auth.js y js/store.js reales
├── infra/Caddyfile
└── .playwright-mcp/        # Salida de la sesión de inspección (no es código)
```

## 4. Funcionalidades completadas y verificadas

Verificadas ejecutando la app real en navegador (`http://localhost:4173`) y `npm test`.

| Funcionalidad | Evidencia |
|---------------|-----------|
| Interfaz cliente (inicio, catálogo, carrito, checkout, confirmación, pedidos, cuenta, direcciones) | Render OK, **0 errores de consola** |
| Carrito con cantidades +/−, quitar, contador | Probado en navegador |
| Cálculo de total: 4 × B/.2.50 + envío = **B/. 14.50** | Probado en navegador |
| Envío **B/.4.50 fijo por pedido**, no por botellón | 4 tests + navegador |
| Recogida = envío **B/. 0.00**, total B/. 2.50 | Probado en navegador |
| Validación: sin nombre/teléfono o sin dirección → bloquea y avisa | Probado en navegador |
| Pedido → confirmación con número `AC-0001` | Probado en navegador |
| Admin: aceptar → preparar → asignar → panel con stats | Probado en navegador |
| Repartidor: ver asignadas → iniciar → modal de entrega con cobro → **Entregado** | Probado en navegador |
| Informe de ventas del día (B/. 14.50, 4 botellones, 1 entregado) | Probado en navegador |
| WhatsApp `wa.me` (negocio y cliente), Google Maps (búsqueda de dirección) | Enlaces generados correctamente |
| Precios configurables desde admin; activar/pausar productos | Código revisado + probado |
| Pedido manual (teléfono/WhatsApp) con resumen en vivo | Código revisado |
| `npm test` → **48 tests, 0 fallos** | Ejecutado en esta sesión |
| Servidor arranca y sirve con CSP, X-Frame-Options, nosniff | Ejecutado en esta sesión |
| Registro de cuenta (nombre, teléfono Panamá, correo, contraseña ≥8 con letra y número) | Probado en navegador (rechaza contraseña débil con toast) |
| Login/logout con sesión persistida (recarga del navegador mantiene la sesión) | Probado en navegador |
| Vistas privadas (`pedidos`, `cuenta`, `confirmacion`) exigen sesión → pantalla de login con retorno a la vista original | Probado en navegador (logout en `#pedidos` → login → vuelve a `#pedidos`) |
| Confirmar pedido sin sesión → redirige a login y, tras ingresar, vuelve al carrito con los items intactos | Probado en navegador |
| Cada cliente solo ve SUS pedidos (por `customerId`); los pedidos legado/manuales no aparecen a clientes | Probado en navegador + `tests/auth.test.js` |
| **0 emojis en toda la UI** (búsqueda por rangos Unicode U+2300–27BF, 2B00–2BFF, 1F000–1FAFF, 2100–21FF, 25A0–25FF, FE0F) | Verificado con script sobre el DOM renderizado de los 3 roles |
| **Rediseño estilo Apple** (pila SF/system, tokens neutros `#f5f5f7`/`#0071e3`, hairlines, glass blur en topbar/bottom-nav, focus-visible, `prefers-reduced-motion`, botones pill, modal tipo sheet iOS) | Revisado en 33 screenshots |
| **Catálogo 3 marcas reales**: Aquaviva B/.4.90, Cristalina B/.5.50, Purísima B/.4.95 (garrafón 5 gal.) con migración automática `catalogVersion: 2` | 48 tests + navegador |
| **Responsive 390×844 / 768×1024 / 1440×900** sin overflow horizontal ni solapamientos; nav inferior (móvil) → pestañas superiores (desktop) | Playwright: 3 viewports × 3 roles |
| Flujo completo por UI en los 3 roles: registro → pedido → confirmación (AC-0001) → admin aceptar/preparar/asignar → repartidor entrega → **Entregado** en localStorage | Playwright: **SIN ERRORES** (0 errores de consola) |

## 5. Funcionalidades parciales o con errores

| Funcionalidad | Estado | Detalle |
|---------------|--------|---------|
| **Flujo de recogida (pickup)** | IMPLEMENTADA PERO CON ERRORES → **corregida en esta sesión** | Un pedido de recogida quedaba bloqueado en `Listo para recoger`: la admin no tenía botón para darlo por retirado y el repartidor no lo veía. Nunca llegaba a `Entregado`, por lo que no entraba en ventas. Ver §7. |
| **Registro de pago de recogidas** | PARCIAL → **corregida en esta sesión** | Solo el repartidor podía marcar `paid`. En recogida el pago ocurre en el local y nadie podía registrarlo. |
| Registro e inicio de sesión | IMPLEMENTADA (modo local) → **completada en esta sesión** | `js/auth.js` + `views/auth.js`: registro/login/logout con cuentas locales en `localStorage` (hash SHA-256), sesión persistida, guards de ruta y pedidos con `customerId`. Supabase Auth queda escrita en la capa conmutable pero **sin probar** (sin credenciales). Ver §7. |
| Gestión de clientes (admin) | NO IMPLEMENTADA | No hay vista de clientes en `admin.js` ni en `adminNav`. |
| Conexión a base de datos | PARCIAL | Todo persiste en `localStorage`. Las migraciones SQL existen pero no se han aplicado a ningún proyecto Supabase (no hay credenciales). |
| WhatsApp | PARCIAL / BLOQUEADA | Enlaces `wa.me` funcionan. La API de WhatsApp Business no está conectada (falta `WHATSAPP_API_TOKEN`). |
| Yappy / pagos en línea | NO IMPLEMENTADA / BLOQUEADA | Opción deshabilitada en el checkout, marcada como "pendiente de configuración". Faltan credenciales comerciales. |
| Asignación a repartidor | PARCIAL | Se asigna a un repartidor único fijo (`assignedTo = 'repartidor'`). No hay selección de repartidor ni de vehículo (la tabla `vehicles` solo muestra 1 fila). |
| PWA / instalación | PARCIAL | Manifest + SW funcionan. No se ha verificado la instalación real en Android/iOS. Faltan iconos PNG 192/512 y `apple-touch-icon.png` (el servidor devuelve HTML con 200 en su lugar). No hay test de modo offline. |
| Seguridad / permisos | PARCIAL | Auth de cliente activa (modo local) y pedidos con `customerId` (un cliente solo ve los suyos). RLS e `is_staff()`/`is_admin()` escritos en SQL. **Los paneles admin/repartidor siguen sin protección real**: cualquier visitante cambia de rol con el selector. Es esperado hasta conectar Supabase Auth. |
| Pruebas automatizadas | PARCIAL | 48 tests pasan. `auth.test.js` y `flows.test.js` **importan el código real**; `pricing.test.js`/`roles.test.js` aún replican la lógica. `npm run test:e2e` no tiene `playwright.config.js` ni specs. |
| Direcciones / Google Maps | PARCIAL | Direcciones de texto con guardado y reutilización. Sin coordenadas ni geocodificación (la tabla `addresses` ya tiene `latitude`/`longitude`). |

## 6. Funcionalidades no implementadas

- Activar Supabase Auth (rellenar `SUPABASE_URL`/`SUPABASE_ANON_KEY` al inicio de `js/auth.js`;
  la capa REST ya está escrita pero sin probar contra un proyecto real).
- Panel de clientes para la administradora (listado, historial por cliente, contacto).
- Pagos en línea (Yappy u otra pasarela).
- Notificaciones automáticas (WhatsApp API / push / email) — solo enlaces manuales.
- Inventario y `container_ledger` (tablas creadas, sin UI).
- Zonas de entrega (`delivery_zones`, tabla creada, sin UI).
- Multi-repartidor con selección y vehículos.
- Test E2E real (Playwright configurado).

## 7. Cambios realizados

### Sesión actual: rediseño Apple + catálogo + responsive

| Archivo | Cambio |
|---------|--------|
| `js/icons.js` | **Nuevo.** Set de ~35 iconos SVG inline (trazo 1.8, estilo feather/SF): `icon(name, size, extra)` con droplet, cart, truck, wallet, check, x, etc. Base de toda la UI sin emojis. |
| `js/store.js` | Labels sin emoji (incluye `orderActions`: Aceptar, Preparar, Asignar repartidor, Listo para recoger, Cliente retiró, Cancelar); catálogo reemplazado por **3 marcas** (Aquaviva 490¢, Cristalina 550¢, Purísima 495¢); `LEGACY_PRODUCT_IDS`, `CATALOG_VERSION = 2`, `migrateCatalog()` (cambia productos si hay legacy o versión <2, vacía carrito solo si referenciaba IDs legacy) + `persist()` al migrar para no pisar precios editados. |
| `js/ui.js` | Componentes con iconos: `topbar` (brand SVG, nav `data-nav` + `iconKey`), `bottomNav`, toasts con `.toast-ico`, `productCard`/`clientOrderCard`/`adminOrderCard`/`courierDeliveryCard`, `emptyState(iconHtml, …)`, `appFooter` con `.status-dot`, hero con SVG y `clamp()`. Botones del repartidor en flex con `min-width: max-content` (evita recorte por `overflow:hidden`). |
| `js/views/cliente.js`, `admin.js`, `repartidor.js`, `auth.js` | Todos los emojis reemplazados por SVG; selectores de estado como texto plano; `auth.js` usa `innerHTML` (no `textContent`) para no borrar los SVG del botón. |
| `styles.css` | **Rediseño completo estilo Apple** (~25.8 KB): sin Google Fonts (pila `-apple-system, SF Pro`), tokens (`--bg:#f5f5f7`, `--text:#1d1d1f`, `--primary:#0071e3`, hairlines `rgba(0,0,0,.07)`, radios 12/18/24, transición .18s), `:focus-visible` + `prefers-reduced-motion`, helpers `.ico`/`.meta-line`/`.status-dot`, topbar/bottom-nav glass `blur(20px) saturate(180%)` con safe-area, botones planos pill (border transparente corrige salto de `.btn-danger`), `@media(pointer:coarse)` targets 44px, inputs a `1rem` (sin zoom iOS), toast glass, modal iOS-sheet con handle, responsive 768px (nav como pestañas arriba) y 900px (grid 2 columnas scoping con `:not()` — corrige el bug que pisaba `grid-stats`), checkbox/radio sin `width:100%`. |
| `index.html` | Logo SVG inline, meta description sin emoji, `theme-color` → `#f5f5f7` (antes `#075985`). |
| `server.js` | Log sin emoji; CSP endurecido: eliminados `fonts.googleapis.com`/`fonts.gstatic.com` de `style-src`/`font-src` (ya no hay fuentes externas). |
| `sw.js` | `CACHE_NAME` v4 → v5 (assets rediseñados). |
| `tests/flows.test.js` | `:131` → `assert.equal(pickUp.label, 'Cliente retiró')` (labels sin prefijo emoji). |
| `README.md` | Contador 37 → 48 tests; seed SQL con las 3 marcas; precios de referencia actualizados. |
| `PROJECT_STATUS.md` | Este archivo. |

**Bug de solape corregido tras revisión del usuario:** `.bottom-nav` es *flex item* de `.app` y
heredaba `z-index: 100` de la regla móvil; los flex items aplican `z-index` **aunque `position: static`**,
así que en ≥768px la fila de pestañas pintaba POR ENCIMA del topbar sticky (rolaba la marca al hacer
scroll y **robaba los eventos del botón Ingresar** en ciertos rangos de scroll, 14–105 px).
Fix: `z-index: auto` en `.bottom-nav` dentro de `@media (min-width: 768px)` (`styles.css`).
Verificado con Playwright: hover real en 5 puntos × 8 posiciones de scroll → 100% hit en el botón.

**No se modificó `package.json`.** Playwright se instaló con `npm i --no-save` solo para la verificación y se retiró (`node_modules` eliminado al cerrar la sesión).

### Sesión anterior: autenticación de cliente

| Archivo | Cambio |
|---------|--------|
| `js/auth.js` | **Nuevo.** Capa conmutable: valida email/teléfono Panamá/contraseña; crea y verifica cuentas locales (`agua-clara-auth-v1`, hash SHA-256 vía `crypto.subtle`); `register/login/logout/restoreSession` sincronizan `user`/`isLoggedIn`/`role` del store; rutas Supabase Auth por REST (`signup`, `token?grant_type=password`, `logout`, `user` + inserción en `profiles`) activas solo si se rellenan credenciales; exporta el guard puro `requiresAuth(view)`. Sin E/S al importar (testeable en Node). |
| `js/views/auth.js` | **Nuevo.** Pantallas de login/registro con las clases existentes `.auth-screen`/`.auth-card`/`.auth-logo`; formulario con validación vía toast, toggle login↔registro, "Volver al inicio"; indica honestamente el modo local ("cuenta local, solo en este dispositivo"). |
| `js/app.js` | Guards en `render()`: vistas privadas del cliente sin sesión → pantalla de auth; `afterRender` enlaza `bindAuthEvents`; arranque con `restoreSession()` + registro de `authReturnTo` si se arranca en hash privado. Importa `setState`. |
| `js/router.js` | `navigate()` y `popstate` redirigen rutas privadas sin sesión a `#login` guardando el destino; **arreglo**: `popstate` ahora llama `renderApp()` (antes solo mutaba el estado y el botón Atrás no redibujaba); `bindGlobalEvents` enlaza `#btn-logout`. |
| `js/ui.js` | `topbar()` muestra `Salir` (`#btn-logout`) con sesión e `Ingresar` (`data-nav="login")` sin ella. Se conserva `#demo-role`. |
| `js/store.js` | `DEFAULT_STATE.user` ahora incluye `id`; nuevo `authReturnTo`; helper puro `customerOrders(orders, userId)` (solo pedidos con `customerId` coincidente). |
| `js/views/cliente.js` | Inicio/`Mis pedidos`/`confirmación`/`repetir pedido` usan `customerOrders` (cada cliente solo ve lo suyo); `confirmOrder` exige sesión (→ login con retorno al carrito) y guarda `customerId`/`customerEmail` en el pedido; guardar perfil preserva `user.id` y sincroniza la cuenta local (`updateAccountProfile`). |
| `tests/auth.test.js` | **Nuevo.** 11 tests que **importan `js/auth.js` y `js/store.js` reales** (con mock de `localStorage`): validadores, creación/duplicados, verificación de credenciales, hash SHA-256, matriz `requiresAuth`, propiedad de pedidos, flujo registro→sesión→persistencia→restore→logout→login, `updateAccountProfile`, lectura de datos corruptos. |
| `PROJECT_STATUS.md` | Este archivo. |

**No se creó migración `003`:** `001`/`002` ya cubren `profiles` + RLS + policies de sesión
(insert/update propio, `is_admin()`); no falta nada estructural para el auth (el email vive en
`auth.users` de Supabase). Evita una migración innecesaria.

### Sesión anterior: corrección de recogida y pagos

| Archivo | Cambio |
|---------|--------|
| `PROJECT_STATUS.md` | Creado (punto de continuidad). |
| `js/store.js` | Nueva exportación `orderActions(order)` con las transiciones válidas del flujo de pedido (incluye `Cancelado`). |
| `js/ui.js` | `adminOrderCard` usa `orderActions`: recogida completable (`✓ Cliente retiró → Entregado`) y botón `💵 Registrar pago`. |
| `js/views/admin.js` | Binding de `data-paid` para registrar/anular cobros desde la administradora. |
| `tests/flows.test.js` | Nuevo: importa el código real de `js/store.js` (no una copia). 10 tests. |
| `sw.js` | `CACHE_NAME` v3 → v4; solo intercepta peticiones de origen propio (antes devolvía 503 a Google Fonts); JS/CSS ahora son *network-first* para que una actualización se aplique sin reinstalar la PWA. |
| `server.js` | El fallback SPA ya no devuelve HTML con 200 para archivos con extensión inexistentes (ahora 404). |
| `index.html` | Se elimina la referencia a `icons/apple-touch-icon.png` inexistente; se añade `mobile-web-app-capable` (aviso de consola). |
| `README.md` | Contador de tests 27 → 37, enlace a `PROJECT_STATUS.md`, fichas de `flows.test.js`. |
| `.gitignore` | Nuevo (`node_modules`, `.env`, `.playwright-mcp/`, salidas de Playwright). |

### Bug principal corregido: flujo de recogida bloqueado

**Antes:** `Pendiente → Aceptado → En preparación → Asignado → Listo para recoger → ❌ sin salida`.
La administradora no tenía botón para darlo por retirado y el repartidor no veía el pedido
(filtro `['Asignado','En camino']`), así que un pedido de recogida **nunca llegaba a `Entregado`**
y no entraba en el informe de ventas. Tampoco existía forma de registrar el pago cobrado en el local.

**Ahora:** `… → En preparación → Listo para recoger → ✓ Cliente retiró (Entregado)`,
más `💵 Registrar pago` en cualquier pedido no pagado.

## 8. Errores conocidos (abiertos)

1. **Auth solo local** → las cuentas viven en `localStorage` de este dispositivo (modo demo,
   marcado como tal en la UI). No sirve para producción ni multiusuario. El rol de admin/repartidor
   sigue cambiándose con un selector libre (protección real requiere Supabase Auth + roles en `profiles`).
2. **Datos en `localStorage`** → no hay datos multiusuario ni entre dispositivos.
3. **Tests parcialmente duplicados** → `pricing.test.js`/`roles.test.js` no fallarían si `store.js` se
   rompe (los cubre `flows.test.js` y ahora también `auth.test.js`, que sí importan el código real).
4. **`test:e2e` no ejecutable** → falta `playwright.config.js` y specs; `@playwright/test` no está instalado (`node_modules` no existe).
5. **Iconos PWA incompletos** → solo hay `favicon.svg`; iOS/Android prefieren PNG 192/512 y `apple-touch-icon.png` (la referencia rota ya se eliminó de `index.html`).
6. **Reparto asignado a un único repartidor hardcodeado.**
7. **Sin repositorio Git** (se añadió `.gitignore`, pero no hay commits ni historial).
8. **Service Worker con caché** → si un cambio de código no aparece, recargar; en esta sesión se
   pasó a `CACHE_NAME=agua-clara-v4` con JS/CSS *network-first*, así que ya no debería ocurrir.

## 9. Pruebas ejecutadas (esta sesión)

```
npm test  →  48 tests, 0 fallos (node --test, Node v24.20.0)
             · tests/auth.test.js   → 11 tests sobre js/auth.js y js/store.js reales
             · tests/flows.test.js  → 10 tests sobre el código real de js/store.js
               (label actualizado a 'Cliente retiró', sin prefijo emoji)
             · tests/pricing.test.js → 16 tests
             · tests/roles.test.js  → 11 tests

Verificación E2E con Playwright (script temporal, Chromium, http://localhost:4173)
— 3 viewports × 3 roles:
  ✔ 390×844 / 768×1024 / 1440×900 → SIN ERRORES: 0 emojis en el DOM,
    0 desbordes horizontales, 0 errores de consola, targets táctiles ≥44px,
    inputs a 1rem (sin zoom en iOS), nav en su sitio (inferior → pestañas)
  ✔ Cliente: registro por UI → catálogo (3 marcas) → carrito → checkout →
    confirmación → pedido visible en "Mis pedidos"
  ✔ Admin: pedido manual ("María López") → Aceptar → Preparar → Asignar
  ✔ Repartidor: abrir entrega → modal de cobro → "Entregado" persistido
    en localStorage
  ✔ 33 screenshots de auditoría revisados a ojo (temporales, borrados al cerrar)

No se aplicaron las migraciones SQL (no hay proyecto Supabase ni credenciales).
No se verificó la instalación real de la PWA en un dispositivo (faltan iconos PNG).
```

## 10. Variables de entorno necesarias (sin secretos)

Definidas en `.env.example`; **ninguna está configurada todavía**:

| Variable | Necesaria para | Estado |
|----------|----------------|--------|
| `SUPABASE_URL` | Conexión a base de datos y auth | Vacía — bloquea BD/auth |
| `SUPABASE_PUBLISHABLE_KEY` | Cliente Supabase desde el navegador | Vacía — bloquea BD/auth |
| `BUSINESS_WHATSAPP_NUMBER` | Enlaces wa.me (también configurable desde la UI) | Vacía (la UI usa `50760000000` por defecto) |
| `WHATSAPP_API_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Notificaciones automáticas | Vacías — bloqueadas |
| `YAPPY_MERCHANT_ID` | Pagos con Yappy | Vacío — bloqueado |
| `PAYMENT_PROVIDER_SECRET` | Pasarela de pagos | Vacío — bloqueado |
| `PORT` | Puerto del servidor (default 4173) | Opcional |

El servidor **no lee `.env`** actualmente (usa `process.env.PORT` directamente). `node` no carga `.env` por sí solo.

## 11. Migraciones de base de datos

`supabase/migrations/001_initial.sql` → `002_additional_tables.sql`. **No aplicadas.**
Crean 15 tablas, RLS en todas, `is_staff()`, `is_admin()`, `create_order()` (importes calculados
en servidor, con idempotencia), trigger `trg_order_status_change` e índices.

Pendiente al conectar Supabase: crear proyecto → ejecutar en orden en el SQL Editor →
copiar URL y clave `anon` → crear usuarios y asignar roles con `UPDATE profiles SET role=...`.

## 12. Integraciones bloqueadas por credenciales

- **Supabase** (BD + auth) → sin proyecto configurado.
- **Yappy** → sin credenciales comerciales.
- **WhatsApp Business API** → sin cuenta Business verificada.
- **Pasarela de pagos** → sin proveedor elegido.

## 13. Última tarea completada

**Rediseño completo estilo Apple + catálogo + responsive (esta sesión):**

1. **Cero emojis**: nuevo `js/icons.js` (~35 iconos SVG stroke 1.8); emojis sustituidos en
   `store.js`, `ui.js`, las 4 vistas, `index.html` y `server.js`. Verificado por rangos Unicode
   sobre el DOM de los 3 roles: **0 coincidencias**.
2. **Catálogo 3 marcas** (Aquaviva B/.4.90, Cristalina B/.5.50, Purísima B/.4.95, garrafón 5 gal.)
   con migración automática `catalogVersion: 2` que respeta precios editados y vacía el carrito
   solo si referenciaba productos legacy.
3. **Rediseño Apple** en `styles.css`: sistema pila SF (sin Google Fonts), tokens neutros,
   hairlines, glass blur, focus-visible + reduced-motion, botones pill, modal sheet iOS,
   inputs 1rem, targets 44px en pantallas táctiles.
4. **Responsive** 390/768/1440: sin desbordes; nav inferior en móvil y pestañas superiores en
   desktop; arreglo del bug que pisaba `grid-stats`; checkbox/radio sin `width:100%`; botones
   del repartidor sin recorte de texto.
5. **Auditoría de usabilidad** de los 3 roles con Playwright: flujos completos por UI en los
   3 viewports → **SIN ERRORES** + 33 screenshots revisados; fixes aplicados (topbar móvil,
   precios de una línea, jerarquía de botones del repartidor, descripciones cortas).
6. Cierre: `npm test` → **48 tests, 0 fallos**; CSP sin fuentes externas; `theme-color` y
   `sw.js` (v5) actualizados; README y este archivo actualizados; temporales eliminados.

Tareas anteriores: autenticación de cliente (`js/auth.js`, guards, propiedad de pedidos,
`tests/auth.test.js`); auditoría inicial + `PROJECT_STATUS.md`; corrección del flujo de
recogida (`orderActions()`); registro de pagos; `tests/flows.test.js`; arreglo de SW/fallback/icono.

## 14. Siguiente tarea recomendada (orden de valor)

1. **Panel de clientes para la administradora** (listado derivado de `orders` agrupado por
   `customerId`/`customerName`, historial por cliente, botón WhatsApp). Ya existe
   `customerOrders()` en `store.js` como base.
2. **Conectar Supabase** cuando existan credenciales: rellenar `SUPABASE_URL`/`SUPABASE_ANON_KEY`
   en `js/auth.js` (la capa REST de auth ya está escrita), aplicar migraciones 001/002 y migrar
   el store de `localStorage`.
3. **Test E2E real con Playwright** del flujo happy-path (config + specs + `npm run test:e2e`).
4. **PWA**: iconos PNG 192/512 + `apple-touch-icon` y verificación de instalación/offline.

## 15. Riesgos a evitar al continuar

- **No** cambiar la arquitectura (vanilla SPA + `localStorage`/Supabase) ni sustituir librerías.
- **No** tocar `calcOrderTotal` ni la regla de envío (B/.4.50 fijo por pedido): 48 tests la protegen.
- **No** eliminar el selector de rol demo: la auth de cliente existe, pero admin/repartidor siguen
  siendo roles demo sin cuenta real; retirarlo solo cuando Supabase Auth + roles estén conectados.
- **No** presentar el modo local de `js/auth.js` como auth de producción (la UI ya lo marca);
  el registro por `signup` de Supabase está escrito pero **no probado** (sin credenciales).
- **No** introducir `service_role` ni secretos en el frontend; respetar el CSP de `server.js`
  (`connect-src 'self' https://*.supabase.co` — ampliarlo si se añade otro dominio).
- **No** reescribir vistas completas para hacer cambios pequeños; editar `ui.js`/`store.js` afecta
  a los tres roles a la vez, revisar las tres vistas después de cada cambio.
- **No** marcar integraciones (Yappy, WhatsApp API, Supabase) como funcionales sin probarlas.
- **No** reintroducir emojis en la UI: usar `js/icons.js` (o texto plano); verificar con una
  búsqueda por rangos Unicode si se añade UI nueva.
- **No** reintroducir fuentes externas (Google Fonts): el CSP ya no las permite y el diseño
  depende de la pila SF/`-apple-system`.
- Ejecutar `npm test` y una pasada manual en navegador después de cada conjunto de cambios.
