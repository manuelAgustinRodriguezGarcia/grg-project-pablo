# Estado actual del proyecto

**Fecha del recorte:** 1 de septiembre de 2026  
**Producto:** Sistema web Rothamel Repuestos (catálogos técnicos + listas de precios + facturación)  
**Cliente:** Pablo R., casa de repuestos, Chaco, Argentina  
**Dominio previsto:** `www.rothamelrepuestos.com.ar` (aún no desplegado en producción)

Este documento describe lo que hay **hoy en el workspace**, no el roadmap del README. Varios docs oficiales (`README.md`, `docs/PRD.md` §3, `docs/BACKEND-IMPLEMENTATION.md`, `docs/ENDPOINTS.md`) están desactualizados respecto al código.

---

## 1. Recorte de git

| Dato | Valor |
|------|--------|
| Rama | `fix/catalog-search-pagination-preview` |
| Último commit | `023941e` — Fix catalog page scroll, precise numeric search, and preview columns |
| Working tree | Hay **mucho trabajo local sin commitear**, sobre todo el módulo de Facturación |

El módulo de catálogos, precios, importación, archivos, usuarios y landing **sí está en el historial de git**.  
El módulo de facturación (UI, servicios, Prisma, PDFs, migraciones de agosto 2026) **está implementado en disco pero todavía no está commiteado**.

Si se clona la rama sin esos cambios locales, Facturación no aparece.

---

## 2. Qué es el sistema

Plataforma web privada para:

1. **Centralizar catálogos técnicos** que antes vivían en Excel + pendrive.
2. **Administrar listas de precios** independientes de los catálogos.
3. **Facturar en modo prueba** (clientes, rubros, facturas A/B, Recibos X, NC/ND, Libro IVA), sin envío a ARCA.

La landing institucional es pública. El resto del panel exige sesión Supabase.

---

## 3. Stack

| Capa | Tecnología |
|------|------------|
| App | Next.js `16.2.9`, React `19.2.4`, TypeScript |
| Estilos | SCSS Modules |
| Datos cliente | TanStack Query, React Hook Form, Zod |
| Backend | Route Handlers + Server Actions + services + repositories (sin NestJS) |
| DB | PostgreSQL (Supabase) + Prisma `7.8` + JSONB |
| Auth / Storage | Supabase Auth y buckets privados |
| Excel | ExcelJS |
| PDF facturación | `pdf-lib` |
| Charts | Recharts |
| Tests | Vitest (~180 archivos de test) |
| Package manager | pnpm `9.15.9` |

**No hay PWA/service worker en el cliente.** El backend de sync offline (manifest, bundles, thumbnails) existe; la UI offline no.

---

## 4. Roles y acceso

Roles en Prisma: **`ADMIN`** y **`USUARIO`**.

Los roles viejos `CONSULTA` y `VISUALIZACION` ya no existen (migraciones de julio 2026).

| Rol | Qué puede hacer |
|-----|-----------------|
| `ADMIN` | Todo: dashboard, facturación, archivos, usuarios, importar, editar catálogos y precios |
| `USUARIO` | Solo lectura de catálogos y precios visibles (`visibleToNormalUser`). Home → `/admin/catalogos` |

Rutas de auth:

| Ruta | Estado |
|------|--------|
| `/auth/login` | Funcional |
| `/login` | Redirect a `/auth/login` |
| `/auth/callback` | Funcional (Supabase) |
| `/auth/forgot-password` y `/auth/reset-password` | Declaradas en config; **no hay páginas** |

Tras login: `ADMIN` → `/admin/inicio`; `USUARIO` → `/admin/catalogos`.

---

## 5. Navegación del panel

Orden del SideNav:

1. **Inicio** (`/admin/inicio`) — solo admin  
2. **Catálogos** (`/admin/catalogos`)  
3. **Precios** (`/admin/precios`)  
4. **Facturación** (`/admin/facturacion`) — solo admin  
5. **Archivos** (`/admin/archivos`) — solo admin  
6. **Usuarios** (`/admin/usuarios`) — solo admin  

Dock móvil: Inicio, Catálogos, Precios, Facturación.

---

## 6. Estado por módulo

### 6.1 Landing pública (`/`)

**Listo.** Página institucional (hero, marcas, categorías). No requiere login.

### 6.2 Catálogos (`/admin/catalogos`)

**Listo y cableado a datos reales** (no es mock).

Incluye:

- Directorio de catálogos y carpetas (hojas de Excel).
- Tabla dinámica de productos con paginación, búsqueda por carpeta y filtros por columna (texto, número con rango, etc.).
- Búsqueda global con dropdown y preview.
- CRUD de catálogos, carpetas, columnas y productos (admin).
- Visibilidad por rol (`visibleToNormalUser`).
- Equivalencias de códigos, ayuda contextual en columnas, anotaciones por campo.
- Imágenes de producto (embebidas, ZIP, manuales, revisión).
- Importador Excel guiado hacia carpeta de catálogo.

Últimos ajustes en esta rama: scroll de la página de catálogo, búsqueda numérica precisa y columnas de preview.

