# Importadora Central

Catálogo virtual mayorista con:

- catálogo público rápido para miles de productos
- carrito liviano en la misma interfaz
- reglas de precio por unidad, mayorista y cajón
- orden de compra enviada por WhatsApp
- login administrativo
- CRUD de productos y configuración global

## Stack

- `Next.js 16` con App Router
- `PostgreSQL` como base principal
- `Prisma` para acceso a datos
- sesión segura con cookie HTTP-only firmada
- `Zustand` para el carrito en cliente

## Pensado para rendimiento

- paginación en servidor para evitar cargar 15 mil productos en cliente
- filtros por código, nombre, marca y categoría
- índices en campos críticos (`code`, `name`, `category`, `brand`, `isVisible`)
- carrito persistido localmente sin castigar al servidor
- panel admin separado del flujo público
- estructura lista para VPS con Docker y Postgres

## Variables de entorno

Copia `.env.example` como `.env` y ajusta:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/importadora?schema=public"
AUTH_SECRET="cambia-esta-clave-larga-y-aleatoria"
ADMIN_EMAIL="admin@importadora.local"
ADMIN_NAME="Administrador"
ADMIN_PASSWORD="admin12345"
FACTURADOR_API_URL="https://demo.facturadorsmart.pe/api"
FACTURADOR_API_TOKEN=""
FACTURADOR_SYNC_SOURCE="facturador-smart"
FACTURADOR_REQUEST_TIMEOUT_MS="15000"
FACTURADOR_SYNC_START_PRODUCT_PAGE="1"
FACTURADOR_SYNC_MAX_PRODUCT_PAGES=""
FACTURADOR_PRODUCT_PAGE_DELAY_MS="750"
FACTURADOR_MAX_RETRIES="5"
FACTURADOR_RETRY_DELAY_MS="5000"
```

## Arranque local

1. Instala dependencias:

```bash
npm install
```

2. Levanta Postgres. Puedes usar Docker:

```bash
docker compose up -d db
```

3. Genera y aplica la base:

```bash
npm run db:push
npm run db:seed
```

4. Inicia el proyecto:

```bash
npm run dev
```

## Usuario inicial

Se crea desde el seed usando `ADMIN_EMAIL` y `ADMIN_PASSWORD`.

## Sincronización con facturador externo

El puente profesional de productos queda preparado para consumir la API externa cuando se tenga un token válido. La tienda mantiene su propia base local y sincroniza desde el facturador hacia `Product`, guardando referencias externas para evitar duplicados:

- `externalSource`
- `externalId`
- `externalCode`
- `syncEnabled`
- `lastSyncedAt`

Para sincronizar productos, categorías, marcas, precios, stock e imágenes disponibles:

```bash
npm run sync:facturador-products
```

Para ejecutarlo automáticamente cada 60 minutos en un VPS Linux con `cron`:

```bash
0 * * * * cd /ruta/de/IMPORTADORA && ERP_SYNC_TRIGGER=AUTOMATIC npm run sync:facturador-products >> /var/log/importadora-sync.log 2>&1
```

Para mantener el stock siempre fresco sin tocar precios en cada corrida, puedes usar:

```bash
* * * * * cd /ruta/de/IMPORTADORA && set -a && . ./.env && set +a && ERP_SYNC_TRIGGER=AUTOMATIC ERP_SYNC_MODE=STOCK_ONLY npm run sync:facturador-products >> /var/log/importadora-sync-stock.log 2>&1
2-57/5 * * * * cd /ruta/de/IMPORTADORA && set -a && . ./.env && set +a && ERP_SYNC_TRIGGER=AUTOMATIC ERP_SYNC_MODE=STOCK_PRICE npm run sync:facturador-products >> /var/log/importadora-sync-price.log 2>&1
```

El primer cron actualiza solo stock y disponibilidad cada minuto. El segundo refresca stock, precio unitario y precio mayorista cada 5 minutos, con un pequeño desfase para reducir solapes.

Cada ejecución deja bitácora en `ErpSyncLog`, visible desde `/admin/settings`, con estado, origen, disparador, cantidades procesadas y error si algo falla.

El sincronizador requiere `FACTURADOR_API_URL` y `FACTURADOR_API_TOKEN`. Si el token responde `401 Unauthorized`, la integración está lista pero no podrá traer datos reales hasta que el administrador de la API entregue credenciales válidas. Por defecto recorre todas las páginas del endpoint de productos; para pruebas o cargas por bloques se puede usar `FACTURADOR_SYNC_START_PRODUCT_PAGE` y `FACTURADOR_SYNC_MAX_PRODUCT_PAGES`. Si el ERP limita peticiones, se puede subir `FACTURADOR_PRODUCT_PAGE_DELAY_MS` o `FACTURADOR_RETRY_DELAY_MS`.

Modos de sincronización:

- `FULL`: sincroniza todo el catálogo del ERP y actualiza lo existente.
- `NEW_ONLY`: lee todo el ERP pero solo crea productos que todavía no están vinculados.
- `INCREMENTAL`: requiere que el ERP exponga un filtro por fecha en `FACTURADOR_SYNC_UPDATED_SINCE_PARAM`. Con ese parámetro el cliente lee solo los cambios desde el último checkpoint exitoso registrado en `ErpSyncLog`. Si todavía no hay checkpoint previo, la primera corrida hace carga completa.

Para el modo incremental puedes ajustar el formato del valor enviado al ERP con `FACTURADOR_SYNC_UPDATED_SINCE_FORMAT`:

- `iso` (por defecto)
- `date`
- `unix-ms`
- `unix-seconds`

## Estructura principal

- `src/app/page.tsx`: catálogo público
- `src/app/login`: acceso admin
- `src/app/admin`: dashboard y CRUD
- `src/lib/store.ts`: consultas y mapeo de datos
- `src/lib/pricing.ts`: reglas de precios
- `src/lib/facturador`: cliente, mapeo y sincronización con API externa
- `prisma/schema.prisma`: modelos base

## Siguientes mejoras recomendadas

- sincronización bidireccional `tienda → ERP` para precios, fotos y atributos definidos
- historial de órdenes generadas
- imágenes subidas a S3 o Cloudflare R2
- búsqueda con `pg_trgm` para mayor tolerancia en catálogos grandes
- roles adicionales (`vendedor`, `almacén`)
