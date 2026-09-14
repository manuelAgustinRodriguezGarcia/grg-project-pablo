# Facturación Fase 1 — Navegación, Dashboard y hub

## Goal

Agregar la base visual del módulo de Facturación: Inicio/Dashboard en el SideNav, sección Facturación como hub con grid, subrutas con pill nav fija, y permisos solo-admin. Contenido con placeholders (data ficticia).

## Scope

- SideNav: Inicio + Facturación (ítems `adminOnly`).
- Rutas `/admin/inicio` y `/admin/facturacion/*`.
- Home post-login role-aware vía `/admin`.
- Placeholders de dashboard y páginas de subsección.
- Out of scope: CRUD real, Prisma clients/rubros, ARCA, PDFs, métricas reales.

## Decisions

- SideNav: un solo link **Facturación** → hub (no submenú en sidebar).
- Hub: grid de 6 botones grandes (icono + label + color tenue).
- Pill nav sticky solo dentro de subsecciones (no en el hub).
- `ADMIN_HOME_PATH = "/admin"`; `/admin` redirige ADMIN → `/admin/inicio`, USUARIO → `/admin/catalogos`.
- Inicio y Facturación: `requireAdminOrRedirect`.

## Routes

| Ruta | Contenido |
| --- | --- |
| `/admin` | Redirect por rol |
| `/admin/inicio` | Dashboard placeholders |
| `/admin/facturacion` | Hub grid |
| `/admin/facturacion/clientes` | Placeholder + pill nav |
| `/admin/facturacion/rubros` | Placeholder + pill nav |
| `/admin/facturacion/nueva-factura` | Placeholder + pill nav |
| `/admin/facturacion/comprobantes` | Placeholder + pill nav |
| `/admin/facturacion/pagos` | Placeholder + pill nav |
| `/admin/facturacion/configuracion-fiscal` | Placeholder + pill nav |

## Feature layout

- `src/features/billing/` — data de nav, placeholders, componentes UI (hub, pill nav, dashboard).
- `src/app/admin/facturacion/(secciones)/` — layout con pill nav + pages.

## SideNav order

1. Inicio (`/admin/inicio`, adminOnly)
2. Catálogos
3. Precios
4. Facturación (`/admin/facturacion`, adminOnly)
5. Archivos (adminOnly)
6. Usuarios (adminOnly)

## Permissions

- Nav items filtrados con `adminOnly` (existente).
- Pages/layouts de inicio y facturación llaman `requireAdminOrRedirect` (no-admin → `/admin/catalogos`).
