# Agua Clara — PWA de Venta y Distribución de Agua Purificada

Aplicación web progresiva para un negocio de venta y reparto de botellones de agua purificada de 5 galones en Panamá.

## Estado actual

> El detalle completo de qué está terminado, qué está a medias y cuál es la siguiente tarea
> está en [`PROJECT_STATUS.md`](PROJECT_STATUS.md). Ese archivo es el punto de continuidad
> entre sesiones de desarrollo: léelo antes de continuar.

### ✅ Funcionalidades implementadas

| Módulo | Funcionalidades |
|--------|----------------|
| **Cliente** | Inicio con catálogo, carrito con +/−, checkout con modalidad entrega/recogida, resumen y confirmación, historial con "repetir pedido", gestión de cuenta y direcciones |
| **Administradora** | Panel de pedidos con stats, aceptar/preparar/asignar/cancelar, pedidos manuales (teléfono/WhatsApp), gestión de productos y precios, informe de ventas del día, configuración del negocio |
| **Repartidor** | Lista de entregas asignadas con stats, marcar entregado con modal (cobro efectivo + envases vacíos), registrar problema con motivos, historial de entregas |
| **Regla de envío** | B/.4.50 fijo por pedido a domicilio, B/.0.00 recogida, configurable desde admin |
| **WhatsApp** | Enlaces wa.me para contactar negocio/cliente con mensaje preparado |
| **Google Maps** | Botón de navegación con dirección del cliente |
| **PWA** | Manifest, Service Worker con cache inteligente, iconos SVG, instalable |
| **Base de datos** | 2 migraciones SQL con 14+ tablas, RLS, función `create_order` en servidor, trigger de log de estados |
| **Pruebas** | 48 tests automatizados (precios, roles, seguridad, flujos, auth — `tests/flows.test.js` y `tests/auth.test.js` importan el código real) |

### ⏳ Pendiente de credenciales externas

- **Supabase**: Necesita proyecto configurado, URL y clave publicable
- **Yappy**: Pendiente de credenciales comerciales
- **WhatsApp Business API**: Pendiente de cuenta Business verificada
- **Pasarela de pagos**: Pendiente de proveedor elegido

### 📝 Limitación actual: modo demo local

La demo guarda datos en `localStorage`. No es multiusuario. El esquema real de Supabase está en `supabase/migrations/` listo para aplicarse en un proyecto Supabase configurado.

## Ejecutar

Requiere Node.js 20+.

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo
npm start
# Abre http://localhost:4173

# 3. Ejecutar pruebas
npm test
```

## Estructura del proyecto

```
Sistema_Agua/
├── index.html              # Punto de entrada HTML
├── styles.css              # Sistema de diseño completo
├── manifest.json           # Configuración PWA
├── sw.js                   # Service Worker
├── server.js               # Servidor estático Node.js
├── package.json
├── .env.example
├── README.md
├── PROJECT_STATUS.md       # Estado real del proyecto (continuidad entre sesiones)
│
├── icons/
│   └── favicon.svg         # Icono de la app
│
├── js/
│   ├── app.js              # Punto de entrada principal
│   ├── store.js            # Estado central y lógica de negocio
│   ├── router.js           # Enrutador SPA
│   ├── ui.js               # Componentes UI reutilizables
│   └── views/
│       ├── cliente.js      # Vistas del cliente
│       ├── admin.js        # Vistas de la administradora
│       └── repartidor.js   # Vistas del repartidor
│
├── supabase/
│   └── migrations/
│       ├── 001_initial.sql          # Tablas base + RLS + create_order
│       └── 002_additional_tables.sql # Tablas adicionales + triggers
│
├── tests/
│   ├── pricing.test.js     # Tests de precios y reglas de negocio
│   ├── roles.test.js       # Tests de roles y seguridad
│   └── flows.test.js       # Tests de flujo que importan js/store.js
│
└── infra/
    └── Caddyfile           # Config de producción con Caddy
