# BACKEND-IMPLEMENTATION — Plan de implementación backend

> Documento derivado de [`PRD.md`](./PRD.md). Describe la implementación del backend por fases, en orden de dependencias técnicas, **sin omitir requisitos del producto** y alineado con el **estado actual del repositorio**.

---

## Tabla de contenidos

- [1. Estado actual del proyecto](#1-estado-actual-del-proyecto)
- [2. Alineación con el PRD](#2-alineación-con-el-prd)
- [3. Principios y restricciones técnicas](#3-principios-y-restricciones-técnicas)
- [4. Arquitectura backend](#4-arquitectura-backend)
- [5. Stack tecnológico](#5-stack-tecnológico)
- [6. Modelo conceptual de datos](#6-modelo-conceptual-de-datos)
- [7. Estrategia de almacenamiento](#7-estrategia-de-almacenamiento)
- [8. Servicios principales](#8-servicios-principales)
- [9. Visibilidad por rol](#9-visibilidad-por-rol)
- [10. Flujo resumido de importación](#10-flujo-resumido-de-importación)
- [11. Fases de implementación](#11-fases-de-implementación)
- [12. Requerimientos funcionales (mapeo backend)](#12-requerimientos-funcionales-mapeo-backend)
- [13. Requerimientos no funcionales (backend)](#13-requerimientos-no-funcionales-backend)
- [14. Criterios de aceptación](#14-criterios-de-aceptación)
- [15. Criterios de éxito](#15-criterios-de-éxito)
- [16. Fuera de alcance](#16-fuera-de-alcance)
- [17. Condiciones y supuestos](#17-condiciones-y-supuestos)

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
| Prisma | ✅ | Fase 2: `User`, `Catalog`, `AuditLog`. Fase 3.1: `CatalogFolder`, `FolderColumn`, `Product` + visibilidad |
| Supabase | ✅ | Auth (§11.3), Storage privado (§5.1), `@supabase/ssr` + `@supabase/supabase-js` |
| Variables de entorno | ✅ | `DATABASE_URL`, `DIRECT_URL`, credenciales Supabase en `.env`; opcional `NEXT_PUBLIC_APP_URL` |
| Base de datos | ✅ | Migraciones `20260617182823_init_user_catalog_audit_log`, `20260619214310_add_catalog_folder_product_models` |
| Autenticación | ✅ | Módulo `src/server/auth/`, middleware, guards, Server Actions (§11.3) |
| Servicios / repositorios | ✅ | `UserRepository`, `UserService`, `CatalogRepository`, `DirectoryService`, `AuditRepository`, `AuditService` |
| UI de aplicación | ⏳ | Página inicial por defecto de Next.js |

### 1.3 Archivos backend existentes

```text
prisma/schema.prisma          → User, Catalog, CatalogFolder, FolderColumn, Product, AuditLog + enums
prisma/migrations/            → 20260617182823_init_user_catalog_audit_log
                              → 20260619214310_add_catalog_folder_product_models
prisma.config.ts              → configuración Prisma 7 con DIRECT_URL
scripts/verify-db-connections.ts → verificación pooled/directa + cliente Supabase
scripts/setup-storage-buckets.ts → creación de buckets privados
scripts/verify-storage.ts       → subida de prueba + URL firmada
scripts/verify-auth.ts          → cliente SSR, modelo User, rutas protegidas
src/server/database/prisma.ts → singleton PrismaClient con PrismaPg adapter
src/server/storage/             → cliente admin, validación MIME/tamaño, URLs firmadas
src/server/auth/                → sesión SSR, AuthService, guards, middleware helpers
src/server/repositories/user.repository.ts → perfil local sincronizado con Supabase Auth
src/server/repositories/catalog.repository.ts → consultas de catálogos activos
src/server/repositories/audit.repository.ts → persistencia de AuditLog
src/server/services/user.service.ts   → CRUD de usuarios (solo ADMIN)
src/server/services/directory.service.ts → directorio automático de catálogos
src/server/services/audit.service.ts → registro de operaciones importantes
src/features/users/                   → schemas Zod, tipos y Server Actions de usuarios
src/features/directory/types/         → tipos del directorio de catálogos
src/app/api/admin/directory/route.ts  → GET directorio privado
src/middleware.ts               → protección /admin y /api/admin, refresh de sesión
src/features/auth/              → schemas Zod, Server Actions (login, logout, reset)
src/app/auth/callback/route.ts  → intercambio de código OAuth/recuperación
src/app/admin/layout.tsx        → layout protegido con requireAuthOrRedirect
```

### 1.4 Roadmap: PRD vs fases backend

El PRD ordena el roadmap por experiencia de usuario (§48). El backend sigue un orden por **dependencias técnicas** (modelo → importación → imágenes → CRUD manual → búsqueda → archivos → offline). Ambos cubren el mismo alcance.

| Fase PRD (§48) | Fase backend | Estado | Notas |
|----------------|--------------|--------|-------|
| 1 — Base visual y acceso | 2 — Base del sistema | ✅ | Auth, roles, directorio, storage |
| 2 — Modelo Catálogo-Carpeta-Producto | 3 — Catálogos y carpetas | 🔄 | 3.1 completada: modelos Prisma + visibilidad; servicios/API pendientes (3.2+) |
| 3 — Administración manual | 6 — Administración manual | ⏳ | Tras modelo e imágenes |
| 4 — Filtros y búsqueda | 7 — Búsqueda y filtros | ⏳ | Requiere productos y columnas |
| 5 — Importador | 4 — Importador | ⏳ | Asistente guiado, publicación segura |
| 6 — Imágenes | 5 — Imágenes | ⏳ | Tras pipeline de importación |
| 7 — Archivos subidos | 8 — Archivos y reimportación | ⏳ | Historial, informes, reproceso |
| 8 — Offline | 9 — Offline | ⏳ | Payloads, manifiestos, versionado |
| 9 — Pruebas y entrega | 10 — Pruebas y entrega | ⏳ | Archivos reales, despliegue |
| — | 1 — Análisis y definición | ✅ | Documentación de dominio |

---

## 2. Alineación con el PRD

### 2.1 Glosario de términos

| PRD (producto) | Modelo / código backend | Notas |
|----------------|-------------------------|-------|
| Carpeta | `CatalogFolder` | Subdivisión de un catálogo; generalmente una hoja Excel |
| Producto | `Product` | Fila de datos dentro de una carpeta |
| Usuario normal | Rol `CONSULTA` en Prisma | El PRD usa `USER`; el enum implementado es `CONSULTA` |
| Administrador | Rol `ADMIN` | Equivalente directo |
| Sección (doc. anterior) | **Carpeta** | Nomenclatura antigua; reemplazada por alineación al PRD |
| Registro (doc. anterior) | **Producto** | Nomenclatura antigua; reemplazada por alineación al PRD |

### 2.2 Dominio y directorio

- **Dominio (RF-004, PRD §1):** `www.rothamelrepuestos.com.ar` — configuración de despliegue, `NEXT_PUBLIC_APP_URL`, enlaces de recuperación de contraseña y CORS en producción.
- **Directorio automático (PRD §4.2, §7):** generado desde catálogos activos; reemplaza hojas índice manuales de Excel (Catálogo Azul). Implementado parcialmente en `DirectoryService` (Fase 2).

### 2.3 Cobertura de requisitos

Este documento mapea los **47 RF** (PRD §40), los **RNF** (PRD §41), los **criterios de aceptación** (PRD §50) y los **criterios de éxito** (PRD §51). Las secciones de producto referenciadas usan la numeración actual del PRD.

---

## 3. Principios y restricciones técnicas

### 3.1 Principios del producto (impacto backend)

- **Flexibilidad (PRD §6.1):** No depender de una estructura fija de Excel. Cada catálogo y carpeta puede tener columnas, filtros, campos buscables, imágenes y reglas de visualización distintas.
- **Preservación (PRD §6.2):** Conservar archivo original, nombres de columnas, contenido de celdas, saltos de línea, códigos, fórmulas originales (opcional), valor calculado, imágenes y relación fila/columna de origen.
- **Simplicidad (PRD §6.3):** Operaciones complejas mediante asistentes; el backend soporta flujos guiados (estados de importación, vistas previas, confirmaciones).
- **Seguridad (PRD §6.4):** Catálogos privados; solo usuarios autenticados y autorizados.
- **Rapidez operativa (PRD §6.5):** Búsqueda y filtros acumulables con respuesta fluida; meta de usabilidad: encontrar un producto en menos de 5 minutos.

### 3.2 Restricciones arquitectónicas

- **NestJS no se utilizará** en el MVP ni en futuras fases (PRD §44, §49).
- El backend vive dentro del ecosistema **Next.js** (Route Handlers, Server Actions, Services, Repositories).
- No se creará una tabla física por cada Excel, catálogo o carpeta (PRD §43).
- No se ejecutarán macros VBA ni fórmulas arbitrarias en el servidor (PRD §19, §20).
- Las rutas locales de Windows no serán dependencia de funcionamiento (PRD §4.3, §25).

### 3.3 Modelo de dominio (tres niveles — PRD §7)

```text
Catálogo
└── Carpeta (generalmente una hoja de Excel)
    └── Producto (fila de datos: repuesto, equivalencia, aplicación, etc.)
```

Ejemplos de catálogos: Rulemanes, Catálogo Azul, Embragues.

Estructuras de muestra (PRD §4):

```text
Catálogo: Rulemanes
├── Carpeta: Rodamientos
├── Carpeta: Tensores pesados
└── Carpeta: Tensores livianos

Catálogo: Embragues
├── Carpeta: Placas
├── Carpeta: Discos
└── Carpeta: Crapodinas
```

---

## 4. Arquitectura backend

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
│   ├── folders/
│   ├── products/
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
    ├── filters/           # Filtros acumulables y globales
    ├── storage/           # Supabase Storage (privado)
    ├── auth/              # Sesión, permisos, middleware helpers
    └── database/          # Cliente Prisma
```

### 4.1 Capas y responsabilidades

| Capa | Responsabilidad |
|------|-----------------|
| **Route Handlers** (`app/api/...`) | Endpoints REST para uploads grandes, descargas, webhooks, tareas largas, sync offline |
| **Server Actions** | Mutaciones desde formularios del panel admin |
| **Services** | Reglas de negocio, orquestación, transacciones, visibilidad por rol |
| **Repositories** | Queries Prisma, abstracción de persistencia |
| **Validators** | Zod schemas compartidos server-side |
| **Importers / Image processors** | Procesamiento pesado de Excel e imágenes |
| **Storage** | Subida, descarga y URLs firmadas en Supabase Storage |

---

## 5. Stack tecnológico

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
| Modo offline (cliente) | PWA, Service Worker, Cache Storage, IndexedDB (PRD §44) |

### 5.1 Uso de Supabase Storage

Almacenar de forma privada:

- Archivos Excel originales (`.xlsx`, `.xlsm`)
- Imágenes de productos
- Miniaturas
- Archivos temporales de importación
- ZIP de imágenes externas

---

## 6. Modelo conceptual de datos

> Entidades del PRD §42. Deben materializarse en `prisma/schema.prisma` de forma progresiva por fase.

### 6.1 User

| Campo | Descripción |
|-------|-------------|
| ID | Identificador (UUID = `auth.users.id`) |
| Nombre | Nombre del usuario |
| Correo | Email (único) |
| Rol | `ADMIN` \| `CONSULTA` (PRD: `ADMIN` \| `USER`) |
| Estado | Activo / desactivado |
| Último acceso | Timestamp |
| createdAt / updatedAt | Timestamps |

**Permisos por rol (PRD §8):**

- **Visitante:** Sin acceso a backend de catálogos (solo landing pública).
- **Administrador:** CRUD completo, importación, combinar/reemplazar listas, configuración de columnas y visibilidad, usuarios, archivos, imágenes, descarga de originales.
- **Usuario normal (`CONSULTA`):** Lectura de catálogos/carpetas/productos visibles, búsqueda, filtros, imágenes ampliadas, offline sincronizado. Sin modificaciones ni descarga de originales (salvo habilitación explícita futura).

### 6.2 Catalog

| Campo | Descripción |
|-------|-------------|
| ID | Identificador |
| Nombre | Nombre del catálogo |
| Descripción | Texto opcional |
| Imagen representativa | URL/ruta en Storage |
| Estado | Activo / inactivo / oculto |
| Orden | Orden en el directorio |
| Visible para usuario normal | Boolean (PRD §9.1) |
| createdAt / updatedAt | Timestamps |

**Operaciones admin (PRD §14.1):** crear, editar nombre/descripción, cambiar orden, ocultar/mostrar, borrar, vaciar, asociar archivos subidos.

**Borrar catálogo (PRD §14.2):** elimina catálogo, carpetas, productos y relaciones; **no** elimina el Excel original.

**Vaciar catálogo (PRD §14.3):** elimina productos de todas las carpetas; conserva catálogo, carpetas, configuración de columnas y visibilidad.

### 6.3 CatalogFolder

| Campo | Descripción |
|-------|-------------|
| ID | Identificador |
| Catálogo | FK a Catalog |
| Nombre | Nombre de la carpeta (editable solo por admin — PRD §7.2) |
| Descripción | Texto opcional |
| Estado | Activa / inactiva |
| Orden | Orden dentro del catálogo |
| Visible para usuario normal | Boolean (PRD §9.2) |
| Configuración de búsqueda | Qué columnas participan (PRD §31) |
| Configuración de filtros | Columnas filtrables (PRD §34) |
| createdAt / updatedAt | Timestamps |

**Operaciones admin (PRD §14.4):** crear manualmente o desde hoja Excel, renombrar, cambiar orden, ocultar/mostrar, configurar columnas/buscador/filtros, borrar, vaciar.

**Borrar carpeta (PRD §14.5):** elimina carpeta, productos, imágenes asociadas y configuraciones propias.

**Vaciar carpeta (PRD §14.6):** elimina productos; conserva nombre, pertenencia al catálogo, configuración y visibilidad.

**Hojas auxiliares (PRD §14.7):** clasificación por hoja — carpeta importable, hoja índice, hoja auxiliar, hoja ignorada. Las hojas índice no se convierten obligatoriamente en carpetas.

### 6.4 FolderColumn

| Campo | Descripción |
|-------|-------------|
| ID | Identificador |
| Carpeta | FK a CatalogFolder |
| Nombre original | Encabezado del Excel |
| Nombre visible | Etiqueta en UI |
| Clave interna | Slug/key estable |
| Tipo | Tipo de dato |
| Orden | Posición en tabla |
| Visible para usuario normal | Boolean (PRD §9.3) |
| Buscable | Participa en búsqueda de carpeta |
| Buscable globalmente | Participa en búsqueda global |
| Filtrable | Participa en filtros de carpeta |
| Filtrable globalmente | Participa en filtros globales |
| Editable por administrador | Boolean |
| Campo global relacionado | FK opcional a GlobalFieldMapping |
| Es código principal | Boolean |
| Es equivalencia | Boolean |
| Es descripción | Boolean |
| Es código de imagen | Boolean |
| Obligatoria / solo lectura | Boolean |
| Ancho, formato, unidad, etiqueta | Metadatos de visualización (PRD §36) |

> La visibilidad de una columna **no** equivale a ser buscable o filtrable (PRD §9.4).

### 6.5 Product

| Campo | Descripción |
|-------|-------------|
| ID | Identificador |
| Carpeta | FK a CatalogFolder |
| Código principal | Opcional (PRD §29.1) |
| Código normalizado | Para búsqueda |
| Descripción | Texto principal |
| Datos dinámicos | JSONB — columnas no estandarizadas (PRD §36, RF-019) |
| Texto original | Contenido crudo preservado |
| Texto indexado | Texto concatenado para búsqueda full-text |
| createdAt / updatedAt | Timestamps |

**Gestión manual (PRD §15):** crear, editar, eliminar, duplicar; editar campos dinámicos y equivalencias; gestionar imágenes; consultar fechas de creación/modificación.

### 6.6 EquivalentCode

| Campo | Descripción |
|-------|-------------|
| ID | Identificador |
| Producto | FK a Product |
| Código original | Texto tal como fue importado/ingresado |
| Código normalizado | Para búsqueda |
| Tipo | Opcional |

**Reglas (PRD §29):**

- Cero, una o múltiples equivalencias por producto.
- Celdas con múltiples códigos (saltos de línea, `=`, guiones, barras, espacios, paréntesis, texto descriptivo) conservan el original y generan valores normalizados en paralelo.
- Separación automática revisable cuando el formato sea ambiguo.

### 6.7 ProductImage

| Campo | Descripción |
|-------|-------------|
| ID | Identificador |
| Producto | FK opcional a Product |
| Ruta | Path en Storage |
| Nombre original | Nombre del archivo |
| Tipo MIME | Validado |
| Tamaño | Bytes |
| Orden | Orden en galería |
| Imagen principal | Boolean |
| Etiqueta | Función de la imagen |
| Hoja de origen | Trazabilidad Excel |
| Fila / columna de origen | Trazabilidad Excel |
| Estado de asociación | Ver §6.7.1 |
| Origen | Embebida, ZIP, manual, etc. |

**Tipos soportados (PRD §23):** embebidas, externas por código, externas por nombre, manuales, varias por fila. Ausencia de imagen no impide importación.

#### 6.7.1 Estados de asociación de imagen (PRD §27)

- Asociada automáticamente
- Asociada manualmente
- Pendiente de revisión
- Archivo no encontrado
- Asociación ambigua
- Nombre duplicado
- Formato rechazado
- Eliminada

### 6.8 UploadedFile

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

**Metadatos en listado (PRD §37):** catálogo/carpeta relacionados, cantidad de hojas, hojas importadas, productos, imágenes, errores, último procesamiento.

**Acciones:** descargar original, consultar detalles/informe, reprocesar, crear catálogo/carpeta, combinar/reemplazar lista, eliminar archivo. Eliminar catálogo/carpeta **no** elimina el archivo original.

### 6.9 ImportJob

| Campo | Descripción |
|-------|-------------|
| ID | Identificador |
| Archivo | FK a UploadedFile |
| Catálogo destino | FK opcional a Catalog |
| Carpeta destino | FK opcional a CatalogFolder |
| Estado | Ver §10.1 |
| Tipo de acción | `IMPORTAR_LISTA` \| `COMBINAR_LISTA` \| `REEMPLAZAR_LISTA` |
| Configuración | JSON — mapeo, hojas, reglas de imagen |
| Resultados | JSON — informe de importación (PRD §22) |
| Fecha de inicio / finalización | Timestamps |

### 6.10 ImportPreview

| Campo | Descripción |
|-------|-------------|
| ID | Identificador |
| Importación | FK a ImportJob |
| Productos reconocidos | JSON |
| Productos coincidentes | JSON (resaltados en vista previa — PRD §18.5) |
| Errores | JSON |
| Advertencias | JSON |
| Estado | Estado de la previsualización |

### 6.11 ImportSheet

| Campo | Descripción |
|-------|-------------|
| ID | Identificador |
| Importación | FK a ImportJob |
| Nombre de hoja | Nombre en Excel |
| Carpeta de destino | FK opcional a CatalogFolder |
| Fila de encabezado | Número detectado/configurado |
| Estado | Importable, índice, auxiliar, ignorada |
| Cantidad de productos | Contador post-proceso |

### 6.12 GlobalFieldMapping

| Campo | Descripción |
|-------|-------------|
| ID | Identificador |
| Columna | FK a FolderColumn |
| Campo global | Nombre compartido (ej. `marca`, `fabricante`) |
| Configuración | JSON adicional |

> El mapeo **no debe realizarse automáticamente sin confirmación** del administrador (PRD §35).

### 6.13 OfflineSyncManifest

| Campo | Descripción |
|-------|-------------|
| Usuario | FK a User |
| Dispositivo | Identificador del dispositivo |
| Catálogos sincronizados | Lista/relación |
| Carpetas sincronizadas | Lista/relación |
| Versión | Versión de datos sincronizados |
| Fecha de sincronización | Timestamp |

### 6.14 AuditLog

| Campo | Descripción |
|-------|-------------|
| Usuario | FK a User (opcional) |
| Acción | Tipo de operación |
| Entidad | Tipo de entidad afectada |
| Identificador | ID de la entidad |
| Fecha | Timestamp |

---

## 7. Estrategia de almacenamiento

### 7.1 PostgreSQL (relacional + JSONB) — PRD §43

- Estructura relacional para: usuarios, catálogos, carpetas, archivos, productos, imágenes, importaciones.
- Columnas específicas para campos importantes: código principal, código normalizado, descripción.
- **JSONB** para datos variables por carpeta (`Product.datosDinamicos`).
- **Índices** para búsquedas (códigos normalizados, texto indexado, GIN sobre JSONB, búsqueda global).

### 7.2 Beneficios

- Agregar nuevos archivos sin migraciones de schema.
- Conservar estructuras diferentes entre carpetas.
- Mantener un buscador global unificado.
- Incorporar nuevos catálogos sin modificar código.
- Configurar visibilidad en tres niveles.
- Simplificar el modo offline (exportar estructura + datos).

### 7.3 Ejemplo de coexistencia de estructuras

```text
Carpeta A: Código | Descripción | Marca | Aplicación
Carpeta B: Número | Diámetro | Medida | Modelo | Imagen
Carpeta C: Referencia | Equivalencias | Fabricante
```

Las tres estructuras coexisten en las mismas tablas (`Product` + JSONB).

---

## 8. Servicios principales

Servicios del PRD §46, más servicios de infraestructura ya implementados.

| Servicio | Responsabilidades |
|----------|-------------------|
| **CatalogService** | CRUD catálogos, vaciar, visibilidad, orden |
| **FolderService** | CRUD carpetas, vaciar, visibilidad, configuración de columnas/búsqueda/filtros |
| **ProductService** | CRUD productos, datos dinámicos, duplicar, equivalencias |
| **CatalogImportService** | Asistente de importación, análisis, vista previa, combinar/reemplazar/aplicar lista, publicación segura |
| **ExcelStructureService** | Hojas, encabezados, columnas, celdas combinadas, fórmulas, hojas auxiliares |
| **ImageExtractionService** | Imágenes embebidas, fila/columna de origen, miniaturas, pendientes |
| **ImageMatchingService** | Asociación por código/nombre, duplicados, ambigüedades |
| **SearchService** | Normalización, búsqueda por carpeta/catálogo/global, orden de resultados |
| **ColumnFilterService** | Filtros acumulables por columna, pills activos, limpieza, debounce server-side |
| **VisibilityService** | Qué catálogos, carpetas y columnas ve cada rol; ocultamiento real en APIs |
| **OfflineSyncService** | Payloads sincronizables, versionado, miniaturas, manifiestos |
| **UploadedFileService** | Historial, descarga, reproceso, informes |
| **AuthService** | Sesión, login/logout, recuperación de contraseña ✅ |
| **UserService** | CRUD usuarios (solo ADMIN) ✅ |
| **DirectoryService** | Directorio automático ✅ |
| **AuditService** | Operaciones importantes ✅ |

---

## 9. Visibilidad por rol

Implementación backend de PRD §9. El administrador siempre ve todo.

### 9.1 Tres niveles

```text
Catálogo  → visible para usuario normal: Sí / No
Carpeta   → visible para usuario normal: Sí / No
Columna   → visible para usuario normal: Sí / No
```

### 9.2 Reglas de filtrado en APIs

- `VisibilityService` aplica filtros en **todas** las consultas para rol `CONSULTA`.
- Catálogo oculto → usuario normal no ve catálogo, carpetas ni productos.
- Carpeta oculta → invisible aunque el catálogo esté visible.
- Columna oculta → excluida de respuestas JSON y de búsqueda/filtros del usuario normal.
- Buscable/filtrable/global son configuraciones **independientes** de la visibilidad (PRD §9.4).

### 9.3 Implementación

- Campos `visibleToNormalUser` (o equivalente) en `Catalog`, `CatalogFolder`, `FolderColumn`.
- Guards en servicios y repositorios; nunca confiar solo en el frontend.
- Constantes de auditoría para cambios de visibilidad.

---

## 10. Flujo resumido de importación

Flujo del PRD §47, implementado por el asistente guiado (PRD §17).

```text
Administrador
      │
      ▼
Paso 1 — Sube Excel y, si corresponde, ZIP de imágenes o imágenes sueltas
      │
      ▼
Se almacenan los archivos originales (respaldo antes de procesar)
      │
      ▼
Paso 2 — Selecciona catálogo destino [dropdown +] o crea uno nuevo
      │
      ▼
Selecciona carpeta destino [dropdown +] o crea una nueva
      │
      ▼
Paso 3 — Se detectan hojas, columnas, fórmulas e imágenes (vista previa estructural)
      │
      ▼
Paso 4 — Se muestran productos reconocidos, coincidencias, errores y advertencias
      │
      ▼
Paso 5 — Si carpeta vacía: Cancelar | Aplicar lista
         Si carpeta con productos: Combinar lista | Reemplazar lista
      │
      ▼
Paso 6 — Confirmación cuando la acción puede modificar datos existentes
      │
      ▼
Se procesa versión preliminar (no reemplaza datos activos hasta confirmar)
      │
      ▼
Se revisan errores y asociaciones de imágenes
      │
      ▼
Se aplica la lista (transacción atómica)
      │
      ▼
Catálogo y carpeta quedan actualizados; directorio se regenera automáticamente
```

### 10.1 Estados de ImportJob (publicación segura — PRD §21)

| Estado | Descripción |
|--------|-------------|
| `STORED` | Archivo almacenado |
| `ANALYZING` | Analizando |
| `PENDING_DESTINATION` | Pendiente de destino (catálogo/carpeta) |
| `PENDING_CONFIG` | Pendiente de configuración |
| `PROCESSING` | Procesando |
| `PENDING_REVIEW` | Pendiente de revisión |
| `READY_TO_APPLY` | Listo para aplicar |
| `APPLIED` | Aplicado |
| `PUBLISHED` | Publicado — datos activos |
| `FAILED` | Fallido — no afecta datos vigentes |
| `CANCELLED` | Cancelado |

> Los productos nuevos **no reemplazan la versión activa** hasta completar correctamente y confirmar (PRD §21, RF-044).

### 10.2 Estrategias de lista (PRD §18)

| Escenario | Acciones | Comportamiento backend |
|-----------|----------|------------------------|
| **Carpeta vacía** | Cancelar / Aplicar lista | Aplicar sin confirmación adicional (no hay datos previos) |
| **Carpeta con productos** | Combinar / Reemplazar | Combinar: agregar nuevos, omitir coincidentes (MVP). Reemplazar: sustituir lista completa |
| **Coincidencias** | Detección previa | Por código principal, normalizado, código imagen, campo de referencia, equivalencias |
| **Confirmación** | Modal obligatorio | Combinar con coincidencias, reemplazar, y demás acciones destructivas (PRD §17.6) |

Antes de reemplazar, el informe debe indicar: carpeta afectada, productos actuales vs nuevos, respaldo del original (PRD §18.4).

### 10.3 Informe de importación (PRD §22)

Persistir y exponer en `ImportJob.resultados`:

- Archivo procesado, catálogo/carpeta destino
- Hojas detectadas e importadas
- Productos procesados, creados, omitidos, coincidentes
- Fórmulas detectadas
- Imágenes detectadas, asociadas, pendientes, rechazadas
- Columnas detectadas
- Errores y advertencias (lenguaje comprensible)
- Acción aplicada: importar, combinar o reemplazar

### 10.4 Fórmulas y macros (backend)

- **Fórmulas (PRD §19):** leer valor calculado; conservar fórmula opcionalmente; no ejecutar en servidor; advertir si falta valor calculado.
- **Macros (PRD §20):** no ejecutar ni trasladar; opcionalmente analizar para inferir relaciones datos↔imágenes (Embragues).

### 10.5 Formatos de importación (PRD §16)

- MVP: `.xlsx`, `.xlsm` (solo como fuente de datos, sin VBA).
- `.xls` antiguo: sujeto a validación técnica.
- Validar formato, tamaño, extensión, MIME e integridad básica antes de procesar.

---

## 11. Fases de implementación

---

### Fase 1 — Análisis y definición

**Estado:** ✅ Completada (documentación de producto)

#### Objetivo backend

Documentar y validar con Pablo el significado de columnas, equivalencias, filtros e imágenes externas antes de modelar datos definitivos.

#### Entregables (PRD §52, archivos §4)

- [x] Reunión con Pablo
- [x] Revisión de Rulemanes, Catálogo Azul, Embragues
- [x] Definición de significado de columnas
- [x] Definición de equivalencias y filtros
- [x] Validación de imágenes externas
- [x] Identificación de hojas auxiliares

#### Hallazgos técnicos

| Archivo | Implicación backend |
|---------|---------------------|
| **Rulemanes** | 3 hojas, imágenes embebidas, sin carpeta externa |
| **Catálogo Azul** | ~35 hojas, imágenes embebidas, hoja índice → directorio automático |
| **Embragues** | `.xlsm`, imágenes externas por código/nombre, macros VBA → solo análisis |

---

### Fase 2 — Base del sistema

**Estado:** ✅ Completada (2026-06-18)

**Depende de:** Fase 1 · **Equivale a PRD fase 1 (base visual y acceso)**

#### Objetivo backend

Infraestructura: base de datos, storage, autenticación, usuarios, directorio y auditoría.

#### 2.1 Base de datos ✅

| Entregable | Resultado |
|------------|-----------|
| Modelos iniciales | `User`, `Catalog`, `AuditLog` en `prisma/schema.prisma` |
| Timestamps | `createdAt` / `updatedAt` en los tres modelos |
| Índices | `Catalog.status`, `Catalog.order`; `User.status`; `AuditLog` (userId, entityType+entityId, createdAt) |
| Migración | `20260617182823_init_user_catalog_audit_log` |
| Conexiones | Verificadas con `pnpm db:verify` |

**Decisiones:**

- `User.id` UUID = `auth.users.id` de Supabase.
- Enums: `UserRole` (`ADMIN` \| `CONSULTA`), `UserStatus`, `CatalogStatus`.
- `Catalog.coverImagePath` prepara imagen representativa en Storage.
- `AuditLog.userId` opcional (`ON DELETE SET NULL`).

**Scripts:** `pnpm db:migrate` · `pnpm db:generate` · `pnpm db:verify` · `pnpm db:studio`

#### 2.2 Supabase Storage ✅

| Entregable | Resultado |
|------------|-----------|
| Buckets privados | `excel-originals`, `product-images`, `temp-imports` |
| Módulo `src/server/storage/` | Validación MIME/tamaño, sanitización, URLs firmadas |
| Verificación | `pnpm storage:verify` |

**Límites:**

| Bucket | MIME | Tamaño máx. |
|--------|------|-------------|
| `excel-originals` | `.xlsx`, `.xlsm` | 50 MB |
| `product-images` | `.jpg`, `.jpeg`, `.png`, `.webp` | 10 MB |
| `temp-imports` | Excel, ZIP, imágenes | 50 MB |

#### 2.3 Autenticación (PRD §11, RF-001, RF-002) ✅

| Entregable | Resultado |
|------------|-----------|
| Módulo `src/server/auth/` | Clientes SSR, `AuthService`, guards, errores tipados |
| Inicio / cierre de sesión | `signInWithPassword`, `signOut` |
| Recuperación de contraseña | `requestPasswordReset` + `updatePassword`; callback `/auth/callback` |
| Persistencia de sesión | Cookies `@supabase/ssr`; refresh en middleware |
| Middleware | `/admin` y `/api/admin` protegidos |
| Guards | `requireAuth()`, `requireRole('ADMIN')` |
| Desactivación de usuarios | `UserService.deactivateUser()` + bloqueo en login |
| Logout offline | Señal `grg:offline:clear` (coordinación Fase 9) |

**Rutas:**

| Tipo | Rutas |
|------|-------|
| Públicas | `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/callback` |
| Protegidas | `/admin/*`, `/api/admin/*` |
| API sesión | `GET /api/admin/session` |
| API directorio | `GET /api/admin/directory` |

**Flujo de sincronización de perfil:**

```text
Supabase Auth → UserRepository.findById
      ├── No existe → upsert (rol CONSULTA por defecto)
      ├── INACTIVE → signOut + USER_INACTIVE
      └── ACTIVE → touchLastAccess + sesión válida
```

#### 2.4 Usuarios (RF-002) ✅

- `UserService` + `UserRepository`: CRUD solo ADMIN
- Crear: Supabase `admin.createUser` + perfil local
- Activar/desactivar con cierre global de sesiones
- Server Actions en `src/features/users/actions/`
- Admin no puede desactivarse a sí mismo

#### 2.5 Directorio (PRD §7, §13 — directorio automático) ✅

- `DirectoryService.getDirectory()` — `requireAuth()`; ADMIN y CONSULTA
- Catálogos `ACTIVE` ordenados; reemplaza hoja índice manual
- `sectionCount`: `0` hasta Fase 3 (representará carpetas / `CatalogFolder`)
- `offlineSync.status`: `"unavailable"` (placeholder Fase 9)

#### 2.6 Auditoría (RNF §41.2) ✅

Operaciones registradas: login, logout, CRUD usuarios, subidas con contexto.

Reservadas Fase 3+: `CATALOG_*`, `FOLDER_*`, `IMPORT_PUBLISHED`.

#### 2.7 RF cubiertos en Fase 2 ✅

| ID | Requerimiento | Componente |
|----|---------------|------------|
| RF-001 | Autenticación | `AuthService`, middleware |
| RF-002 | Roles | `UserService`, `requireRole()` |
| RF-003 | Landing pública | Rutas públicas sin API de catálogos |
| RF-004 | Dominio | `NEXT_PUBLIC_APP_URL` (despliegue) |

**Documentación frontend:** [`docs/ENDPOINTS.md`](./ENDPOINTS.md)

#### 2.8 Criterio de completitud ✅

- [x] ADMIN y CONSULTA autenticados
- [x] Rutas `/admin` y `/api/admin/*` protegidas
- [x] Directorio operativo (vacío válido)
- [x] `AuditLog` en operaciones críticas
- [x] Storage privado verificado
- [x] `pnpm auth:verify`, `pnpm db:verify`, `pnpm storage:verify`

---

### Fase 3 — Catálogos y carpetas

**Estado:** 🔄 En progreso (3.1 completada) · **Equivale a PRD fase 2 (modelo Catálogo-Carpeta-Producto)**

**Depende de:** Fase 2

#### Objetivo backend

CRUD de catálogos y carpetas, configuración de columnas, visibilidad por rol, lectura paginada de productos.

#### 3.1 Modelos Prisma ✅

- [x] `CatalogFolder`, `FolderColumn`, `Product` (estructura base + JSONB)
- [x] Campos de visibilidad en catálogo, carpeta y columna
- [x] Relaciones, índices

**Migración:** `20260619214310_add_catalog_folder_product_models`

**Enums añadidos:** `FolderStatus` (`ACTIVE`, `INACTIVE`), `ColumnDataType` (`TEXT`, `NUMBER`, `BOOLEAN`, `DATE`, `DATETIME`, `IMAGE`, `FORMULA`, `UNKNOWN`).

**Decisiones de alcance 3.1:**

- `Catalog.visibleToNormalUser` añadido al modelo existente (default `true`).
- `Product.dynamicData` como JSONB con índice GIN para búsquedas futuras.
- `FolderColumn.globalFieldKey` como placeholder; `GlobalFieldMapping` se implementará en 3.5.
- `EquivalentCode`, `ProductImage` e importación quedan para fases posteriores (4–6).

**Verificación:** `pnpm exec prisma validate`, `pnpm db:generate`, `pnpm db:verify`.

#### 3.2 Gestión de catálogos (PRD §14.1, RF-005, RF-006, RF-010)

- [ ] `CatalogService` — crear, editar, ordenar, ocultar/mostrar, borrar, **vaciar**, asociar archivos
- [ ] Borrar no elimina Excel original (PRD §14.2)
- [ ] Vaciar conserva carpetas y configuración (PRD §14.3)

#### 3.3 Gestión de carpetas (PRD §14.4, RF-007, RF-011)

- [ ] `FolderService` — crear manual o desde hoja, renombrar, ordenar, ocultar/mostrar, borrar, **vaciar**
- [ ] Configurar columnas, buscador y filtros (estructura; lógica en Fase 7)

#### 3.4 Hojas auxiliares (PRD §14.7)

- [ ] Clasificación: carpeta importable, índice, auxiliar, ignorada

#### 3.5 Configuración de columnas (PRD §36, RF-009, RF-012, RF-042)

- [ ] `ColumnConfigService` — visibilidad, buscable, filtrable, global, editable, tipos semánticos, metadatos

#### 3.6 Productos y tablas dinámicas (RF-005, RF-019)

- [ ] `ProductService` + repositorio — lectura paginada, detalle, columnas configuradas + JSONB

#### 3.7 Visibilidad (PRD §9, RF-010–RF-012)

- [ ] `VisibilityService` integrado en todas las consultas de lectura

#### 3.8 Navegación (PRD §13)

- [ ] API: metadatos de catálogo con lista de carpetas visibles

#### 3.9 Criterio de completitud

- ADMIN gestiona catálogos/carpetas con visibilidad y vaciado
- CONSULTA solo ve entidades visibles
- Nuevo catálogo aparece en directorio sin cambios de código

---

### Fase 4 — Importador

**Estado:** ⏳ Pendiente · **Equivale a PRD fase 5**

**Depende de:** Fase 3

#### Objetivo backend

Asistente guiado de 6 pasos (PRD §17), publicación segura, combinar/reemplazar/aplicar lista.

#### 4.1 Modelos Prisma

- [ ] `UploadedFile`, `ImportJob`, `ImportPreview`, `ImportSheet`

#### 4.2 Upload y validación (PRD §16, RF-013, RF-014)

- [ ] `.xlsx`, `.xlsm`; validación formato/tamaño/MIME
- [ ] Respaldo del original **antes** de procesar
- [ ] Route Handler multipart para archivos grandes

#### 4.3 Asistente — pasos backend (PRD §17)

1. [ ] Subir archivo (+ ZIP/imágenes sueltas cuando corresponda)
2. [ ] Selección de catálogo y carpeta destino con creación rápida `[+]` (RF-015, RF-016)
3. [ ] Reconocer estructura: hojas, columnas, fórmulas, imágenes, celdas combinadas, encabezados duplicados
4. [ ] Vista previa: productos reconocidos, coincidencias, errores, contadores (RF-020, RF-021)
5. [ ] Resolver destino: aplicar / combinar / reemplazar según carpeta vacía o con productos (RF-022–RF-024)
6. [ ] Confirmación de acciones destructivas (RF-025)

#### 4.4 Detección y mapeo (RF-017, RF-018, RF-019)

- [ ] `ExcelStructureService` + `CatalogImportService`
- [ ] Mapeo a campos semánticos; no mapeados → JSONB
- [ ] Selección manual cuando la detección no sea segura

#### 4.5 Fórmulas y macros (PRD §19–§20, RF-026, RF-027)

- [ ] Valor calculado sin ejecución server-side
- [ ] Sin macros; análisis opcional de relaciones (Embragues)

#### 4.6 Publicación segura (PRD §21, RF-044)

- [ ] Máquina de estados §10.1; staging o `isPublished`
- [ ] Transacción atómica al publicar
- [ ] Fallo no afecta datos vigentes

#### 4.7 Progreso e informe (PRD §22)

- [ ] Progreso en importaciones extensas (RNF §41.1)
- [ ] Informe persistido §10.3

#### 4.8 Criterio de completitud

- Importar Rulemanes o Catálogo Azul con publicación segura
- Combinar y reemplazar lista funcionan con confirmación
- Original respaldado y descargable

---

### Fase 5 — Imágenes

**Estado:** ⏳ Pendiente · **Equivale a PRD fase 6**

**Depende de:** Fase 4

#### Objetivo backend

Extracción, almacenamiento, asociación y revisión (PRD §23–§28).

#### 5.1 Modelo

- [ ] `ProductImage` con estados §6.7.1

#### 5.2 Tipos (PRD §23.1)

1. Embebidas · 2. Externas por código · 3. Externas por nombre · 4. Manuales · 5. Varias por fila

#### 5.3 Embebidas (PRD §24, RF-028)

- [ ] `ImageExtractionService` — hoja, fila, columna, encabezado; pendiente si asociación insegura

#### 5.4 Externas (PRD §25, RF-029)

- [ ] ZIP y/o imágenes sueltas; `ImageMatchingService` por código, producto, nombre, columna, regla
- [ ] Sin rutas locales Windows

#### 5.5 Formatos (PRD §26)

- [ ] `.jpg`, `.jpeg`, `.png`, `.webp`; validación extensión/MIME/tamaño/integridad/duplicados
- [ ] Imagen dañada → error parcial, no cancela importación

#### 5.6 Procesamiento (PRD §28, RNF §41.1)

- [ ] Miniaturas optimizadas; URLs firmadas; no imágenes completas en listados

#### 5.7 Revisión (PRD §27, RF-031)

- [ ] API: no asociadas, ambiguas, rechazadas; asociar, reemplazar, eliminar, principal, orden, etiqueta

#### 5.8 Criterio de completitud

- Rulemanes y Catálogo Azul: embebidas visibles
- Embragues: externas por código sin rutas locales
- Ambiguas pendientes de revisión

---

### Fase 6 — Administración manual

**Estado:** ⏳ Pendiente · **Equivale a PRD fase 3**

**Depende de:** Fase 3, Fase 5

#### Objetivo backend

CRUD manual de productos, equivalencias e imágenes (PRD §15).

#### 6.1 Productos (PRD §15, RF-008, RF-009)

- [ ] Crear, editar, eliminar, **duplicar**
- [ ] Formularios según `FolderColumn` de la carpeta
- [ ] Editar cualquier columna importada

#### 6.2 Equivalencias (PRD §29, RF-033)

- [ ] `EquivalenceService` — agregar/eliminar, parseo multi-código, revisión manual

#### 6.3 Imágenes manuales (PRD §23.3)

- [ ] Agregar, reemplazar, eliminar, marcar principal, orden, etiqueta

#### 6.4 Auditoría

- [ ] `createdAt`/`updatedAt` en detalle; registro en `AuditLog`

#### 6.5 Criterio de completitud

- ADMIN corrige datos e imágenes post-importación
- CONSULTA solo visualiza

---

### Fase 7 — Búsqueda y filtros

**Estado:** ⏳ Pendiente · **Equivale a PRD fase 4**

**Depende de:** Fase 3, Fase 6

#### Objetivo backend

Motor de búsqueda normalizado y filtros acumulables (PRD §29–§36).

#### 7.1 Normalización (PRD §30, RF-034)

- [ ] Ignorar mayúsculas, espacios, guiones, `_`, puntos, barras, separadores configurados

#### 7.2 Búsqueda por carpeta (PRD §31, RF-035)

- [ ] Código principal, equivalencias, descripción, columnas buscables configuradas

#### 7.3 Búsqueda por catálogo (PRD §32, RF-036)

- [ ] Recorrer carpetas visibles; resultado indica carpeta de origen

#### 7.4 Búsqueda global (PRD §33, RF-037, RF-038)

- [ ] Todos los catálogos/carpetas activos; resultado con catálogo, carpeta, código, descripción, coincidencia, imagen principal
- [ ] Índices PostgreSQL (RNF §41.1)

#### 7.5 Filtros acumulables por columna (PRD §34, RF-039–RF-041)

- [ ] `ColumnFilterService` — filtro por columna, acumulables (AND), tipos MVP (contiene / exacto)
- [ ] Pills de filtros activos (estado para UI)
- [ ] Limpieza individual y general
- [ ] Debounce 250–300 ms (coordinación con frontend; RNF §41.1)
- [ ] Meta usabilidad: reducir lista amplia en menos de 5 minutos

#### 7.6 Filtros globales (PRD §35, RF-042 parcial)

- [ ] `GlobalFieldMapping` operativo; mapeo manual confirmado
- [ ] Filtros posibles: catálogo, carpeta, marca, categoría, fabricante, aplicación, con imagen, con equivalencias

#### 7.7 Criterio de completitud

- `2902`, `1408`, `0193-SILVA` encuentran equivalencias normalizadas
- Búsqueda global indica catálogo y carpeta
- Filtros acumulables operativos

---

### Fase 8 — Archivos y reimportación

**Estado:** ⏳ Pendiente · **Equivale a PRD fase 7**

**Depende de:** Fase 4, Fase 7

#### Objetivo backend

Sección Archivos subidos (PRD §37): historial, descarga, reproceso, informes.

#### 8.1 UploadedFileService (PRD §37, RF-043)

- [ ] Listado con metadatos completos §6.8
- [ ] Descargar original (URL firmada)
- [ ] Consultar informe, reprocesar, combinar/reemplazar desde archivo
- [ ] Eliminar archivo sin eliminar catálogo automáticamente

#### 8.2 Reimportación

- [ ] Reutilizar publicación segura y estrategias §10.2
- [ ] Conservar archivos anteriores

#### 8.3 Criterio de completitud

- Historial con descarga de originales
- Informe de importación consultable
- Reemplazo sin pérdida de respaldo

---

### Fase 9 — Offline

**Estado:** ⏳ Pendiente · **Equivale a PRD fase 8**

**Depende de:** Fase 7

#### Objetivo backend

APIs de sincronización; cliente usa PWA + IndexedDB (PRD §38–§39).

#### 9.1 Modelo

- [ ] `OfflineSyncManifest`

#### 9.2 OfflineSyncService (PRD §38, RF-045–RF-047)

- [ ] Payload: catálogos/carpetas visibles, productos, equivalencias, columnas, datos de búsqueda/filtros
- [ ] Versionado; endpoints verificar actualizaciones y descargar delta/snapshot
- [ ] Miniaturas sincronizadas; imágenes completas bajo demanda
- [ ] **No** incluir Excel originales offline (PRD §39)
- [ ] Al cerrar sesión: señal limpiar IndexedDB (`grg:offline:clear` ya preparado)

#### 9.3 Solo lectura (PRD §38.2, RF-046)

- [ ] Backend rechaza mutaciones sin conexión verificada

#### 9.4 Funciones offline soportadas por datos exportados (PRD §38.1)

- Directorio, catálogos, carpetas, productos, búsqueda por carpeta/catálogo/global, filtros acumulables, equivalencias, miniaturas e imágenes sincronizadas

#### 9.5 Criterio de completitud

- Consulta completa sin red tras sincronización
- Fecha de sincronización visible vía API
- Mutaciones bloqueadas offline

---

### Fase 10 — Pruebas y entrega

**Estado:** ⏳ Pendiente · **Equivale a PRD fase 9**

**Depende de:** Fases 1–9

#### 10.1 Pruebas con archivos reales (PRD §4, §50)

- [ ] Rulemanes — importación, embebidas, búsqueda
- [ ] Catálogo Azul — múltiples hojas, directorio automático
- [ ] Embragues — externas por código, sin macros
- [ ] Combinar/reemplazar lista
- [ ] Búsqueda global, equivalencias, filtros acumulables
- [ ] Visibilidad por rol
- [ ] Offline con sincronización previa

#### 10.2 Rendimiento (RNF §41.1)

- [ ] Búsquedas rápidas; importaciones con progreso; paginación obligatoria

#### 10.3 Seguridad (RNF §41.2)

- [ ] Storage privado, MIME, ZIP seguro, `AuditLog`, ocultamiento real por rol

#### 10.4 Despliegue (RF-004)

- [ ] Producción en `www.rothamelrepuestos.com.ar` (Vercel + Supabase)
- [ ] `prisma migrate deploy` en CI/CD

#### 10.5 Documentación operativa

- [ ] Guía para Pablo: importación, revisión de imágenes, reimportación
- [ ] Runbook de recuperación ante importación fallida

---

## 12. Requerimientos funcionales (mapeo backend)

Mapeo completo de PRD §40 (47 RF).

| ID | Requerimiento | Fase | Estado | Componente principal |
|----|---------------|------|--------|----------------------|
| RF-001 | Autenticación | 2 | ✅ | `AuthService`, Supabase Auth, middleware |
| RF-002 | Roles | 2 | ✅ | `UserService`, `requireRole()` |
| RF-003 | Landing pública | 2 | ✅ | Rutas públicas sin API de catálogos |
| RF-004 | Dominio | 2/10 | ⏳ | `NEXT_PUBLIC_APP_URL`, despliegue producción |
| RF-005 | Estructura Catálogo-Carpeta-Producto | 3 | ⏳ | `CatalogFolder`, `Product`, JSONB |
| RF-006 | Gestión de catálogos | 3 | ⏳ | `CatalogService` (incl. vaciar) |
| RF-007 | Gestión de carpetas | 3 | ⏳ | `FolderService` (incl. vaciar) |
| RF-008 | Gestión de productos | 3/6 | ⏳ | `ProductService` |
| RF-009 | Edición de columnas | 6 | ⏳ | `ProductService`, `ColumnConfigService` |
| RF-010 | Visibilidad de catálogos | 3 | ⏳ | `VisibilityService`, `Catalog` |
| RF-011 | Visibilidad de carpetas | 3 | ⏳ | `VisibilityService`, `CatalogFolder` |
| RF-012 | Visibilidad de columnas | 3 | ⏳ | `VisibilityService`, `FolderColumn` |
| RF-013 | Subida de Excel | 4 | ⏳ | Route Handler upload |
| RF-014 | Respaldo | 4 | ⏳ | Storage + `UploadedFile` |
| RF-015 | Selección de destino | 4 | ⏳ | `CatalogImportService` |
| RF-016 | Creación rápida destino `[+]` | 4 | ⏳ | `CatalogImportService` |
| RF-017 | Análisis de hojas | 4 | ⏳ | `ExcelStructureService` |
| RF-018 | Detección de columnas | 4 | ⏳ | `ExcelStructureService` |
| RF-019 | Campos dinámicos | 3–4 | ⏳ | JSONB en `Product` |
| RF-020 | Vista previa | 4 | ⏳ | `ImportPreview` |
| RF-021 | Coincidencias | 4 | ⏳ | `CatalogImportService` |
| RF-022 | Combinar lista | 4 | ⏳ | `CatalogImportService` |
| RF-023 | Reemplazar lista | 4 | ⏳ | `CatalogImportService` |
| RF-024 | Importar lista vacía | 4 | ⏳ | `CatalogImportService` |
| RF-025 | Confirmaciones | 3–6 | ⏳ | Servicios CRUD + importador |
| RF-026 | Fórmulas | 4 | ⏳ | `ExcelStructureService` |
| RF-027 | Macros | 4 | ⏳ | Validación importador |
| RF-028 | Imágenes embebidas | 5 | ⏳ | `ImageExtractionService` |
| RF-029 | Imágenes externas | 5 | ⏳ | `ImageMatchingService` |
| RF-030 | Imágenes múltiples | 5 | ⏳ | `ProductImage` |
| RF-031 | Revisión de imágenes | 5 | ⏳ | API image-review |
| RF-032 | Modal de imagen | 5 | ⏳ | URLs firmadas imagen completa |
| RF-033 | Equivalencias | 6–7 | ⏳ | `EquivalenceService` |
| RF-034 | Normalización | 7 | ⏳ | `search/normalize.ts` |
| RF-035 | Búsqueda por carpeta | 7 | ⏳ | `SearchService` |
| RF-036 | Búsqueda por catálogo | 7 | ⏳ | `SearchService` |
| RF-037 | Búsqueda global | 7 | ⏳ | `SearchService` |
| RF-038 | Origen del resultado | 7 | ⏳ | Respuesta de búsqueda |
| RF-039 | Filtros acumulables | 7 | ⏳ | `ColumnFilterService` |
| RF-040 | Pills de filtros activos | 7 | ⏳ | `ColumnFilterService` |
| RF-041 | Limpieza de filtros | 7 | ⏳ | `ColumnFilterService` |
| RF-042 | Configuración de columnas | 3 | ⏳ | `ColumnConfigService` |
| RF-043 | Archivos subidos | 8 | ⏳ | `UploadedFileService` |
| RF-044 | Publicación segura | 4 | ⏳ | Estados `ImportJob` §10.1 |
| RF-045 | Consulta offline | 9 | ⏳ | `OfflineSyncService` |
| RF-046 | Bloqueo offline | 9 | ⏳ | Guards de mutación |
| RF-047 | Sincronización | 9 | ⏳ | `OfflineSyncManifest`, endpoints sync |

---

## 13. Requerimientos no funcionales (backend)

### 13.1 Rendimiento (PRD §41.1)

- Búsquedas habituales con respuesta rápida (índices en códigos normalizados y texto indexado)
- Paginación o virtualización en tablas de productos
- Miniaturas en lugar de imágenes completas en listados
- Búsqueda global con índices PostgreSQL
- Importaciones extensas con indicador de progreso
- No cargar todos los productos en una sola respuesta
- Filtros por columna fluidos con debounce (250–300 ms)
- Meta: usuario reduce lista amplia a resultados relevantes en menos de 5 minutos

### 13.2 Seguridad (PRD §41.2)

- Rutas privadas protegidas por middleware
- Acceso correo/contraseña; control de roles
- Supabase Storage privado
- Validación extensión, MIME, tamaño; sanitización de nombres
- Extracción segura de ZIP
- Descargas solo con URL firmada y sesión válida
- Confirmación server-side para eliminaciones destructivas
- `AuditLog` para operaciones importantes
- Protección de datos offline y endpoints de sync
- **Ocultamiento real** de catálogos, carpetas y columnas no visibles para usuario normal

### 13.3 Usabilidad (PRD §41.3 — impacto en APIs)

- Respuestas JSON claras; mensajes de error comprensibles
- Vista previa de importación antes de aplicar
- Informes de importación en lenguaje no técnico

### 13.4 Compatibilidad (PRD §41.4)

- APIs consumibles desde Chrome, Edge y navegadores modernos
- Respuestas JSON consistentes para cliente web y PWA

---

## 14. Criterios de aceptación

Derivados de PRD §50. Estado por área.

### 14.0 Base del sistema (Fase 2) ✅

Ver §11 Fase 2.8 y [`docs/ENDPOINTS.md`](./ENDPOINTS.md).

### 14.1 Catálogos y carpetas

- [ ] Catálogos en directorio automático
- [ ] Cada catálogo con carpetas; columnas diferentes por carpeta
- [ ] Nuevos catálogos sin modificar código
- [ ] Crear/editar/borrar/vaciar con confirmación
- [ ] Nombres de carpetas editables solo por admin

### 14.2 Usuarios y permisos

- [x] Admin edita; usuario normal solo ve
- [ ] Controles de edición ocultos para usuario normal (coordinación frontend)
- [ ] Visibilidad de catálogos, carpetas y columnas configurable

### 14.3 Importación

- [ ] Original respaldado; detección de hojas y columnas
- [ ] Selección de catálogo/carpeta destino; creación rápida `[+]`
- [ ] Vista previa; coincidencias resaltadas
- [ ] Carpeta vacía: aplicar lista; con productos: combinar o reemplazar
- [ ] Confirmación en combinar/reemplazar
- [ ] Campos dinámicos conservados; fórmulas como valor calculado; sin macros
- [ ] Importación fallida no reemplaza datos activos

### 14.4 Productos

- [ ] Admin: crear, editar, eliminar, duplicar, todas las columnas
- [ ] Usuario normal: solo visualización

### 14.5 Imágenes

- [ ] Embebidas compatibles; externas por código
- [ ] Ambiguas pendientes; múltiples por producto
- [ ] Imagen dañada no cancela importación
- [ ] Miniaturas y modal ampliado (URLs firmadas)

### 14.6 Búsqueda y filtros

- [ ] Buscador por carpeta; búsqueda por catálogo y global
- [ ] Resultados con catálogo y carpeta; equivalencias en búsqueda
- [ ] Separadores de códigos no impiden resultados
- [ ] Filtros acumulables; pills visibles; limpieza individual
- [ ] Reducción a resultados relevantes en menos de 5 minutos

### 14.7 Archivos

- [ ] Sección archivos subidos; descarga de originales
- [ ] Informes consultables; archivos anteriores respaldados

### 14.8 Offline

- [ ] Catálogos/carpetas sincronizados consultables
- [ ] Búsquedas y filtros offline; miniaturas visibles
- [ ] Modificaciones bloqueadas; fecha de sincronización visible

---

## 15. Criterios de éxito

Perspectiva backend de PRD §51:

- [ ] Pablo deja de usar pendrive; ambos locales consultan la misma versión
- [ ] Archivos nuevos desde el panel; directorio automático
- [ ] Hojas Excel → carpetas utilizables; nombres editables
- [ ] Productos buscables sin conocer archivo de origen
- [ ] Equivalencias encontrables; filtros acumulables en menos de 5 minutos
- [ ] Imágenes Rulemanes, Catálogo Azul y Embragues sin rutas locales
- [ ] Admin corrige datos e imágenes; oculta catálogos/carpetas/columnas
- [ ] Usuario normal ve, busca y filtra sin editar
- [ ] Originales respaldados; consulta offline tras sincronización
- [ ] Sistema comprensible para Pablo y su hermano

---

## 16. Fuera de alcance

PRD §49 — no se implementará en backend (MVP ni fases documentadas):

- Ejecución de macros VBA
- Edición de archivos Excel desde la web
- Edición offline / sincronización de modificaciones offline
- OCR; inteligencia artificial; búsqueda semántica
- Aplicación móvil nativa; multiempresa
- Facturación, stock, ventas, pagos, integración contable o con proveedores
- Conversión automática de cualquier estructura sin configuración
- Reconocimiento visual de imágenes; edición avanzada de fotografías
- **NestJS**

---

## 17. Condiciones y supuestos

PRD §52:

- Pablo explica significado de columnas particulares (mapeo y filtros).
- Pablo confirma columnas visibles, filtrables y buscables para usuarios normales.
- Pablo proporciona imágenes externas con nombres originales (Embragues).
- Estructura de carpetas de muestra se conserva durante análisis.
- Asociaciones de imágenes pueden requerir revisión manual.
- No se garantiza valor calculado almacenado en todas las fórmulas Excel.
- No se ejecutarán macros.
- Filtros definitivos se acordarán por carpeta; filtros globales tras mapear campos comunes.
- Modo offline requiere sincronización previa con conexión.
- Primera importación puede requerir configuración y asistencia de GRG.
- Catálogos nuevos pueden reutilizar configuraciones de estructuras similares.
- Excel muy diferentes pueden requerir configuración adicional.
- NestJS excluido de toda la arquitectura presente y futura.
- Rol `CONSULTA` en código = usuario normal (`USER`) del PRD.

---

## Referencias

- Producto completo: [`docs/PRD.md`](./PRD.md)
- API y convenciones: [`docs/ENDPOINTS.md`](./ENDPOINTS.md)
- README del repositorio: [`README.md`](../README.md)
- Schema Prisma: [`prisma/schema.prisma`](../prisma/schema.prisma)
- Cliente DB: [`src/server/database/prisma.ts`](../src/server/database/prisma.ts)