### 6.3 Precios (`/admin/precios`)

**Listo.**

- Listas independientes de catálogos.
- Columnas e ítems dinámicos, CRUD, vaciar lista.
- Importación Excel con destino `PRICE_LIST` (sin pipeline de imágenes).
- Datos de proveedor (nombre/fecha).
- Búsqueda y filtros en la lista activa.
- Visibilidad por rol.

### 6.4 Importación Excel

**Listo** para catálogos y precios.

Asistente de varios pasos: subida, destino, hojas, columnas, preview, aplicar (`IMPORTAR_LISTA` / `COMBINAR_LISTA` / `REEMPLAZAR_LISTA`).  
Originales en Storage (`excel-originals`). Límite de body de importación: 55 MB.

### 6.5 Archivos (`/admin/archivos`)

**Listo.** Listado, búsqueda, detalle, informe de importación, descarga, reproceso, eliminación. Entrada al wizard de importación.

### 6.6 Usuarios (`/admin/usuarios`)

**Listo.** Alta/edición de usuarios del panel (admin). Semillas: `seed:admin`, `seed:usuario`.

### 6.7 Offline / PWA

| Capa | Estado |
|------|--------|
| Backend (manifest, bundles, thumbnails) | Implementado |
| PWA, IndexedDB, consulta sin red | **No implementado** |

### 6.8 Facturación (working tree, sin commit)

**Fases 1–6 del PRD de facturación están cubiertas en modo prueba.**  
**No hay integración ARCA** (fases 7–8).

Subsecciones:

| Ruta pública | Contenido |
|--------------|-----------|
| `/admin/facturacion` | Hub con 6 accesos |
| `/admin/facturacion/clientes` | CRUD clientes, CUIT/DNI, historial |
| `/admin/facturacion/rubros` | CRUD rubros + insights de ventas |
| `/admin/facturacion/nueva-factura` | Alta de factura A/B modo prueba |
| `/admin/facturacion/facturas` | Historial, detalle, PDF, Libro IVA (rewrite interno a `comprobantes`) |
| `/admin/facturacion/movimientos` | Recibos X, NC, ND, imputaciones (`/pagos` redirige acá) |
| `/admin/facturacion/configuracion-fiscal` | IVA, límite de cliente genérico, ambiente (lectura) |

PDFs (al vuelo / por id):

- Factura
- Recibo X
- Nota de crédito / débito
- Libro IVA mensual (A4 horizontal, hojas A y B)

Compartir factura: WhatsApp / email (links `wa.me` y `mailto`, no API de WhatsApp Business).

Dashboard de Inicio usa métricas reales de facturas del mes (KPI, top clientes/rubros, impagas, último catálogo y última lista de precios).

---

## 7. Facturación vs PRD (agosto 2026)

Documento de producto: [`docs/PRD-FACTURACION.md`](./PRD-FACTURACION.md)  
Specs: [`docs/superpowers/specs/2026-08-10-facturacion-fase1-nav-design.md`](./superpowers/specs/2026-08-10-facturacion-fase1-nav-design.md), [`docs/superpowers/specs/2026-08-28-notas-y-libro-iva-design.md`](./superpowers/specs/2026-08-28-notas-y-libro-iva-design.md)

| Fase PRD | Tema | Estado en el código local |
|----------|------|---------------------------|
| 1 | Nav, hub, Inicio | Hecho |
| 2 | Clientes | Hecho |
| 3 | Rubros | Hecho |
| 4 | Facturas modo prueba | Hecho |
| 5 | PDF, Recibos X, NC/ND, Libro IVA | Hecho |
| 6 | Dashboard | Hecho (datos reales, no placeholders) |
| 7 | Preparación ARCA (SDK, certificados, intentos) | **No** — hay settings y enums fiscales, sin SDK |
| 8 | Homologación / CAE / QR fiscal | **No** |

Reglas ya implementadas (modo prueba):

- Letra A/B automática según condición IVA.
- Snapshot del cliente en la factura (editar el cliente después no cambia comprobantes viejos).
- IVA y límite de cliente genérico editables solo por admin, con confirmación.
- Pago de facturas **solo** vía Recibo X (imputación a una o varias, o pago a cuenta).
- Saldo = `total − NC + ND − recibos imputados`.
- Estado de pago derivado (impaga / parcial / paga); anulación total por NC → `ANULADA_NC` y **no** se marca Paga.
- Numeración interna de NC/ND; Libro IVA al vuelo por mes (sin tabla de cierre persistido).

Fuera de alcance actual (acordado en specs / PRD):

- Envío a ARCA, CAE, QR, PDF fiscal definitivo.
- Ítems de renglón en NC/ND (solo importe + motivo).
- Edición o anulación de una nota ya emitida.
- Cierre persistido de Libro IVA (`monthly_vat_books`).
- Impresora fiscal, banco, WhatsApp Business API, stock, multiempresa.

Presupuesto de la etapa: **$2.800.000 ARS** (aprobado).

---

## 8. Modelo de datos (Prisma)

**Catálogos / operación**