```

## Base de datos

Las migraciones en `supabase/migrations/` crean:

| Tabla | Propósito |
|-------|-----------|
| `profiles` | Usuarios y roles (cliente, administradora, repartidor) |
| `products` | Catálogo, precios y disponibilidad |
| `addresses` | Direcciones de clientes |
| `business_settings` | Configuración del negocio (tarifa de envío, etc.) |
| `orders` | Pedidos con totales históricos |
| `order_items` | Líneas del pedido con precios al momento de la compra |
| `order_events` | Historial de cambios de estado |
| `payments` | Pagos y referencias de transacción |
| `vehicles` | Vehículos de reparto |
| `delivery_assignments` | Asignaciones al repartidor |
| `delivery_zones` | Zonas de entrega (opcional) |
| `inventory` | Existencias de productos |
| `stock_movements` | Entradas/salidas de inventario |
| `container_ledger` | Registro de envases (entregados, devueltos) |
| `notification_logs` | Historial de notificaciones enviadas |

### Seguridad

- Row Level Security (RLS) en todas las tablas
- Función `is_staff()` e `is_admin()` para verificar roles
- `create_order()` calcula precios en el servidor, no acepta importes del cliente
- Clave de idempotencia para prevenir pedidos duplicados
- Trigger automático que registra cambios de estado
- CSP headers en el servidor

## Configuración para producción

### 1. Crear proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) y crear un proyecto
2. En SQL Editor, ejecutar `001_initial.sql` y luego `002_additional_tables.sql`
3. Copiar la URL y la clave `anon` (publicable)

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con los valores reales
```

### 3. Configurar Auth

1. En Supabase Dashboard → Authentication → Providers
2. Habilitar Email/Password
3. Configurar URL de redirección

### 4. Crear usuarios iniciales

```sql
-- Después de que el usuario se registre, cambiar su rol:
UPDATE public.profiles SET role = 'administradora' WHERE id = 'UUID-DEL-USUARIO';
UPDATE public.profiles SET role = 'repartidor' WHERE id = 'UUID-DEL-USUARIO';
```

### 5. Insertar productos

```sql
INSERT INTO public.products (name, container_type, price_cents, available, description)
VALUES
  ('Aquaviva', 'Retornable', 490, true, 'Agua purificada Aquaviva, garrafón 5 galones retornable.'),
  ('Cristalina', 'Retornable', 550, true, 'Agua purificada Cristalina, garrafón 5 galones retornable.'),
  ('Purísima', 'Retornable', 495, true, 'Agua purificada Purísima, garrafón 5 galones retornable.');
```

> ⚠️ Los precios (490/550/495 centavos) son de referencia; confirmar los reales con el negocio
> o configurarlos desde el panel de administración. El catálogo de `localStorage` se migra solo
> (`catalogVersion` en `js/store.js`).

### 6. Publicar

- Opción A: Servir con `node server.js` detrás de un proxy (Caddy, nginx)
- Opción B: Subir los archivos estáticos a cualquier hosting (Netlify, Vercel, Cloudflare Pages)
- El `infra/Caddyfile` tiene una configuración base para Caddy con HTTPS

## Datos comerciales pendientes de confirmación

- Precios del catálogo (Aquaviva B/.4.90, Cristalina B/.5.50, Purísima B/.4.95): **confirmar antes de publicar**
- Tarifa de envío: B/.4.50 (según requerimiento, configurable)
- Número de WhatsApp del negocio: **completar en configuración**
- Reglas de depósito/devolución de envases: **no inventadas, pendientes del negocio**

## Pruebas ejecutadas

```
48 tests, 0 fallos

✔ 4 botellones a B/.2.50 con envío = B/.14.50
✔ 1 botellón a B/.2.50 con envío = B/.7.00
✔ 4 botellones a B/.2.50 para recoger = B/.10.00
✔ el envío es fijo por pedido, no se multiplica por botellones
✔ todos los importes son centavos enteros
✔ pedido con productos mixtos (retornable + nuevo)
✔ recogida con múltiples productos no tiene envío
✔ la tarifa de envío es configurable
✔ los precios históricos se conservan en el pedido
✔ flujo de estados válido para entrega/recogida
✔ la recogida completa hasta "Entregado" sin pasar por "En camino"
✔ la entrega a domicilio nunca se marca "Listo para recoger"
✔ formato B/. es correcto
✔ escape HTML previene inyección XSS
✔ idempotencia con clave única previene duplicados
✔ el cliente solo puede ver sus propios pedidos
✔ el repartidor no puede modificar precios
✔ la administradora puede gestionar pedidos
✔ flujo completo: cliente crea cuenta y realiza pedido
✔ el pago no se puede confirmar desde el cliente
✔ error de red no produce confirmación falsa
✔ validación rechaza datos inválidos
✔ un cliente no puede auto-asignarse rol de admin
✔ el repartidor solo ve sus entregas asignadas
✔ informe de ventas calcula correctamente
```

## Próximos pasos para producción

1. Aplicar migraciones en Supabase
2. Conectar el frontend al cliente Supabase (sustituir localStorage)
3. Configurar Auth con email/teléfono
4. Confirmar precios reales con el negocio
5. Configurar dominio y HTTPS
6. Probar en dispositivos reales (Android/iOS)
7. Activar proveedor de pagos (Yappy) cuando estén las credenciales
8. Configurar WhatsApp Business API cuando esté aprobada la cuenta
