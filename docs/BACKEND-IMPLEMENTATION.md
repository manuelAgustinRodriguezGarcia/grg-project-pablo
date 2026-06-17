# BACKEND-IMPLEMENTATION — Plan de implementación backend

> Documento derivado de [`PRD.md`](./PRD.md). Describe la implementación del backend por fases, en orden, sin omitir requisitos del producto y alineado con el **estado actual del repositorio**.

---

## Tabla de contenidos

- [1. Estado actual del proyecto](#1-estado-actual-del-proyecto)
- [2. Principios y restricciones técnicas](#2-principios-y-restricciones-técnicas)
- [3. Arquitectura backend](#3-arquitectura-backend)
- [4. Stack tecnológico](#4-stack-tecnológico)
- [5. Modelo conceptual de datos](#5-modelo-conceptual-de-datos)
- [6. Estrategia de almacenamiento](#6-estrategia-de-almacenamiento)
- [7. Servicios principales](#7-servicios-principales)
- [8. Flujo resumido de importación](#8-flujo-resumido-de-importación)
- [9. Fases de implementación](#9-fases-de-implementación)
  - [Fase 1 — Análisis y definición](#fase-1--análisis-y-definición)
  - [Fase 2 — Base del sistema](#fase-2--base-del-sistema)
  - [Fase 3 — Catálogos y secciones](#fase-3--catálogos-y-secciones)
  - [Fase 4 — Importador](#fase-4--importador)
  - [Fase 5 — Imágenes](#fase-5--imágenes)
  - [Fase 6 — Administración manual](#fase-6--administración-manual)
  - [Fase 7 — Búsqueda y filtros](#fase-7--búsqueda-y-filtros)
  - [Fase 8 — Archivos y reimportación](#fase-8--archivos-y-reimportación)
  - [Fase 9 — Offline](#fase-9--offline)
  - [Fase 10 — Pruebas y entrega](#fase-10--pruebas-y-entrega)
- [10. Requerimientos funcionales (mapeo backend)](#10-requerimientos-funcionales-mapeo-backend)
- [11. Requerimientos no funcionales (backend)](#11-requerimientos-no-funcionales-backend)
- [12. Criterios de aceptación](#12-criterios-de-aceptación)
- [13. Fuera de alcance](#13-fuera-de-alcance)
- [14. Condiciones y supuestos](#14-condiciones-y-supuestos)

---

## 1. Estado actual del proyecto

### 1.1 Rama y commits

- Rama activa: `backend`
- Commits recientes:
  - Estructura feature-first creada
  - Instalación de dependencias y stack tecnológico
  - README alineado con el PRD

### 1.2 Lo que ya existe

| Área | Estado | Detalle |
|------|--------|---------|
| Proyecto Next.js | ✅ | Next.js 16.2.9, React 19, TypeScript |
| Estructura de carpetas | ✅ | `src/app`, `src/features`, `src/server`, `src/shared`, `src/ui` con placeholders |
| Prisma | ✅ | Modelos Fase 2 (`User`, `Catalog`, `AuditLog`), migración inicial aplicada |
| Supabase (dependencias) | 🚧 | `@supabase/ssr` y `@supabase/supabase-js` instalados; Storage ✅ (§2.2); Auth ✅ (§2.3) |
| Variables de entorno | 🚧 | `DATABASE_URL`, `DIRECT_URL` y credenciales Supabase en `.env`; opcional `NEXT_PUBLIC_APP_URL` para enlaces de recuperación |
| Base de datos | ✅ | Migración `20260617182823_init_user_catalog_audit_log` en Supabase |
| Autenticación | ✅ | Módulo `src/server/auth/`, middleware, guards, Server Actions (§2.3) |
| Servicios / repositorios | 🚧 | `UserRepository` + `UserService` (§2.4); resto pendiente |
| UI de aplicación | ⏳ | Página inicial por defecto de Next.js |

### 1.3 Archivos backend existentes

```text
prisma/schema.prisma          → User, Catalog, AuditLog + enums
prisma/migrations/            → 20260617182823_init_user_catalog_audit_log
prisma.config.ts              → configuración Prisma 7 con DIRECT_URL
scripts/verify-db-connections.ts → verificación pooled/directa + cliente Supabase
scripts/setup-storage-buckets.ts → creación de buckets privados
scripts/verify-storage.ts       → subida de prueba + URL firmada
scripts/verify-auth.ts          → cliente SSR, modelo User, rutas protegidas
src/server/database/prisma.ts → singleton PrismaClient con PrismaPg adapter
src/server/storage/             → cliente admin, validación MIME/tamaño, URLs firmadas
src/server/auth/                → sesión SSR, AuthService, guards, middleware helpers
src/server/repositories/user.repository.ts → perfil local sincronizado con Supabase Auth
src/server/services/user.service.ts   → CRUD de usuarios (solo ADMIN)
src/features/users/                   → schemas Zod, tipos y Server Actions de usuarios
src/middleware.ts               → protección /admin y /api/admin, refresh de sesión
src/features/auth/              → schemas Zod, Server Actions (login, logout, reset)
src/app/auth/callback/route.ts  → intercambio de código OAuth/recuperación
src/app/admin/layout.tsx        → layout protegido con requireAuthOrRedirect
```

### 1.4 Roadmap general (referencia PRD §45)

| Fase | Estado PRD/README | Enfoque backend |
|------|-------------------|-----------------|
| 1 — Análisis y definición | ✅ Completada | Documentación de dominio, columnas, equivalencias, filtros |
| 2 — Base del sistema | 🚧 En curso | DB ✅, Storage ✅, Auth ✅, Usuarios ✅, directorio |
| 3 — Catálogos y secciones | ⏳ Pendiente | CRUD, columnas dinámicas, registros |
| 4 — Importador | ⏳ Pendiente | Excel, mapeo, publicación segura |
| 5 — Imágenes | ⏳ Pendiente | Extracción, ZIP, asociación, miniaturas |
| 6 — Administración manual | ⏳ Pendiente | CRUD registros, equivalencias |
| 7 — Búsqueda y filtros | ⏳ Pendiente | SearchService, FilterService, índices |
| 8 — Archivos y reimportación | ⏳ Pendiente | Historial, reemplazo, informes |
| 9 — Offline | ⏳ Pendiente | OfflineSyncService, manifiestos |
| 10 — Pruebas y entrega | ⏳ Pendiente | Pruebas con archivos reales, despliegue |

---

## 2. Principios y restricciones técnicas

### 2.1 Principios del producto (impacto backend)

- **Flexibilidad:** No depender de una estructura fija de Excel. Cada catálogo y sección puede tener columnas, filtros, campos buscables e imágenes distintas.
- **Preservación:** Conservar archivo original, nombres de columnas, contenido de celdas, saltos de línea, códigos, fórmulas originales (opcional), valor calculado, imágenes y relación fila/columna de origen.
- **Simplicidad:** Operaciones complejas expuestas mediante asistentes; el backend debe soportar flujos guiados (estados de importación, vistas previas, confirmaciones).
- **Seguridad:** Catálogos privados; solo usuarios autenticados y autorizados.

### 2.2 Restricciones arquitectónicas

- **NestJS no se utilizará** en el MVP ni en futuras fases.
- El backend vive dentro del ecosistema **Next.js** (Route Handlers, Server Actions, Services, Repositories).
- No se creará una tabla física por cada Excel, catálogo o sección.
- No se ejecutarán macros VBA ni fórmulas arbitrarias en el servidor.
- Las rutas locales de Windows no serán dependencia de funcionamiento.

### 2.3 Modelo de dominio (tres niveles)

```text
Catálogo
└── Sección (generalmente una hoja de Excel)
    └── Registro (fila de datos: producto, repuesto, equivalencia, etc.)
```

Ejemplos de catálogos: Rulemanes, Catálogo Azul, Embragues.

---

## 3. Arquitectura backend

```text
src/
├── app/
│   ├── (public)/          # Landing (sin lógica de catálogos)
│   ├── auth/              # Rutas de autenticación
│   └── admin/             # Panel privado (protegido)
│
├── features/              # Schemas Zod, actions, tipos por dominio
│   ├── auth/
│   ├── directory/
│   ├── catalogs/
│   ├── sections/
│   ├── records/
│   ├── imports/
│   ├── uploaded-files/
│   ├── product-images/
│   ├── image-review/
│   ├── search/
│   ├── global-search/
│   ├── filters/
│   ├── users/
│   └── offline/
│
└── server/
    ├── services/          # Lógica de negocio
    ├── repositories/      # Acceso a datos (Prisma)
    ├── validators/        # Validación de entrada
    ├── importers/         # Procesamiento Excel
    ├── image-processors/  # Extracción, miniaturas, optimización
    ├── search/            # Normalización, índices, consultas
    ├── storage/           # Supabase Storage (privado)
    ├── auth/              # Sesión, permisos, middleware helpers
    └── database/          # Cliente Prisma
```

### 3.1 Capas y responsabilidades

| Capa | Responsabilidad |
|------|-----------------|
| **Route Handlers** (`app/api/...`) | Endpoints REST para uploads grandes, descargas, webhooks, tareas largas |
| **Server Actions** | Mutaciones desde formularios del panel admin |
| **Services** | Reglas de negocio, orquestación, transacciones |
| **Repositories** | Queries Prisma, abstracción de persistencia |
| **Validators** | Zod schemas compartidos server-side |
| **Importers / Image processors** | Procesamiento pesado de Excel e imágenes |
| **Storage** | Subida, descarga y URLs firmadas en Supabase Storage |

---

## 4. Stack tecnológico

| Componente | Tecnología |
|------------|------------|
| Runtime backend | Next.js 16 (Route Handlers + Server Actions) |
| Lenguaje | TypeScript |
| Base de datos | PostgreSQL (Supabase) |
| ORM | Prisma 7 + `@prisma/adapter-pg` + `pg` |
| Datos flexibles | JSONB en PostgreSQL |
| Auth | Supabase Auth (correo/contraseña) |
| Almacenamiento archivos | Supabase Storage privado |
| Excel | ExcelJS (herramienta principal) |
| Imágenes | Librerías Node.js compatibles (extracción, validación, miniaturas, optimización, metadatos) |
| Validación | Zod |
| Tareas en segundo plano | Cuando sea necesario (importaciones extensas) |

### 4.1 Uso de Supabase Storage

Almacenar de forma privada:

- Archivos Excel originales (`.xlsx`, `.xlsm`)
- Imágenes de productos
- Miniaturas
- Archivos temporales de importación
- ZIP de imágenes externas

---

## 5. Modelo conceptual de datos

> Entidades del PRD §39. Deben materializarse en `prisma/schema.prisma` de forma progresiva por fase.

### 5.1 User

| Campo | Descripción |
|-------|-------------|
| ID | Identificador |
| Nombre | Nombre del usuario |
| Correo | Email (único) |
| Rol | `ADMIN` \| `CONSULTA` |
| Estado | Activo / desactivado |
| Último acceso | Timestamp |

**Permisos por rol (PRD §7):**

- **Visitante:** Sin acceso a backend de catálogos (solo landing pública).
- **Administrador:** CRUD completo, importación, configuración, usuarios, archivos, imágenes.
- **Usuario de consulta:** Lectura de directorio, catálogos, búsquedas, filtros, imágenes, offline sincronizado. Sin modificaciones.

### 5.2 Catalog

| Campo | Descripción |
|-------|-------------|
| ID | Identificador |
| Nombre | Nombre del catálogo |
| Descripción | Texto opcional |
| Imagen representativa | URL/ruta en Storage |
| Estado | Activo / inactivo / oculto |
| Orden | Orden en el directorio |
| Fecha de actualización | Última modificación de datos |

### 5.3 CatalogSection

| Campo | Descripción |
|-------|-------------|
| ID | Identificador |
| Catálogo | FK a Catalog |
| Nombre | Nombre de la sección |
| Descripción | Texto opcional |
| Estado | Activa / inactiva |
| Orden | Orden dentro del catálogo |
| Configuración de búsqueda | Qué columnas participan |
| Configuración de filtros | Columnas filtrables |

### 5.4 SectionColumn

| Campo | Descripción |
|-------|-------------|
| ID | Identificador |
| Sección | FK a CatalogSection |
| Nombre original | Encabezado del Excel |
| Nombre visible | Etiqueta en UI |
| Clave interna | Slug/key estable |
| Tipo | Tipo de dato |
| Orden | Posición en tabla |
| Visible | Mostrar en tabla |
| Buscable | Participa en búsqueda de sección |
| Filtrable | Participa en filtros de sección |
| Campo global relacionado | FK opcional a GlobalFieldMapping |

**Configuraciones adicionales por columna (PRD §33):**

- Oculta, editable, buscable globalmente, filtrable globalmente
- Código principal, equivalencia, descripción, código de imagen
- Obligatoria, solo lectura
- Ancho, formato, unidad, etiqueta

### 5.5 CatalogRecord

| Campo | Descripción |
|-------|-------------|
| ID | Identificador |
| Sección | FK a CatalogSection |
| Código principal | Opcional |
| Código normalizado | Para búsqueda |
| Descripción | Texto principal |
| Datos dinámicos | JSONB — columnas no estandarizadas |
| Texto original | Contenido crudo preservado |
| Texto indexado | Texto concatenado para búsqueda full-text |
| Fecha de creación | `createdAt` |
| Fecha de modificación | `updatedAt` |

### 5.6 EquivalentCode

| Campo | Descripción |
|-------|-------------|
| ID | Identificador |
| Registro | FK a CatalogRecord |
| Código original | Texto tal como fue importado/ingresado |
| Código normalizado | Para búsqueda |
| Tipo | Opcional (fabricante, alternativo, etc.) |

**Reglas de equivalencias (PRD §26):**

- Un registro puede tener cero, una o múltiples equivalencias.
- Celdas con múltiples códigos separados por saltos de línea, `=`, guiones, barras, espacios, paréntesis o texto descriptivo deben conservar el original y generar valores normalizados en paralelo.
- La separación automática debe poder revisarse cuando el formato sea ambiguo.

### 5.7 ProductImage

| Campo | Descripción |
|-------|-------------|
| ID | Identificador |
| Registro | FK opcional a CatalogRecord |
| Ruta | Path en Storage |
| Nombre original | Nombre del archivo |
| Tipo MIME | Validado |
| Tamaño | Bytes |
| Orden | Orden en galería |
| Imagen principal | Boolean |
| Etiqueta | Función de la imagen (principal, componentes, reparación, aplicación) |
| Hoja de origen | Trazabilidad Excel |
| Fila de origen | Trazabilidad Excel |
| Columna de origen | Trazabilidad Excel |
| Estado de asociación | Ver §5.7.1 |
| Origen | Embebida, ZIP, manual, etc. |

#### 5.7.1 Estados de asociación de imagen

- Asociada automáticamente
- Asociada manualmente
- Pendiente de revisión
- Archivo no encontrado
- Asociación ambigua
- Nombre duplicado
- Formato rechazado
- Eliminada

### 5.8 UploadedFile

| Campo | Descripción |
|-------|-------------|
| ID | Identificador |
| Nombre original | Nombre del archivo subido |
| Ruta | Path en Storage |
| Tipo | MIME / extensión |
| Tamaño | Bytes |
| Usuario | FK a User |
| Fecha | Timestamp de carga |
| Estado | Procesado, pendiente, error, etc. |

### 5.9 ImportJob

| Campo | Descripción |
|-------|-------------|
| ID | Identificador |
| Archivo | FK a UploadedFile |
| Catálogo | FK opcional a Catalog |
| Estado | Ver §8.1 |
| Configuración | JSON — mapeo, hojas, reglas de imagen |
| Resultados | JSON — informe de importación |
| Fecha de inicio | Inicio del procesamiento |
| Fecha de finalización | Fin del procesamiento |

### 5.10 ImportSheet

| Campo | Descripción |
|-------|-------------|
| ID | Identificador |
| Importación | FK a ImportJob |
| Nombre de hoja | Nombre en Excel |
| Sección de destino | FK opcional a CatalogSection |
| Fila de encabezado | Número de fila detectada/configurada |
| Estado | Importable, índice, auxiliar, ignorada, etc. |
| Cantidad de registros | Contador post-proceso |

### 5.11 GlobalFieldMapping

| Campo | Descripción |
|-------|-------------|
| ID | Identificador |
| Columna | FK a SectionColumn |
| Campo global | Nombre del campo compartido (ej. `marca`, `fabricante`) |
| Configuración | JSON adicional |

> El mapeo a campos globales **no debe realizarse automáticamente sin confirmación** del administrador.

### 5.12 OfflineSyncManifest

| Campo | Descripción |
|-------|-------------|
| Usuario | FK a User |
| Dispositivo | Identificador del dispositivo |
| Catálogos sincronizados | Lista/relación |
| Versión | Versión de datos sincronizados |
| Fecha de sincronización | Timestamp |

### 5.13 AuditLog

| Campo | Descripción |
|-------|-------------|
| Usuario | FK a User |
| Acción | Tipo de operación |
| Entidad | Tipo de entidad afectada |
| Identificador | ID de la entidad |
| Fecha | Timestamp |

---

## 6. Estrategia de almacenamiento

### 6.1 PostgreSQL (relacional + JSONB)

- Estructura relacional para: catálogos, secciones, usuarios, archivos, imágenes, importaciones.
- Columnas específicas para campos importantes: código principal, código normalizado, descripción.
- **JSONB** para datos variables por sección (`CatalogRecord.datosDinamicos`).
- **Índices** para búsquedas (códigos normalizados, texto indexado, GIN sobre JSONB cuando aplique).

### 6.2 Beneficios

- Agregar nuevos archivos sin migraciones de schema.
- Conservar estructuras diferentes entre secciones.
- Mantener un buscador global unificado.
- Incorporar nuevos catálogos sin modificar código.
- Simplificar el modo offline (exportar estructura + datos).

### 6.3 Ejemplo de coexistencia de estructuras

```text
Sección A: Código | Descripción | Marca | Aplicación
Sección B: Número | Diámetro | Medida | Modelo | Imagen
Sección C: Referencia | Equivalencias | Fabricante
```

Las tres estructuras coexisten en las mismas tablas (`CatalogRecord` + JSONB).

---

## 7. Servicios principales

| Servicio | Responsabilidades |
|----------|-------------------|
| **CatalogImportService** | Analizar archivos, detectar hojas, procesar filas, generar importaciones preliminares, publicar resultados |
| **ExcelStructureService** | Detectar encabezados, columnas, celdas combinadas, fórmulas, hojas auxiliares |
| **ImageExtractionService** | Extraer imágenes embebidas, detectar fila/columna de origen, generar miniaturas, registrar pendientes |
| **ImageMatchingService** | Asociar por código, por nombre, detectar duplicados, registrar coincidencias ambiguas |
| **SearchService** | Normalizar consultas, buscar por sección/catálogo/global, ordenar resultados |
| **FilterService** | Aplicar filtros particulares y globales, gestionar campos compartidos |
| **OfflineSyncService** | Preparar datos sincronizables, gestionar versiones, sincronizar miniaturas |

### 7.1 Servicios adicionales por fase

| Servicio | Fase |
|----------|------|
| `AuthService` | 2 |
| `UserService` | 2 |
| `DirectoryService` | 2 |
| `CatalogService` | 3 |
| `SectionService` | 3 |
| `ColumnConfigService` | 3 |
| `RecordService` | 3, 6 |
| `UploadedFileService` | 4, 8 |
| `EquivalenceService` | 6, 7 |
| `AuditService` | 2+ (progresivo) |

---

## 8. Flujo resumido de importación

```text
Administrador
      │
      ▼
Sube Excel y, si corresponde, ZIP de imágenes
      │
      ▼
Se almacenan los archivos originales
      │
      ▼
Se detectan hojas, columnas, fórmulas e imágenes
      │
      ▼
Se seleccionan las hojas
      │
      ▼
Se configuran secciones y columnas
      │
      ▼
Se configuran reglas de imágenes
      │
      ▼
Se muestra una vista previa
      │
      ▼
Se procesa una versión preliminar
      │
      ▼
Se revisan errores y asociaciones
      │
      ▼
El administrador confirma
      │
      ▼
Se publica la nueva versión
      │
      ▼
El directorio se actualiza automáticamente
```

### 8.1 Estados de ImportJob (publicación segura — PRD §18)

| Estado | Descripción |
|--------|-------------|
| `STORED` | Archivo almacenado |
| `ANALYZING` | Analizando estructura |
| `PENDING_CONFIG` | Pendiente de configuración por el admin |
| `PROCESSING` | Procesando datos preliminares |
| `PENDING_REVIEW` | Pendiente de revisión |
| `READY_TO_PUBLISH` | Listo para publicar |
| `PUBLISHED` | Publicado — datos activos |
| `FAILED` | Fallido — no afecta datos vigentes |
| `CANCELLED` | Cancelado |

> Los registros nuevos **no reemplazan la versión activa** hasta confirmación explícita del administrador.

### 8.2 Estrategias de reimportación (PRD §17)

| Estrategia | Comportamiento |
|------------|----------------|
| **Crear nuevo** | Genera un catálogo independiente |
| **Reemplazar sección** | Sustituye todos los registros de una sección seleccionada |
| **Reemplazar catálogo** | Sustituye todas las secciones seleccionadas del catálogo |

Antes de reemplazar:

- Mostrar vista previa
- Informar qué se reemplazará
- Solicitar confirmación
- Conservar el archivo anterior
- Evitar que una importación fallida elimine la versión vigente

> La actualización individual por coincidencia de códigos queda para evaluación posterior.

### 8.3 Informe de importación (PRD §19)

Al finalizar, persistir y exponer:

- Hojas detectadas e importadas
- Registros procesados, creados y omitidos
- Fórmulas detectadas
- Imágenes detectadas, asociadas, pendientes y rechazadas
- Columnas detectadas
- Errores y advertencias (lenguaje comprensible)

---

## 9. Fases de implementación

---

### Fase 1 — Análisis y definición

**Estado:** ✅ Completada (documentación de producto)

#### Objetivo backend

Documentar y validar con Pablo el significado de columnas, equivalencias, filtros e imágenes externas antes de modelar datos definitivos.

#### Entregables de análisis (PRD §45)

- [x] Reunión con Pablo
- [x] Revisión de cada archivo (Rulemanes, Catálogo Azul, Embragues)
- [x] Definición de significado de columnas
- [x] Definición de equivalencias
- [x] Definición de filtros
- [x] Validación de imágenes externas
- [x] Identificación de hojas auxiliares

#### Hallazgos técnicos relevantes para backend

| Archivo | Implicación backend |
|---------|---------------------|
| **Rulemanes** | 3 hojas, imágenes embebidas, sin carpeta externa |
| **Catálogo Azul** | ~35 hojas, imágenes embebidas, hoja índice → directorio automático (no tabla) |
| **Embragues** | `.xlsm`, imágenes externas por código/nombre, macros VBA → solo análisis, no ejecución |

#### Salida hacia Fase 2

- Modelo conceptual validado (§5 de este documento)
- Decisiones de campos globales pendientes de confirmación con Pablo (filtros globales)

---

### Fase 2 — Base del sistema

**Estado:** 🚧 En curso

**Depende de:** Fase 1

#### Objetivo backend

Establecer la infraestructura: base de datos, storage, autenticación, usuarios y API del directorio privado.

#### 2.1 Base de datos ✅

**Estado:** Completada (2026-06-17)

| Entregable | Resultado |
|------------|-----------|
| Modelos iniciales | `User`, `Catalog`, `AuditLog` en `prisma/schema.prisma` |
| Timestamps | `createdAt` / `updatedAt` en los tres modelos |
| Índices | `Catalog.status`, `Catalog.order`; además `User.status`, `AuditLog` (userId, entityType+entityId, createdAt) |
| Migración | `20260617182823_init_user_catalog_audit_log` (`pnpm db:migrate`) |
| Conexiones | Verificadas con `pnpm db:verify` (pooled + directa) |

**Decisiones de modelado (Fase 2):**

- `User.id` es UUID y coincide con `auth.users.id` de Supabase (sincronización en §2.3).
- Enums: `UserRole` (`ADMIN` \| `CONSULTA`), `UserStatus` (`ACTIVE` \| `INACTIVE`), `CatalogStatus` (`ACTIVE` \| `INACTIVE` \| `HIDDEN`).
- `Catalog.coverImagePath` prepara la imagen representativa en Storage (§2.2).
- `AuditLog.userId` opcional (`ON DELETE SET NULL`) para eventos sin usuario autenticado.

**Scripts útiles:** `pnpm db:migrate` · `pnpm db:generate` · `pnpm db:verify` · `pnpm db:studio`

#### 2.2 Supabase Storage ✅

**Estado:** Completada (2026-06-17)

| Entregable | Resultado |
|------------|-----------|
| Buckets privados | `excel-originals`, `product-images`, `temp-imports` (creados con `pnpm storage:setup`) |
| Módulo `src/server/storage/` | Subida con validación MIME/tamaño, sanitización de nombres, URLs firmadas, eliminación |
| Variables de entorno | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` en `.env` |
| Verificación | `pnpm storage:verify` — buckets, subida de prueba, descarga con URL firmada y limpieza |

**Límites de validación (aplicación):**

| Bucket | MIME permitidos | Tamaño máx. |
|--------|-----------------|-------------|
| `excel-originals` | `.xlsx`, `.xlsm` | 50 MB |
| `product-images` | `.jpg`, `.jpeg`, `.png`, `.webp` | 10 MB |
| `temp-imports` | Excel, ZIP e imágenes (importación temporal) | 50 MB |

**Scripts útiles:** `pnpm storage:setup` · `pnpm storage:verify`

**API principal (`src/server/storage/`):**

- `uploadFile()` — subida validada (servidor, service role)
- `createSignedDownloadUrl()` — descarga autorizada con URL firmada
- `sanitizeFilename()` / `buildStoragePath()` — nombres seguros sin path traversal
- `getSupabaseAdminClient()` — cliente solo servidor (nunca exponer service role al cliente)

#### 2.3 Autenticación (PRD §9, RF-001, RF-002) ✅

**Estado:** Completada (2026-06-17)

| Entregable | Resultado |
|------------|-----------|
| Módulo `src/server/auth/` | Clientes SSR (`createSupabaseServerClient`, `updateSession`), `AuthService`, guards y errores tipados |
| Inicio / cierre de sesión | `signInWithPassword`, `signOut` vía Server Actions (`src/features/auth/actions/`) |
| Recuperación de contraseña | `requestPasswordReset` + `updatePassword`; callback en `/auth/callback` |
| Persistencia de sesión | Cookies gestionadas con `@supabase/ssr`; refresh en `src/middleware.ts` |
| Middleware | Rutas `/admin` y `/api/admin` protegidas; redirección a `/auth/login` o 401 |
| Guards | `requireAuth()`, `requireRole('ADMIN')`, variantes con `redirect` para layouts |
| Perfil local | `UserRepository.upsertFromAuth()` sincroniza `User` con `auth.users.id` |
| Desactivación | `UserService.deactivateUser()` invalida sesiones Supabase + bloqueo en login y `requireAuth` si `status = INACTIVE` |
| Logout offline | `signOut` devuelve señal `grg:offline:clear` (coordinación Fase 9) |

**Rutas y convenciones:**

| Tipo | Rutas |
|------|-------|
| Públicas (auth) | `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/callback` |
| Protegidas | `/admin/*`, `/api/admin/*` |
| API de sesión | `GET /api/admin/session` — perfil del usuario autenticado |

**Variables de entorno:**

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente SSR (servidor y middleware) |
| `NEXT_PUBLIC_APP_URL` | Origen para enlaces de recuperación (opcional; fallback `VERCEL_URL` o `localhost:3000`) |

**Scripts útiles:** `pnpm auth:verify`

**API principal (`src/server/auth/`):**

- `authService.signInWithPassword()` / `signOut()` / `requestPasswordReset()` / `updatePassword()`
- `requireAuth()` / `requireRole()` — uso en Server Actions, Route Handlers y layouts
- `createSupabaseServerClient()` — cliente por petición con cookies
- `updateSession()` — refresh de tokens en middleware (Edge-safe, sin Prisma)
- `userRepository` — sincronización y `lastAccessAt` del perfil local

**Flujo de sincronización:**

```text
Supabase Auth (signIn / getUser)
      │
      ▼
UserRepository.findById(auth.users.id)
      │
      ├── No existe → upsert (email, name, rol CONSULTA por defecto)
      ├── INACTIVE → signOut + error USER_INACTIVE
      └── ACTIVE → touchLastAccess + sesión válida
```

**Coordinación Fase 9 (offline):** al cerrar sesión, `signOutAction` retorna `{ clearOfflineData: true, signal: 'grg:offline:clear' }` para que el cliente elimine IndexedDB cuando exista `OfflineSyncService`.

#### 2.4 Usuarios (RF-002) ✅

**Estado:** Completada (2026-06-17)

| Entregable | Resultado |
|------------|-----------|
| `UserRepository` | Listado, actualización de perfil y estado (extiende sincronización auth de §2.3) |
| `UserService` | CRUD de usuarios restringido a rol `ADMIN` |
| Crear usuario | Supabase Auth (`admin.createUser`) + perfil local con rol |
| Editar usuario | Nombre y rol en Prisma + `user_metadata` en Supabase |
| Activar / desactivar | `UserStatus` local; desactivación con `admin.signOut` global |
| Validación | Schemas Zod en `src/features/users/schemas/user.schemas.ts` |
| Server Actions | `listUsersAction`, `createUserAction`, `updateUserAction`, `activateUserAction`, `deactivateUserAction` |

**API principal (`src/server/services/user.service.ts`):**

- `listUsers()` — listar todos los usuarios (solo ADMIN)
- `createUser({ email, password, name, role })` — alta en Supabase + tabla `User`
- `updateUser({ id, name?, role? })` — edición de nombre y/o rol
- `activateUser(userId)` / `deactivateUser(userId)` — cambio de estado; desactivación cierra sesiones activas

**Server Actions (`src/features/users/actions/user.actions.ts`):**

- Todas exigen `requireRole('ADMIN')` vía el servicio
- Respuesta tipada `UserActionResult<T>` con códigos de error (`EMAIL_ALREADY_EXISTS`, `USER_NOT_FOUND`, `CANNOT_DEACTIVATE_SELF`, etc.)
- Un administrador no puede desactivar su propia cuenta

**Flujo de alta de usuario:**

```text
ADMIN → createUserAction
      │
      ▼
UserService.createUser (requireRole ADMIN)
      │
      ├── Email duplicado → error EMAIL_ALREADY_EXISTS
      ▼
Supabase Auth admin.createUser (email_confirm: true)
      │
      ▼
UserRepository.upsertFromAuth (rol, nombre, ACTIVE)
```

**Flujo de desactivación:**

```text
ADMIN → deactivateUserAction
      │
      ▼
UserRepository.setStatus(INACTIVE)
      │
      ▼
Supabase Auth admin.signOut(userId, 'global')
      │
      └── Próximo login / requireAuth → USER_INACTIVE
```

- [x] `UserService` + `UserRepository`
- [x] CRUD de usuarios (solo ADMIN):
  - Crear usuario con rol
  - Editar nombre y rol
  - Activar / desactivar
  - Listar usuarios
- [x] Validadores Zod en `src/features/users/schemas/`
- [x] Server Actions en `src/features/users/actions/`

#### 2.5 Directorio (PRD §10, RF-004)

- [ ] `DirectoryService` — listar catálogos activos ordenados
- [ ] Endpoint / action: obtener directorio con metadatos:
  - Nombre, descripción, imagen, cantidad de secciones, fecha de última actualización, estado offline (placeholder hasta Fase 9)
- [ ] El directorio se genera automáticamente; no requiere hoja índice manual

#### 2.6 Auditoría (RNF §38.2)

- [ ] `AuditService` — registrar operaciones importantes:
  - Login / logout
  - Creación/edición/eliminación de catálogos (cuando existan)
  - Subidas de archivos
  - Publicaciones de importación

#### 2.7 Requerimientos funcionales cubiertos

| ID | Requerimiento |
|----|---------------|
| RF-001 | Autenticación |
| RF-002 | Roles |
| RF-003 | Landing pública (backend: rutas públicas sin datos de catálogos) |
| RF-004 | Directorio automático |

#### 2.8 Criterio de completitud

- Usuario ADMIN y CONSULTA pueden autenticarse (Supabase Auth + perfil `User`)
- Rutas `/admin` bloqueadas sin sesión (middleware + layout)
- APIs `/api/admin/*` responden 401 sin sesión
- Directorio responde con catálogos activos (aunque esté vacío inicialmente) — pendiente §2.5
- Storage privado operativo con subida de prueba (`pnpm storage:verify`)
- Auth verificable con `pnpm auth:verify`
- Migración inicial aplicada en Supabase

---

### Fase 3 — Catálogos y secciones

**Estado:** ⏳ Pendiente

**Depende de:** Fase 2

#### Objetivo backend

CRUD completo de catálogos, secciones, configuración de columnas y lectura de registros con tablas dinámicas.

#### 3.1 Modelos Prisma adicionales

- [ ] `CatalogSection`
- [ ] `SectionColumn`
- [ ] `CatalogRecord` (estructura base con JSONB)
- [ ] Relaciones y índices

#### 3.2 Gestión de catálogos (PRD §12.1, RF-005)

- [ ] `CatalogService` + `CatalogRepository`
- [ ] Operaciones ADMIN:
  - Crear catálogo
  - Editar información (nombre, descripción, imagen representativa, color/identificador visual)
  - Activar / desactivar / ocultar
  - Cambiar orden
  - Eliminar catálogo (sin eliminar archivos originales asociados — PRD §34)
  - Asociar con archivos subidos (preparación Fase 4)

#### 3.3 Gestión de secciones (PRD §12.2, RF-006)

- [ ] `SectionService` + `SectionRepository`
- [ ] Operaciones ADMIN:
  - Crear sección manualmente
  - Renombrar, cambiar orden
  - Activar / desactivar
  - Eliminar sección
  - Configurar columnas, buscador y filtros (estructura; lógica de filtros en Fase 7)

#### 3.4 Hojas auxiliares (PRD §12.3)

- [ ] Soporte de clasificación de hoja:
  - Sección importable
  - Hoja índice
  - Hoja auxiliar
  - Hoja ignorada
- [ ] Las hojas índice de Excel no se convierten obligatoriamente en tablas

#### 3.5 Configuración de columnas (PRD §33)

- [ ] `ColumnConfigService`
- [ ] Por columna: visible, oculta, editable, buscable, buscable globalmente, filtrable, filtrable globalmente, código principal, equivalencia, descripción, código de imagen, obligatoria, solo lectura
- [ ] Metadatos: nombre visible, orden, tipo, ancho, formato, unidad, etiqueta

#### 3.6 Registros y tablas dinámicas

- [ ] `RecordService` + `RecordRepository` (lectura paginada)
- [ ] Listar registros de una sección con paginación (RNF §38.1)
- [ ] Devolver columnas configuradas + `datosDinamicos` JSONB
- [ ] Detalle de registro individual

#### 3.7 Navegación de catálogos (PRD §11)

- [ ] API: metadatos de catálogo (nombre, descripción, fecha actualización, lista de secciones)
- [ ] Buscador de catálogo (estructura; implementación en Fase 7)

#### 3.8 Requerimientos funcionales cubiertos

| ID | Requerimiento |
|----|---------------|
| RF-005 | Gestión de catálogos |
| RF-006 | Gestión de secciones |
| RF-013 | Campos dinámicos (estructura JSONB) |

#### 3.9 Criterio de completitud

- ADMIN puede crear catálogos y secciones manualmente con columnas configurables
- CONSULTA puede listar catálogos, secciones y registros paginados
- Nuevo catálogo aparece automáticamente en el directorio sin cambios de código

---

### Fase 4 — Importador

**Estado:** ⏳ Pendiente

**Depende de:** Fase 3

#### Objetivo backend

Pipeline completo de importación Excel con análisis, mapeo, vista previa, procesamiento preliminar y publicación segura.

#### 4.1 Modelos Prisma adicionales

- [ ] `UploadedFile`
- [ ] `ImportJob`
- [ ] `ImportSheet`

#### 4.2 Formatos y validación (PRD §14.1, RF-007, RF-015)

- [ ] Admitir `.xlsx` y `.xlsm`
- [ ] Validar formato y tamaño antes de procesar
- [ ] No ejecutar macros ni código VBA
- [ ] No depender de rutas locales
- [ ] Soporte `.xls` antiguo: sujeto a validación técnica (evaluar en implementación)

#### 4.3 Flujo de importación (PRD §14.2)

1. [ ] Admin selecciona archivo
2. [ ] Validar formato y tamaño
3. [ ] **Almacenar original como respaldo** (RF-008) antes de procesar
4. [ ] Analizar hojas, columnas, filas, fórmulas e imágenes
5. [ ] Exponer vista previa
6. [ ] Admin selecciona hojas a importar
7. [ ] Relacionar cada hoja con sección (nueva o existente)
8. [ ] Configurar columnas especiales
9. [ ] Configurar reglas de imágenes (estructura; procesamiento Fase 5)
10. [ ] Validar importación
11. [ ] Procesar en estado preliminar
12. [ ] Mostrar resumen
13. [ ] Admin confirma publicación
14. [ ] Datos disponibles para usuarios

#### 4.4 Selección de hojas (PRD §14.3, RF-010)

- [ ] Importar: una hoja, varias hojas o todas las válidas
- [ ] Por hoja: crear sección nueva, reemplazar existente, ignorar, marcar como índice/auxiliar

#### 4.5 Detección de encabezados (PRD §14.4, RF-011)

- [ ] `ExcelStructureService`:
  - Detectar fila de encabezados
  - Columnas vacías, encabezados duplicados, celdas combinadas
  - Filas decorativas, títulos previos a la tabla, columnas sin nombre
- [ ] Permitir selección manual cuando la detección no sea segura

#### 4.6 Mapeo de columnas (PRD §14.5, RF-012)

- [ ] Mapear a: código principal, código alternativo, equivalencias, descripción, marca, categoría, modelo, aplicación, fabricante, código de imagen, observaciones, otro campo global
- [ ] Columnas no mapeadas → campos dinámicos en JSONB (RF-013)

#### 4.7 Fórmulas (PRD §15, RF-014)

- [ ] Leer valor calculado disponible en la celda
- [ ] Conservar opcionalmente fórmula original
- [ ] **No ejecutar fórmulas arbitrarias en el servidor**
- [ ] Advertir cuando no haya valor calculado guardado
- [ ] Permitir corrección manual post-importación (Fase 6)

#### 4.8 Macros VBA (PRD §16, RF-015)

- [ ] No ejecutar ni trasladar macros
- [ ] Opcional: analizar macros para inferir relaciones datos↔imágenes (Embragues)
- [ ] Comportamiento web: consulta de imagen asociada al abrir/seleccionar registro

#### 4.9 Publicación segura (PRD §18, RF-031)

- [ ] `CatalogImportService` con máquina de estados (§8.1)
- [ ] Datos preliminares en tablas staging o flag `isPublished`
- [ ] Transacción atómica al publicar
- [ ] Importación fallida no afecta datos vigentes

#### 4.10 Servicios e implementación

- [ ] `src/server/importers/` — ExcelJS como herramienta principal
- [ ] `UploadedFileService`
- [ ] Route Handler para upload multipart (archivos grandes)
- [ ] Progreso de importaciones extensas (RNF §38.1)
- [ ] Informe de importación persistido (§8.3)

#### 4.11 Requerimientos funcionales cubiertos

| ID | Requerimiento |
|----|---------------|
| RF-007 | Subida de Excel |
| RF-008 | Respaldo del original |
| RF-009 | Análisis de hojas |
| RF-010 | Selección de hojas |
| RF-011 | Detección de columnas |
| RF-012 | Mapeo |
| RF-013 | Campos dinámicos |
| RF-014 | Fórmulas (valor calculado) |
| RF-015 | Sin macros |
| RF-031 | Publicación segura |

#### 4.12 Criterio de completitud

- Importar Rulemanes o Catálogo Azul de muestra con publicación segura
- Archivo original respaldado y descargable
- Hojas convertidas en secciones con columnas dinámicas
- Importación fallida no destruye datos activos

---

### Fase 5 — Imágenes

**Estado:** ⏳ Pendiente

**Depende de:** Fase 4

#### Objetivo backend

Extracción, almacenamiento, asociación y revisión de imágenes embebidas y externas.

#### 5.1 Modelo Prisma

- [ ] `ProductImage` con todos los campos y estados (§5.7)

#### 5.2 Tipos de imágenes (PRD §20)

1. Imágenes embebidas en Excel
2. Imágenes externas asociadas por código
3. Imágenes externas asociadas por nombre de archivo
4. Imágenes cargadas manualmente
5. Varias imágenes en una misma fila

> Un registro puede tener cero, una o varias imágenes. La ausencia no impide la importación.

#### 5.3 Imágenes embebidas (PRD §21, RF-016)

- [ ] `ImageExtractionService`:
  - Extraer durante importación
  - Registrar hoja, fila y columna de anclaje
  - Usar encabezado de columna para identificar función (principal, componentes, reparación, aplicación)
  - Si asociación no es segura → estado pendiente de revisión

#### 5.4 Imágenes externas (PRD §22, RF-017)

- [ ] Subida de ZIP de imágenes y/o selección manual
- [ ] `ImageMatchingService` — asociar por:
  - Código de imagen
  - Código del producto
  - Nombre de archivo / sin extensión
  - Columna configurada
  - Regla definida en importación
- [ ] No almacenar rutas locales de Windows como dependencia

#### 5.5 Formatos y validación (PRD §23)

- [ ] Formatos: `.jpg`, `.jpeg`, `.png`, `.webp`
- [ ] Validar: extensión, MIME, tamaño, integridad, nombre, duplicados
- [ ] Imagen dañada → error parcial, no cancela importación completa

#### 5.6 Procesamiento (PRD §25, RNF §38.1)

- [ ] `src/server/image-processors/`:
  - Generar miniaturas optimizadas
  - Optimizar archivos
  - Leer metadatos
- [ ] URLs firmadas para miniatura y vista ampliada
- [ ] No servir imágenes completas en listados de tabla

#### 5.7 Revisión de imágenes (PRD §24, RF-019)

- [ ] Panel backend para:
  - Listar no asociadas, ambiguas, rechazadas
  - Asociar manualmente a registro
  - Reemplazar asociación
  - Eliminar imagen
  - Marcar principal, cambiar orden y etiqueta

#### 5.8 Requerimientos funcionales cubiertos

| ID | Requerimiento |
|----|---------------|
| RF-016 | Imágenes embebidas |
| RF-017 | Imágenes externas |
| RF-018 | Imágenes múltiples |
| RF-019 | Revisión de imágenes |

#### 5.9 Criterio de completitud

- Imágenes de Rulemanes y Catálogo Azul extraídas y visibles
- Imágenes de Embragues asociadas por código sin rutas locales
- Imágenes ambiguas quedan pendientes de revisión
- Miniaturas generadas y servidas desde Storage privado

---

### Fase 6 — Administración manual

**Estado:** ⏳ Pendiente

**Depende de:** Fase 3, Fase 5

#### Objetivo backend

CRUD manual de registros, equivalencias e imágenes desde el panel admin.

#### 6.1 Gestión de registros (PRD §13, RF-020)

- [ ] Crear registro
- [ ] Editar registro (campos dinámicos según configuración de columnas)
- [ ] Eliminar registro
- [ ] Duplicar registro
- [ ] Formularios generados según `SectionColumn` de la sección

#### 6.2 Equivalencias (PRD §26, RF-021)

- [ ] `EquivalenceService`
- [ ] Agregar / eliminar equivalencias
- [ ] Parseo de celdas multi-código con valores normalizados en paralelo
- [ ] Revisión manual cuando el formato sea ambiguo

#### 6.3 Imágenes manuales

- [ ] Agregar imagen a registro
- [ ] Reemplazar imagen
- [ ] Marcar principal, orden, etiqueta

#### 6.4 Metadatos

- [ ] Exponer `createdAt` y `updatedAt` en detalle de registro
- [ ] Registrar en `AuditLog`

#### 6.5 Requerimientos funcionales cubiertos

| ID | Requerimiento |
|----|---------------|
| RF-020 | Gestión manual |
| RF-021 | Equivalencias |

#### 6.6 Criterio de completitud

- ADMIN puede corregir datos e imágenes post-importación
- Equivalencias múltiples funcionan con normalización

---

### Fase 7 — Búsqueda y filtros

**Estado:** ⏳ Pendiente

**Depende de:** Fase 3, Fase 6

#### Objetivo backend

Motor de búsqueda normalizado y sistema de filtros por sección y globales.

#### 7.1 Normalización (PRD §27, RF-022)

- [ ] `src/server/search/normalize.ts`
- [ ] Ignorar: mayúsculas/minúsculas, espacios, guiones, guiones bajos, puntos, barras, separadores configurados
- [ ] Aplicar a códigos almacenados y a consultas entrantes

#### 7.2 Búsqueda por sección (PRD §28, RF-023)

- [ ] `SearchService.searchBySection(sectionId, query, options)`
- [ ] Buscar en: código principal, equivalencias, descripción, marca, categoría, modelo, aplicación, columnas configuradas como buscables
- [ ] Configuración por sección de qué columnas participan

#### 7.3 Búsqueda por catálogo (PRD §29, RF-024)

- [ ] `SearchService.searchByCatalog(catalogId, query)`
- [ ] Recorrer todas las secciones del catálogo
- [ ] Cada resultado indica sección de origen (RF-026)

#### 7.4 Búsqueda global (PRD §30, RF-025, RF-026)

- [ ] `SearchService.searchGlobal(query, filters)`
- [ ] Buscar en todos los catálogos y secciones activos
- [ ] Resultado incluye: catálogo, sección, código principal, descripción, coincidencia, imagen principal, enlace al registro
- [ ] Índices en PostgreSQL para rendimiento (RNF §38.1)

#### 7.5 Filtros por sección (PRD §31, RF-027)

- [ ] `FilterService.applySectionFilters(sectionId, filters)`
- [ ] Columnas filtrables configuradas por ADMIN por sección
- [ ] Ejemplos: marca, medida, modelo, fabricante, aplicación, tipo, diámetro, vehículo, categoría

#### 7.6 Filtros globales (PRD §32, RF-028)

- [ ] Modelo `GlobalFieldMapping` operativo
- [ ] `FilterService.applyGlobalFilters(filters)`
- [ ] Filtros posibles: catálogo, sección, marca, categoría, fabricante, aplicación, con imagen, con equivalencias
- [ ] Mapeo manual confirmado por admin (no automático)

#### 7.7 Requerimientos funcionales cubiertos

| ID | Requerimiento |
|----|---------------|
| RF-022 | Normalización |
| RF-023 | Búsqueda por sección |
| RF-024 | Búsqueda por catálogo |
| RF-025 | Búsqueda global |
| RF-026 | Origen del resultado |
| RF-027 | Filtros por sección |
| RF-028 | Filtros globales |

#### 7.8 Criterio de completitud

- Búsqueda `2902`, `1408`, `0193-SILVA` encuentra equivalencias normalizadas
- Búsqueda global indica catálogo y sección en cada resultado
- Filtros por sección y globales operativos con campos mapeados

---

### Fase 8 — Archivos y reimportación

**Estado:** ⏳ Pendiente

**Depende de:** Fase 4, Fase 7

#### Objetivo backend

Gestión del historial de archivos subidos, descarga, reemplazo controlado e informes.

#### 8.1 Archivos subidos (PRD §34, RF-029)

- [ ] `UploadedFileService` — listado con metadatos:
  - Nombre, extensión, tamaño, fecha, usuario
  - Catálogo relacionado, cantidad de hojas, hojas importadas
  - Estado, último procesamiento, registros, imágenes, errores
- [ ] Acciones:
  - Descargar original (URL firmada, descarga autorizada)
  - Consultar detalles e informe
  - Reprocesar
  - Crear nuevo catálogo desde archivo
  - Reemplazar catálogo o sección
  - Eliminar archivo (sin eliminar catálogo automáticamente)
- [ ] Eliminar catálogo **no** elimina archivo original

#### 8.2 Reimportación (PRD §17, RF-030)

- [ ] Estrategias: crear nuevo, reemplazar sección, reemplazar catálogo
- [ ] Vista previa + confirmación + conservación de archivo anterior
- [ ] Publicación segura reutilizada de Fase 4

#### 8.3 Informes (PRD §19)

- [ ] Endpoint para consultar informe completo de `ImportJob.resultados`
- [ ] Errores en lenguaje comprensible

#### 8.4 Requerimientos funcionales cubiertos

| ID | Requerimiento |
|----|---------------|
| RF-029 | Archivos subidos |
| RF-030 | Reimportación |

#### 8.5 Criterio de completitud

- Historial de archivos con descarga de originales
- Reemplazo de sección/catálogo sin pérdida de respaldo
- Informe de importación consultable

---

### Fase 9 — Offline

**Estado:** ⏳ Pendiente

**Depende de:** Fase 7

#### Objetivo backend

API y servicios para sincronización de datos en lectura; el cliente usa PWA + IndexedDB, el backend provee payloads y versionado.

#### 9.1 Modelo Prisma

- [ ] `OfflineSyncManifest`

#### 9.2 OfflineSyncService (PRD §35, §36)

- [ ] Preparar payload sincronizable por usuario:
  - Catálogos y secciones seleccionados
  - Registros con datos dinámicos
  - Equivalencias
  - Configuración de columnas y filtros
- [ ] Versionado de datos para detectar actualizaciones
- [ ] Endpoint: verificar si hay actualizaciones desde última sincronización
- [ ] Endpoint: descargar delta o snapshot
- [ ] Miniaturas: URLs o blobs referenciados para cache del cliente
- [ ] Opción de sincronizar imágenes completas bajo demanda
- [ ] No incluir archivos Excel originales en sync offline

#### 9.3 Modo solo lectura (PRD §35.2, RF-032, RF-033)

- [ ] Backend rechaza mutaciones cuando el cliente indica modo offline (o sin conexión verificada)
- [ ] Al cerrar sesión: invalidar manifiestos / señal para limpiar IndexedDB

#### 9.4 Sincronización al recuperar conexión (PRD §35.4, RF-034)

- [ ] Flujo:
  1. Cliente consulta versión remota
  2. Descarga cambios si existen
  3. Actualiza almacenamiento local (responsabilidad cliente)
  4. Registra nueva fecha en `OfflineSyncManifest`

> Sin edición offline → sin resolución de conflictos de escritura.

#### 9.5 Funciones disponibles offline (datos que el backend debe exportar)

- Directorio sincronizado
- Catálogos y secciones
- Registros
- Equivalencias
- Datos para búsqueda por sección, catálogo y global
- Filtros
- Miniaturas sincronizadas

#### 9.6 Requerimientos funcionales cubiertos

| ID | Requerimiento |
|----|---------------|
| RF-032 | Consulta offline |
| RF-033 | Bloqueo offline |
| RF-034 | Sincronización |

#### 9.7 Criterio de completitud

- Payload de sync permite consulta completa sin red
- Fecha de sincronización persistida y visible vía API
- Mutaciones bloqueadas sin conexión

---

### Fase 10 — Pruebas y entrega

**Estado:** ⏳ Pendiente

**Depende de:** Fases 1–9

#### Objetivo backend

Validación con datos reales, hardening, documentación operativa y despliegue.

#### 10.1 Pruebas con archivos reales (PRD §45)

- [ ] Rulemanes — importación, imágenes embebidas, búsqueda
- [ ] Catálogo Azul — múltiples hojas, directorio automático
- [ ] Embragues — imágenes externas por código, sin macros
- [ ] Reimportación y reemplazo de secciones
- [ ] Búsqueda global y equivalencias
- [ ] Modo offline con sincronización previa

#### 10.2 Rendimiento (RNF §38.1)

- [ ] Búsquedas habituales < umbral acordado
- [ ] Importaciones extensas con progreso
- [ ] Paginación en todos los listados de registros

#### 10.3 Seguridad (RNF §38.2)

- [ ] Auditoría de rutas privadas
- [ ] Storage 100% privado con URLs firmadas
- [ ] Validación MIME en uploads
- [ ] Extracción segura de ZIP
- [ ] Límites de tamaño configurados
- [ ] Registro de operaciones críticas en `AuditLog`

#### 10.4 Despliegue

- [ ] Variables de entorno en producción (Vercel + Supabase)
- [ ] `prisma migrate deploy` en CI/CD
- [ ] Buckets Storage en producción
- [ ] Monitoreo básico de errores de importación

#### 10.5 Documentación

- [ ] Guía de operación para Pablo (importación, revisión de imágenes, reimportación)
- [ ] Runbook de recuperación ante importación fallida

#### 10.6 Criterios de éxito del proyecto (PRD §48 — perspectiva backend)

- [ ] Pablo deja de usar pendrive
- [ ] Ambos locales consultan la misma versión central
- [ ] Archivos nuevos se incorporan desde el panel
- [ ] Directorio se actualiza automáticamente
- [ ] Hojas se convierten en secciones utilizables
- [ ] Productos buscables sin conocer archivo de origen
- [ ] Equivalencias encontrables con normalización
- [ ] Imágenes embebidas y externas sin rutas locales
- [ ] ADMIN puede corregir datos e imágenes
- [ ] Archivos originales respaldados
- [ ] Consulta sin conexión tras sincronización

---

## 10. Requerimientos funcionales (mapeo backend)

| ID | Requerimiento | Fase | Componente principal |
|----|---------------|------|----------------------|
| RF-001 | Autenticación | 2 | `AuthService`, Supabase Auth, middleware |
| RF-002 | Roles | 2 | `UserService`, guards de rol |
| RF-003 | Landing pública | 2 | Rutas públicas sin API de catálogos |
| RF-004 | Directorio automático | 2 | `DirectoryService` |
| RF-005 | Gestión de catálogos | 3 | `CatalogService` |
| RF-006 | Gestión de secciones | 3 | `SectionService` |
| RF-007 | Subida de Excel | 4 | Route Handler upload, `UploadedFileService` |
| RF-008 | Respaldo | 4 | Storage + `UploadedFile` |
| RF-009 | Análisis de hojas | 4 | `ExcelStructureService` |
| RF-010 | Selección de hojas | 4 | `CatalogImportService` |
| RF-011 | Detección de columnas | 4 | `ExcelStructureService` |
| RF-012 | Mapeo | 4 | `CatalogImportService` |
| RF-013 | Campos dinámicos | 3–4 | JSONB en `CatalogRecord` |
| RF-014 | Fórmulas | 4 | `ExcelStructureService` (valor calculado) |
| RF-015 | Sin macros | 4 | Validación en importador |
| RF-016 | Imágenes embebidas | 5 | `ImageExtractionService` |
| RF-017 | Imágenes externas | 5 | `ImageMatchingService` |
| RF-018 | Imágenes múltiples | 5 | `ProductImage` |
| RF-019 | Revisión de imágenes | 5 | API de revisión |
| RF-020 | Gestión manual | 6 | `RecordService` |
| RF-021 | Equivalencias | 6–7 | `EquivalenceService` |
| RF-022 | Normalización | 7 | `search/normalize.ts` |
| RF-023 | Búsqueda por sección | 7 | `SearchService` |
| RF-024 | Búsqueda por catálogo | 7 | `SearchService` |
| RF-025 | Búsqueda global | 7 | `SearchService` |
| RF-026 | Origen del resultado | 7 | Respuesta de búsqueda |
| RF-027 | Filtros por sección | 7 | `FilterService` |
| RF-028 | Filtros globales | 7 | `FilterService`, `GlobalFieldMapping` |
| RF-029 | Archivos subidos | 8 | `UploadedFileService` |
| RF-030 | Reimportación | 8 | `CatalogImportService` |
| RF-031 | Publicación segura | 4 | Estados `ImportJob` |
| RF-032 | Consulta offline | 9 | `OfflineSyncService` |
| RF-033 | Bloqueo offline | 9 | Guards de mutación |
| RF-034 | Sincronización | 9 | `OfflineSyncManifest`, endpoints sync |

---

## 11. Requerimientos no funcionales (backend)

### 11.1 Rendimiento

- Búsquedas habituales con respuesta rápida (índices en códigos normalizados y texto indexado)
- Paginación obligatoria en listados de registros
- Miniaturas en lugar de imágenes completas en tablas
- Búsqueda global con índices PostgreSQL
- Importaciones extensas con indicador de progreso
- No cargar todos los registros en una sola respuesta

### 11.2 Seguridad

- Rutas privadas protegidas por middleware
- Supabase Storage privado
- Validación de archivos (extensión, MIME, tamaño)
- Sanitización de nombres de archivo
- Extracción segura de ZIP
- Descargas solo con URL firmada y sesión válida
- Confirmación server-side para eliminaciones destructivas
- `AuditLog` para operaciones importantes
- Protección de endpoints de sync offline

### 11.3 Compatibilidad

- APIs consumibles desde Chrome, Edge y navegadores modernos
- Respuestas JSON consistentes para cliente web y PWA

---

## 12. Criterios de aceptación

### 12.1 Catálogos

- [ ] Aparecen automáticamente en el directorio
- [ ] Cada archivo puede generar varias secciones
- [ ] Secciones con columnas diferentes coexisten
- [ ] Nuevos catálogos sin modificar código

### 12.2 Importación

- [ ] Archivo original respaldado
- [ ] Detección de hojas y columnas
- [ ] Selección de hojas por admin
- [ ] Vista previa antes de publicar
- [ ] Campos dinámicos conservados
- [ ] Fórmulas importadas como valor calculado
- [ ] Macros no ejecutadas
- [ ] Importación fallida no reemplaza datos activos

### 12.3 Imágenes

- [ ] Extracción de embebidas compatibles
- [ ] Importación de externas (ZIP)
- [ ] Asociación por código
- [ ] Ambiguas pendientes de revisión
- [ ] Múltiples imágenes por registro
- [ ] Imagen dañada no cancela importación
- [ ] Miniaturas y vistas ampliadas

### 12.4 Búsqueda

- [ ] Buscador por sección configurable
- [ ] Búsqueda por catálogo entre secciones
- [ ] Búsqueda global en catálogos activos
- [ ] Resultados con catálogo y sección
- [ ] Equivalencias en búsqueda
- [ ] Separadores de códigos no impiden resultados

### 12.5 Filtros

- [ ] Filtros particulares por sección
- [ ] Filtros globales vía campos mapeados
- [ ] Columnas filtrables configurables por admin

### 12.6 Archivos

- [ ] Sección de archivos subidos
- [ ] Descarga de originales
- [ ] Reemplazo de secciones o catálogos
- [ ] Archivos anteriores respaldados

### 12.7 Offline

- [ ] Catálogos sincronizados consultables sin conexión
- [ ] Búsquedas offline
- [ ] Miniaturas sincronizadas visibles
- [ ] Modificaciones bloqueadas offline
- [ ] Fecha de sincronización visible

---

## 13. Fuera de alcance

No se implementará en backend (MVP ni fases futuras documentadas):

- Ejecución de macros VBA
- Edición de archivos Excel desde la web
- Edición offline
- Sincronización de modificaciones offline
- OCR
- Inteligencia artificial / búsqueda semántica
- Aplicación móvil nativa
- Multiempresa
- Facturación, stock, ventas, pagos
- Integración contable o con proveedores
- Conversión automática de cualquier estructura sin configuración
- Reconocimiento visual de imágenes
- Edición avanzada de fotografías
- **NestJS**

---

## 14. Condiciones y supuestos

- Pablo debe explicar el significado de columnas particulares (impacta mapeo y filtros).
- Debe proporcionar imágenes externas con nombres originales (Embragues).
- Estructura de carpetas de muestra se conserva durante análisis.
- Algunas asociaciones de imágenes requerirán revisión manual.
- No se garantiza que todas las fórmulas tengan valores calculados almacenados en el Excel.
- No se ejecutarán macros.
- Filtros definitivos se acordarán por sección con Pablo.
- Filtros globales se definirán después de mapear campos comunes.
- Modo offline requiere sincronización previa con conexión.
- La primera importación puede requerir configuración y asistencia de GRG.
- Catálogos nuevos pueden reutilizar configuraciones de estructuras similares.
- NestJS queda excluido de toda la arquitectura presente y futura.

---

## Referencias

- Producto completo: [`docs/PRD.md`](./PRD.md)
- README del repositorio: [`README.md`](../README.md)
- Schema Prisma: [`prisma/schema.prisma`](../prisma/schema.prisma)
- Cliente DB: [`src/server/database/prisma.ts`](../src/server/database/prisma.ts)