`User`, `Catalog`, `CatalogFolder`, `FolderColumn`, `Product`, `EquivalentCode`, `ProductFieldAnnotation`, `ProductImage`, `UploadedFile`, `ImportJob`, `ImportSheet`, `ImportPreview`, `GlobalField`, `PriceList`, `PriceColumn`, `PriceItem`, `OfflineSyncManifest`, `AuditLog`

**Facturación (migraciones locales 2026-08-24 y 2026-08-28)**

`BillingClient`, `BillingRubro`, `BillingFiscalSettings` (registro único), `BillingInvoice`, `BillingInvoiceItem`, `BillingReceipt`, `BillingReceiptAllocation`, `BillingNote`

Ambiente fiscal por defecto: `MODO_PRUEBA`. Campos `cae`, `caeExpiresAt`, `qrUrl` existen en factura pero no se llenan.

---

## 9. Storage (Supabase, buckets privados)

| Bucket | Uso |
|--------|-----|
| `excel-originals` | Excel subidos |
| `product-images` | Imágenes de producto |
| `column-help-images` | Ayuda de columnas |
| `product-field-help-images` | Anotaciones por campo |
| `temp-imports` | Temporal de importación |
| `billing-payment-proofs` | Reservado para comprobantes de pago (PDF/imagen) |

Los PDF de factura/recibo/nota se generan en servidor (`src/server/pdf/`) y se sirven por route handlers; no dependen de ARCA.

---

## 10. Rutas de aplicación relevantes

```text
/                          landing
/auth/login                login
/admin                     redirect por rol
/admin/inicio              dashboard admin
/admin/catalogos           catálogos
/admin/precios             listas de precios
/admin/archivos            historial Excel
/admin/usuarios            usuarios
/admin/facturacion         hub
/admin/facturacion/...     secciones de facturación
/api/admin/...             APIs (catálogos, search, sync, PDFs de billing, etc.)
```

Rewrite: `/admin/facturacion/facturas` → página interna `comprobantes`.  
Redirect: `/admin/facturacion/comprobantes` y `/admin/facturacion/pagos` → nombres actuales del PRD.

---

## 11. Qué falta / siguiente trabajo

Orden práctico, no un plan cerrado:

1. **Commitear y revisar** el módulo de facturación (hoy solo en el working tree).
2. **Validar con Pablo** el flujo modo prueba (clientes, facturas, recibos, NC/ND, Libro IVA, PDFs).
3. **Fase 10 catálogos:** pruebas con archivos reales (Rulemanes, Catálogo Azul, Embragues), rendimiento, seguridad de producción, despliegue en `rothamelrepuestos.com.ar`.
4. **PWA / modo offline** en el cliente (backend ya existe).
5. **Recuperación de contraseña** (páginas `/auth/forgot-password` y `/auth/reset-password`).
6. **ARCA** (fases 7–8): certificados, SDK, CAE, QR, PDF fiscal, homologación.
7. **Actualizar docs** (`README.md` roadmap, `PRD.md` §3, `BACKEND-IMPLEMENTATION.md`, `ENDPOINTS.md`) para que dejen de decir que catálogos/precios/archivos/usuarios están pendientes o mock.

Pendientes menores de facturación respecto al PRD:

- Configuración fiscal: se editan IVA y límite genérico; emisor/CUIT/PV/ambiente se muestran o viven en schema, **sin** carga de certificado ni Arca SDK.
- Bucket `billing-payment-proofs` definido; no es el flujo principal de Recibo X.

---

## 12. Cómo correrlo

```bash
pnpm install
# .env: DATABASE_URL, DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL,
#       NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
pnpm db:migrate
pnpm seed:admin
pnpm dev
```

Otros scripts: `pnpm test:run`, `pnpm lint`, `pnpm db:studio`, `pnpm db:verify`, `pnpm storage:verify`, `pnpm auth:verify`.

Hay seeds locales de facturación: `scripts/seed-billing-clients.ts`, `scripts/seed-billing-rubros.ts`.

---

## 13. Mapa de documentación

| Archivo | Para qué sirve | Vigencia |
|---------|----------------|----------|
| `docs/PRD.md` | Producto catálogos | Contenido de producto válido; **§3 estado de desarrollo desactualizado** (25/06/2026) |
| `docs/PRD-FACTURACION.md` | Producto facturación | Criterio funcional vigente |
| `docs/BACKEND-IMPLEMENTATION.md` | Plan backend catálogos/precios | Fases 1–9 OK; **UI “pendiente” ya no aplica** |
| `docs/ENDPOINTS.md` | Contratos API | Útil como índice; **tabla “Estado de integración UI” obsoleta** |
| `README.md` | Onboarding | Stack y setup OK; **roadmap y “fuera de alcance” (facturación) obsoletos** |
| Este archivo | Recorte de implementación | 2026-09-01 |

---

## 14. Resumen en una frase

El sistema de **catálogos, precios, importación, archivos y usuarios está operativo**; **facturación modo prueba (incluye PDF, recibos, notas y Libro IVA) está armada en el working tree y no commiteada**; **offline PWA, dominio de producción y ARCA siguen pendientes**.
