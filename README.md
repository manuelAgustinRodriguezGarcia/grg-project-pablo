# 🚛 Sistema Web de Catálogos Técnicos de Repuestos

Plataforma web privada para **administrar y consultar catálogos técnicos** de repuestos para camiones y vehículos pesados. Reemplaza el flujo actual de archivos Excel transportados en pendrive por una fuente centralizada, segura y accesible desde distintas ubicaciones.

> 📄 Documentación completa del producto: [`docs/PRD.md`](docs/PRD.md)

---

## 📋 Contexto

Pablo administra múltiples catálogos técnicos en Excel (Rulemanes, Catálogo Azul, Embragues, etc.). Cada archivo puede tener hojas, columnas, fórmulas, imágenes embebidas o externas y macros VBA. Hoy actualiza los archivos, los copia en un pendrive y los lleva ~60 km para mantener sincronizados dos locales.

Eso genera:

- 🔄 Duplicación de archivos y versiones desactualizadas
- 💾 Dependencia de dispositivos físicos y rutas locales de Windows
- ⏱️ Pérdida de tiempo en traslados
- 🔍 Búsquedas fragmentadas entre múltiples archivos

**Este sistema centraliza todo en la web** para que Pablo, su hermano y otros usuarios autorizados consulten la misma información actualizada sin copias locales.

---

## ✨ Características principales

| Área | Descripción |
|------|-------------|
| 📂 **Catálogos flexibles** | Cada Excel se convierte en catálogo; cada hoja, en sección con columnas y reglas propias |
| 📥 **Importación guiada** | Subida de `.xlsx` / `.xlsm`, detección de hojas, mapeo, vista previa y publicación segura |
| 🖼️ **Imágenes** | Extracción embebida, importación por ZIP, asociación por código y revisión manual |
| 🔎 **Búsqueda** | Por sección, por catálogo y global, con normalización de códigos y equivalencias |
| 🎛️ **Filtros** | Particulares por sección y globales entre catálogos |
| 📴 **Modo offline** | PWA con consulta en lectura, búsquedas y miniaturas sincronizadas |
| 🔐 **Acceso privado** | Landing pública + catálogos protegidos por autenticación y roles |

### Principios del producto

- **Flexibilidad** — Sin estructura fija de Excel; cada catálogo conserva su forma
- **Preservación** — Archivos originales, columnas, fórmulas (valor calculado) e imágenes respaldados
- **Simplicidad** — Asistentes guiados para usuarios no técnicos
- **Seguridad** — Catálogos privados; solo usuarios autenticados

---

## 🏗️ Modelo de dominio

```text
Catálogo
└── Sección (generalmente una hoja de Excel)
    └── Registro (fila de datos: producto, repuesto, equivalencia, etc.)
```

**Ejemplos de catálogos:** Rulemanes · Catálogo Azul · Embragues

---

## 👥 Usuarios y roles

| Rol | Permisos |
|-----|----------|
| 🌐 **Visitante** | Solo landing institucional pública |
| 👁️ **Consulta** | Directorio, catálogos, búsquedas, filtros, imágenes y modo offline |
| ⚙️ **Administrador** | Todo lo anterior + importación, edición, configuración de columnas/filtros y gestión de usuarios |

---

## 🛠️ Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | [Next.js](https://nextjs.org) 16 · React 19 · TypeScript · SCSS Modules |
| UI / datos | TanStack Table · React Hook Form · Zod |
| Backend | Route Handlers · Server Actions · Services · Repositories |
| Base de datos | PostgreSQL · [Prisma](https://www.prisma.io) 7 · JSONB |
| Infraestructura | [Supabase](https://supabase.com) (Auth, Storage privado) |
| Excel | ExcelJS (importación y análisis) |
| Offline | PWA · Service Worker · IndexedDB |

> ⚠️ **NestJS no forma parte de este proyecto** (MVP ni fases futuras).

---

## 📁 Estructura prevista

```text
src/
├── app/
│   ├── (public)/      # Landing
│   ├── auth/          # Autenticación
│   └── admin/         # Panel privado
├── features/          # auth, catalogs, imports, search, offline…
├── shared/            # Componentes, hooks, utils, types
└── server/            # services, repositories, importers, storage
```

---

## 🚀 Desarrollo local

### Requisitos

- Node.js 20+
- [pnpm](https://pnpm.io)
- Proyecto en [Supabase](https://supabase.com) con PostgreSQL

### Instalación

```bash
# Clonar e instalar dependencias
pnpm install

# Crear .env en la raíz del proyecto (no se commitea)
```

Variables de entorno requeridas:

| Variable | Uso |
|----------|-----|
| `DATABASE_URL` | Conexión pooled a PostgreSQL (Supabase + Prisma) |
| `DIRECT_URL` | Conexión directa para migraciones de Prisma |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (cliente) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (solo servidor; Storage y tareas admin) |

> 🔑 Las credenciales de Supabase Auth se usan en §2.3; Storage ya está operativo (§2.2).

### Base de datos

```bash
pnpm db:generate   # Generar cliente Prisma
pnpm db:migrate    # Aplicar migraciones (desarrollo)
pnpm db:studio     # Abrir Prisma Studio
```

### Servidor de desarrollo

```bash
pnpm dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### Otros scripts

```bash
pnpm build    # Build de producción
pnpm start    # Servidor de producción
pnpm lint     # ESLint
```

---

## 🗺️ Roadmap

| Fase | Estado | Contenido |
|------|--------|-----------|
| 1 | ✅ | Análisis y definición con Pablo |
| 2 | 🚧 | Base: proyecto, DB, auth, landing, directorio |
| 3 | ⏳ | Catálogos, secciones y tablas dinámicas |
| 4 | ⏳ | Importador Excel con publicación segura |
| 5 | ⏳ | Imágenes embebidas y externas |
| 6 | ⏳ | Administración manual de registros |
| 7 | ⏳ | Búsqueda y filtros |
| 8 | ⏳ | Archivos subidos y reimportación |
| 9 | ⏳ | Modo offline (PWA) |
| 10 | ⏳ | Pruebas, capacitación y despliegue |

---

## 🎯 Criterios de éxito

El proyecto se considerará exitoso cuando:

- ✅ Pablo deje de usar el pendrive como medio de actualización
- ✅ Ambos locales consulten la misma versión central
- ✅ Los archivos nuevos se incorporen desde el panel sin tocar código
- ✅ El directorio se genere automáticamente
- ✅ Los productos se busquen sin conocer el archivo de origen
- ✅ Las imágenes (embebidas y externas) se visualicen sin rutas locales
- ✅ La información pueda consultarse sin conexión

---

## 🚫 Fuera de alcance (MVP)

No se incluyen: ejecución de macros VBA, edición de Excel desde la web, OCR, IA, búsqueda semántica, app móvil nativa, multiempresa, facturación, stock, ventas ni integraciones contables.

---

## 📄 Licencia

Proyecto privado — desarrollado para Pablo R., casa de repuestos, Chaco, Argentina.
