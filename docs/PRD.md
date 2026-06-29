# PRD — Sistema Web de Catálogos Técnicos de Repuestos

## Tabla de contenidos

* [Parte I — Contexto y visión](#parte-i--contexto-y-visión)

  * [1. Información general](#1-información-general)
  * [2. Contexto actual](#2-contexto-actual)
  * [3. Estado actual del desarrollo](#3-estado-actual-del-desarrollo)
  * [4. Archivos de muestra analizados](#4-archivos-de-muestra-analizados)
  * [5. Objetivos](#5-objetivos)
  * [6. Principios del producto](#6-principios-del-producto)

* [Parte II — Modelo de dominio y usuarios](#parte-ii--modelo-de-dominio-y-usuarios)

  * [7. Estructura conceptual del contenido](#7-estructura-conceptual-del-contenido)
  * [8. Usuarios y permisos](#8-usuarios-y-permisos)
  * [9. Visibilidad por rol](#9-visibilidad-por-rol)

* [Parte III — Experiencia de usuario](#parte-iii--experiencia-de-usuario)

  * [10. Landing pública](#10-landing-pública)
  * [11. Autenticación](#11-autenticación)
  * [12. Panel privado](#12-panel-privado)
  * [13. Navegación de catálogos y carpetas](#13-navegación-de-catálogos-y-carpetas)
  * [14. Gestión de catálogos y carpetas](#14-gestión-de-catálogos-y-carpetas)
  * [15. Gestión manual de productos](#15-gestión-manual-de-productos)
  * [15.1 Configuración manual de columnas](#151-configuración-manual-de-columnas)
  * [15.2 Ayuda contextual en cabeceras de columna](#152-ayuda-contextual-en-cabeceras-de-columna)
  * [15.3 Sección Precios](#153-sección-precios)

* [Parte IV — Importación de datos](#parte-iv--importación-de-datos)

  * [16. Importación de archivos Excel](#16-importación-de-archivos-excel)
  * [17. Asistente de importación](#17-asistente-de-importación)
  * [18. Combinar, reemplazar e importar listas](#18-combinar-reemplazar-e-importar-listas)
  * [19. Fórmulas de Excel](#19-fórmulas-de-excel)
  * [20. Macros de Visual Basic](#20-macros-de-visual-basic)
  * [21. Publicación segura de importaciones](#21-publicación-segura-de-importaciones)
  * [22. Informe de importación](#22-informe-de-importación)

* [Parte V — Imágenes](#parte-v--imágenes)

  * [23. Gestión de imágenes](#23-gestión-de-imágenes)
  * [24. Imágenes embebidas](#24-imágenes-embebidas)
  * [25. Imágenes externas](#25-imágenes-externas)
  * [26. Formatos de imagen](#26-formatos-de-imagen)
  * [27. Asociación y revisión de imágenes](#27-asociación-y-revisión-de-imágenes)
  * [28. Visualización ampliada de imágenes](#28-visualización-ampliada-de-imágenes)

* [Parte VI — Búsqueda, códigos y filtros](#parte-vi--búsqueda-códigos-y-filtros)

  * [29. Códigos y equivalencias](#29-códigos-y-equivalencias)
  * [30. Normalización de búsqueda](#30-normalización-de-búsqueda)
  * [31. Búsqueda por carpeta](#31-búsqueda-por-carpeta)
  * [32. Búsqueda por catálogo](#32-búsqueda-por-catálogo)
  * [33. Búsqueda global](#33-búsqueda-global)
  * [34. Filtros acumulables por columna](#34-filtros-acumulables-por-columna)
  * [35. Filtros globales](#35-filtros-globales)
  * [36. Configuración de columnas](#36-configuración-de-columnas)

* [Parte VII — Archivos y modo offline](#parte-vii--archivos-y-modo-offline)

  * [37. Archivos subidos](#37-archivos-subidos)
  * [38. Modo offline](#38-modo-offline)
  * [39. Imágenes offline](#39-imágenes-offline)

* [Parte VIII — Requerimientos](#parte-viii--requerimientos)

  * [40. Requerimientos funcionales](#40-requerimientos-funcionales)
  * [41. Requerimientos no funcionales](#41-requerimientos-no-funcionales)

* [Parte IX — Arquitectura técnica](#parte-ix--arquitectura-técnica)

  * [42. Modelo conceptual de datos](#42-modelo-conceptual-de-datos)
  * [43. Estrategia de almacenamiento](#43-estrategia-de-almacenamiento)
  * [44. Stack tecnológico propuesto](#44-stack-tecnológico-propuesto)
  * [45. Arquitectura propuesta](#45-arquitectura-propuesta)
  * [46. Servicios principales](#46-servicios-principales)
  * [47. Flujo resumido de importación](#47-flujo-resumido-de-importación)

* [Parte X — Planificación y cierre](#parte-x--planificación-y-cierre)

  * [48. Roadmap funcional](#48-roadmap-funcional)
  * [49. Funciones fuera del alcance](#49-funciones-fuera-del-alcance)
  * [50. Criterios de aceptación](#50-criterios-de-aceptación)
  * [51. Criterios de éxito](#51-criterios-de-éxito)
  * [52. Condiciones y supuestos](#52-condiciones-y-supuestos)

---

## Parte I — Contexto y visión

### 1. Información general

#### Nombre provisional

Sistema Web de Catálogos Técnicos de Repuestos

#### Cliente

Pablo R.
Casa de repuestos para camiones y vehículos pesados.
Chaco, Argentina.

#### Dominio

El dominio definido para el proyecto será:

```text
www.rothamelrepuestos.com.ar
```

El dominio se encuentra disponible en NIC Argentina al momento de la planificación inicial.

#### Tipo de producto

Aplicación web privada para la administración y consulta de catálogos técnicos, acompañada por una landing institucional pública.

#### Objetivo principal

Reemplazar el sistema actual de archivos Excel transportados físicamente mediante pendrive por una plataforma web centralizada, segura y accesible desde diferentes ubicaciones.

La plataforma deberá permitir que Pablo, su hermano y otros usuarios autorizados consulten la misma información actualizada sin depender de copias locales, pendrives ni traslados físicos.

---

### 2. Contexto actual

Pablo administra múltiples catálogos técnicos mediante archivos Excel.

Cada archivo representa un rubro distinto y puede contener:

* Varias hojas.
* Diferentes cantidades de columnas.
* Criterios de búsqueda particulares.
* Códigos principales.
* Códigos equivalentes.
* Fórmulas.
* Imágenes embebidas.
* Imágenes externas vinculadas mediante rutas locales.
* Macros de Visual Basic utilizadas para mostrar imágenes.

Actualmente Pablo actualiza los archivos, los copia en un pendrive y recorre aproximadamente 60 kilómetros para llevar la versión actualizada a la casa de repuestos de su hermano.

Este procedimiento provoca:

* Dependencia de dispositivos físicos.
* Duplicación de archivos.
* Riesgo de utilizar versiones desactualizadas.
* Posibilidad de pérdida o corrupción del pendrive.
* Dificultad para mantener ambos locales sincronizados.
* Pérdida de tiempo en traslados.
* Búsquedas fragmentadas entre múltiples archivos.
* Dependencia de Excel y de rutas locales específicas.
* Dificultad para incorporar nuevos catálogos de manera ordenada.

---

### 3. Estado actual del desarrollo

Al **25/06/2026** (rama `backend`). Detalle técnico y contratos en [`BACKEND-IMPLEMENTATION.md`](./BACKEND-IMPLEMENTATION.md), [`ENDPOINTS.md`](./ENDPOINTS.md) e importador de catálogos en [`METHOD-IMPORT.md`](./METHOD-IMPORT.md).

#### UI

| Área                                    | Estado                                                      |
| --------------------------------------- | ----------------------------------------------------------- |
| Landing pública (`/`)                   | ✅ Primera versión                                           |
| Login (`/auth/login`)                   | ✅ Funcional                                                 |
| Panel admin (sidebar, layout)           | ✅ Estructura base                                           |
| `/admin/catalogos`                      | ⚠️ `CatalogNavigator` con **datos mock** — APIs REST listas |
| `/admin/precios`                        | ⏳ Nueva sección a implementar                               |
| `/admin/archivos` (historial Excel)     | ⏳ Placeholder — API backend Fase 8 ✅; cablear UI          |
| `/admin/users`, recuperación contraseña | ⏳ Sin página                                                |

#### Backend (fases técnicas 2–7 ✅ · 8–10 ⏳)

| Capacidad                                                | Estado |
| -------------------------------------------------------- | ------ |
| Auth, usuarios, directorio, auditoría                    | ✅      |
| Catálogos, carpetas, columnas, visibilidad               | ✅      |
| Productos (lectura paginada, CRUD manual, equivalencias) | ✅      |
| Importador Excel **catálogos** (publicación segura)      | ✅      |
| Imágenes (extracción, matching, revisión, galería API)   | ✅      |
| Búsqueda y filtros (API)                                 | ✅      |
| Ayuda contextual columnas (API + Storage)                | ✅      |
| Archivos subidos (listado, descarga, reproceso)          | ✅ Backend Fase 8 / ⏳ UI |
| Precios (dominio + importación Excel)                    | ✅ Backend RF-053–059 · ✅ UI admin `/admin/precios` |
| Offline (sync, manifest)                                   | ✅ Backend Fase 9 · ⏳ UI/PWA |

> Las **fases del roadmap PRD (§48)** no coinciden 1:1 con las fases backend. Ver tabla de mapeo en [`BACKEND-IMPLEMENTATION.md` §1.1](./BACKEND-IMPLEMENTATION.md#11-roadmap-prd--backend).  
> Importación soporta **catálogos** (`CATALOG_FOLDER`) y **precios** (`PRICE_LIST`). Destino precios: sin pipeline de imágenes. Detalle: [`METHOD-IMPORT.md`](./METHOD-IMPORT.md).

Este PRD define el criterio funcional acordado con Pablo; el estado de implementación backend se mantiene sincronizado en [`BACKEND-IMPLEMENTATION.md`](./BACKEND-IMPLEMENTATION.md), [`ENDPOINTS.md`](./ENDPOINTS.md) y [`METHOD-IMPORT.md`](./METHOD-IMPORT.md) (import catálogos).

---

### 4. Archivos de muestra analizados

#### 4.1 Rulemanes

Características identificadas:

* Archivo `.xlsx`.
* Tres hojas.
* Algunas hojas contienen imágenes pegadas directamente en las filas.
* No depende de una carpeta externa de imágenes.
* Las hojas poseen estructuras y columnas propias.

Estructura esperada dentro del sistema:

```text
Catálogo: Rulemanes
├── Carpeta: Rodamientos
├── Carpeta: Tensores pesados
└── Carpeta: Tensores livianos
```

Cada carpeta contendrá su propia lista de productos.

---

#### 4.2 Catálogo Azul

Características identificadas:

* Archivo `.xlsx`.
* Gran cantidad de hojas.
* La muestra recibida posee múltiples rubros y una hoja de índice.
* Pablo indicó que el catálogo completo puede contener aproximadamente 35 pestañas.
* Las imágenes están pegadas directamente en las hojas.
* Algunas filas pueden tener varias imágenes relacionadas.
* La hoja de índice funciona actualmente como carátula o directorio manual.

En la aplicación web, esa carátula no deberá mantenerse manualmente. El sistema deberá generar el directorio automáticamente según los catálogos y carpetas disponibles.

---

#### 4.3 Embragues

Características identificadas:

* Archivo `.xlsm`.
* Tres hojas principales.
* Dos hojas utilizan imágenes almacenadas en una carpeta externa.
* Las imágenes se relacionan mediante códigos o nombres de archivo.
* El archivo contiene macros de Visual Basic.
* Las macros muestran una imagen al desplazarse por determinadas filas.
* Las rutas dependen actualmente de una carpeta local de Windows.

Estructura esperada dentro del sistema:

```text
Catálogo: Embragues
├── Carpeta: Placas
├── Carpeta: Discos
└── Carpeta: Crapodinas
```

Ejemplo de ruta utilizada por el sistema actual:

```text
Mis documentos\Imagenes catalogos\Embragues
```

La plataforma web no deberá ejecutar estas macros ni depender de rutas locales.

El comportamiento deberá reemplazarse por:

* Asociación de imágenes mediante código.
* Miniatura en la tabla o detalle.
* Apertura ampliada de la imagen.
* Almacenamiento centralizado.

---

### 5. Objetivos

#### 5.1 Objetivo general

Crear una plataforma web que permita:

* Centralizar catálogos de diferentes estructuras.
* Dividir cada catálogo en carpetas internas.
* Consultar la información desde ambos locales.
* Incorporar nuevos archivos sin modificar el código.
* Administrar productos manualmente.
* Buscar dentro de cada carpeta.
* Buscar dentro de cada catálogo.
* Buscar simultáneamente en todos los catálogos.
* Gestionar códigos equivalentes.
* Procesar imágenes embebidas y externas.
* Mantener los archivos originales respaldados.
* Consultar información sin conexión en modo lectura.
* Gestionar listas de precios independientes de los catálogos.

---

#### 5.2 Objetivos específicos

* Eliminar el traslado de archivos mediante pendrive.
* Mantener una única versión central de los catálogos.
* Permitir que cada archivo conserve su estructura particular.
* Representar cada hoja relevante como una carpeta configurable.
* Permitir editar nombres de catálogos y carpetas.
* Permitir editar el nombre visible de cada columna sin perder su nombre original importado.
* Permitir agregar ayuda contextual opcional a columnas mediante texto, imagen o ambos.
* Generar automáticamente el directorio general.
* Permitir agregar nuevos catálogos desde el panel.
* Permitir agregar nuevas carpetas dentro de cada catálogo.
* Permitir reemplazar o combinar listas de productos.
* Permitir importar y actualizar listas de precios desde Excel.
* Procesar archivos Excel con estructuras variables.
* Conservar columnas que no estén estandarizadas.
* Extraer imágenes pegadas dentro de Excel para catálogos.
* Asociar imágenes externas mediante códigos o nombres para catálogos.
* Omitir procesamiento de imágenes en la sección Precios.
* Permitir correcciones manuales de asociaciones.
* Normalizar códigos para mejorar las búsquedas.
* Permitir filtros acumulables por columna.
* Permitir que el usuario encuentre un producto en menos de 5 minutos mediante búsqueda y filtros.
* Permitir controlar la visibilidad de catálogos, carpetas, listas de precios y columnas para usuarios normales.
* Mantener una interfaz simple para usuarios no técnicos.

---

### 6. Principios del producto

#### 6.1 Flexibilidad

La plataforma no deberá depender de una estructura fija de Excel.

Cada catálogo, carpeta o lista de precios podrá tener:

* Columnas diferentes.
* Filtros diferentes.
* Campos buscables diferentes.
* Distintas formas de asociar imágenes, cuando corresponda.
* Reglas particulares de visualización.

---

#### 6.2 Preservación de la información

El sistema deberá conservar:

* Archivo original.
* Nombre original de columnas.
* Nombre visible editable por el administrador.
* Contenido original de las celdas.
* Saltos de línea relevantes.
* Códigos escritos por Pablo.
* Fórmulas originales cuando sea necesario.
* Valor calculado de las fórmulas.
* Imágenes de productos, cuando correspondan.
* Imágenes de ayuda de columnas, cuando existan.
* Relación de cada imagen de producto con su fila y columna de origen.

---

#### 6.3 Simplicidad de uso

La plataforma deberá evitar que Pablo necesite conocimientos de bases de datos o programación.

Las operaciones complejas deberán presentarse mediante asistentes guiados, especialmente:

* Importación de Excel.
* Selección de tipo de destino.
* Selección de catálogo y carpeta destino.
* Selección de lista de precios destino.
* Creación de nuevas carpetas.
* Creación de nuevas listas de precios.
* Reemplazo o combinación de listas.
* Configuración de visibilidad.
* Configuración de columnas.
* Revisión de imágenes.
* Carga de ayudas contextuales.

---

#### 6.4 Seguridad

Los catálogos y listas de precios no serán públicos.

Solo podrán acceder usuarios autenticados y autorizados.

---

#### 6.5 Rapidez operativa

El sistema deberá estar diseñado para que un usuario pueda filtrar una lista amplia de productos y encontrar opciones relevantes en menos de 5 minutos, incluso cuando el cliente no conozca el código exacto del repuesto.

---

## Parte II — Modelo de dominio y usuarios

### 7. Estructura conceptual del contenido

El sistema utilizará tres niveles principales visibles para catálogos:

```text
Catálogo
└── Carpeta
    └── Producto
```

La sección Precios utilizará una estructura independiente:

```text
Lista de precios
└── Ítem de precio
```

---

#### 7.1 Catálogo

Representa un rubro principal o agrupación general.

Ejemplos:

* Rulemanes.
* Embragues.
* Frenos.
* Encendido.
* Catálogo Azul.

Un catálogo puede contener una o varias carpetas.

---

#### 7.2 Carpeta

Representa una subdivisión interna de un catálogo.

Generalmente una carpeta corresponde a una hoja del Excel, aunque también podrá crearse manualmente desde el panel.

Ejemplos:

```text
Rulemanes
├── Rodamientos
├── Tensores pesados
└── Tensores livianos
```

```text
Embragues
├── Placas
├── Discos
└── Crapodinas
```

Cada carpeta podrá tener sus propias:

* Columnas.
* Productos.
* Reglas de búsqueda.
* Imágenes.
* Filtros.
* Configuración de visibilidad.
* Configuraciones de visualización.

Los nombres de las carpetas deberán ser editables únicamente por el administrador.

Ejemplo:

```text
Tensores livianos → Tens. livianos
```

---

#### 7.3 Producto

Representa una fila de datos dentro de una carpeta.

Según el catálogo, un producto puede representar:

* Un repuesto.
* Una aplicación.
* Una equivalencia.
* Un conjunto técnico.
* Una combinación de códigos.
* Una pieza con imágenes asociadas.

Todos los productos deberán poder conservar columnas dinámicas provenientes de Excel.

---

#### 7.4 Lista de precios

Representa una tabla independiente de precios importada desde Excel.

Una lista de precios no pertenece a un catálogo ni a una carpeta.

Ejemplos:

* Lista general de precios.
* Lista de precios de proveedor.
* Lista de precios de repuestos pesados.
* Lista de precios por marca.

Cada lista de precios podrá tener:

* Nombre.
* Descripción opcional.
* Columnas dinámicas.
* Ítems de precio.
* Archivo de origen.
* Fecha de actualización.
* Configuración de visibilidad.

---

#### 7.5 Ítem de precio

Representa una fila dentro de una lista de precios.

Puede contener campos como:

* Código.
* Descripción.
* Precio.
* Monto.
* Marca.
* Aplicación.
* Proveedor.
* Observaciones.
* Otros campos dinámicos detectados desde Excel.

Los ítems de precio no tendrán imágenes asociadas.

---

#### 7.6 Relación conceptual

```text
Catálogo: Rulemanes
├── Carpeta: Rodamientos
│   ├── Producto 1
│   ├── Producto 2
│   └── Producto 3
│
├── Carpeta: Tensores pesados
│   ├── Producto 1
│   └── Producto 2
│
└── Carpeta: Tensores livianos
    ├── Producto 1
    └── Producto 2
```

```text
Precios
├── Lista de precios: Lista general
│   ├── Ítem 1
│   ├── Ítem 2
│   └── Ítem 3
│
└── Lista de precios: Proveedor X
    ├── Ítem 1
    └── Ítem 2
```

---

### 8. Usuarios y permisos

El sistema tendrá dos tipos principales de usuarios:

1. Administrador.
2. Usuario normal.

Ambos accederán mediante correo electrónico y contraseña.

---

#### 8.1 Visitante público

Podrá acceder únicamente a la landing institucional.

No podrá:

* Consultar catálogos.
* Consultar carpetas.
* Consultar productos.
* Consultar precios.
* Ver información técnica privada.
* Descargar archivos.
* Acceder al panel privado.

---

#### 8.2 Administrador

El administrador podrá:

* Iniciar sesión.
* Cerrar sesión.
* Consultar todos los catálogos.
* Ver catálogos ocultos para usuarios normales.
* Crear catálogos.
* Editar nombres de catálogos.
* Borrar catálogos.
* Vaciar catálogos.
* Activar o desactivar visibilidad de catálogos para usuarios normales.
* Crear carpetas dentro de catálogos.
* Editar nombres de carpetas.
* Borrar carpetas.
* Vaciar carpetas.
* Activar o desactivar visibilidad de carpetas para usuarios normales.
* Subir archivos Excel.
* Importar productos a una carpeta.
* Combinar listas de productos.
* Reemplazar listas de productos.
* Crear productos manualmente.
* Editar productos.
* Eliminar productos.
* Editar todas las columnas de un producto.
* Editar el nombre visible de cada columna.
* Consultar el nombre original de cada columna como dato no editable.
* Configurar columnas visibles para usuarios normales.
* Configurar columnas buscables.
* Configurar columnas filtrables.
* Agregar texto de ayuda opcional a una columna.
* Agregar imagen de ayuda opcional a una columna.
* Reemplazar o eliminar la imagen de ayuda de una columna.
* Reemplazar imágenes de productos.
* Eliminar imágenes de productos.
* Agregar imágenes de productos.
* Administrar la sección Precios.
* Crear listas de precios.
* Editar listas de precios.
* Borrar listas de precios.
* Vaciar listas de precios.
* Importar listas de precios desde Excel.
* Combinar listas de precios.
* Reemplazar listas de precios.
* Editar columnas de listas de precios.
* Descargar archivos originales.
* Consultar errores de importación.
* Gestionar usuarios, si se habilita esta función en el panel.

---

#### 8.3 Usuario normal

El usuario normal podrá:

* Iniciar sesión.
* Cerrar sesión.
* Consultar catálogos visibles.
* Consultar carpetas visibles.
* Consultar productos visibles.
* Buscar productos.
* Filtrar productos por columnas visibles y filtrables.
* Abrir imágenes ampliadas de productos.
* Consultar ayudas contextuales de columnas visibles, cuando existan.
* Consultar listas de precios visibles, si el administrador lo permite.
* Filtrar listas de precios visibles según las opciones disponibles.
* Consultar información offline previamente sincronizada.

El usuario normal no podrá:

* Crear catálogos.
* Editar catálogos.
* Borrar catálogos.
* Vaciar catálogos.
* Crear carpetas.
* Editar carpetas.
* Borrar carpetas.
* Vaciar carpetas.
* Crear productos.
* Editar productos.
* Eliminar productos.
* Subir Excel.
* Importar listas.
* Reemplazar listas.
* Combinar listas.
* Reemplazar imágenes.
* Configurar columnas.
* Editar nombres visibles de columnas.
* Editar ayudas contextuales de columnas.
* Modificar visibilidad.
* Crear listas de precios.
* Editar listas de precios.
* Borrar listas de precios.
* Vaciar listas de precios.
* Reemplazar listas de precios.
* Combinar listas de precios.
* Descargar archivos originales, salvo que el administrador lo habilite explícitamente.

Los controles de edición no deberán mostrarse para usuarios normales.

---

### 9. Visibilidad por rol

El sistema deberá permitir controlar qué información ve el usuario normal.

El administrador siempre verá todo.

La visibilidad deberá configurarse en estos niveles:

```text
Catálogo
Carpeta
Columna
Lista de precios
Columna de lista de precios
```

---

#### 9.1 Visibilidad de catálogos

Cada catálogo tendrá un control:

```text
Visible para usuarios normales: Sí / No
```

Si un catálogo está oculto, el usuario normal no podrá verlo ni acceder a sus carpetas o productos.

---

#### 9.2 Visibilidad de carpetas

Cada carpeta tendrá un control:

```text
Visible para usuarios normales: Sí / No
```

Si una carpeta está oculta, el usuario normal no podrá verla dentro del catálogo, aunque el catálogo esté visible.

---

#### 9.3 Visibilidad de columnas

Cada columna tendrá un control:

```text
Visible para usuarios normales: Sí / No
```

Esto permitirá ocultar información interna como:

* Costos.
* Proveedor.
* Observaciones internas.
* Notas privadas.
* Códigos internos.
* Columnas administrativas.
* Información que Pablo no quiera mostrar al usuario normal.

---

#### 9.4 Buscable y filtrable

La visibilidad de una columna no será lo mismo que su capacidad de búsqueda o filtrado.

Cada columna podrá configurarse como:

* Visible para usuario normal.
* Buscable.
* Filtrable.
* Buscable globalmente.
* Filtrable globalmente.
* Editable por administrador.

Ejemplo:

```text
Montadora → visible, buscable, filtrable.
Cantidad de estrías → visible, buscable, filtrable.
Imagen → visible, no filtrable.
Última actualización → visible para admin, no visible para user.
Observaciones internas → visible para admin, no visible para user.
```

---

#### 9.5 Ayuda contextual de columnas

Cada columna podrá tener una ayuda contextual opcional.

La ayuda contextual podrá contener:

* Texto descriptivo.
* Imagen descriptiva.
* Texto e imagen al mismo tiempo.

Esta ayuda servirá para explicar el significado de una cabecera de columna cuando el nombre no sea suficientemente claro.

Ejemplo:

```text
Columna: Entre tapa

Ayuda:
Texto: Explica la medida o referencia técnica correspondiente a la pieza.
Imagen: Muestra visualmente qué parte de la pieza se considera “entre tapa”.
```

La ayuda contextual será completamente opcional.

Si una columna no tiene texto de ayuda ni imagen de ayuda, no deberá mostrarse ningún ícono adicional en la cabecera.

Si una columna tiene texto de ayuda o imagen de ayuda, deberá mostrarse un ícono `Info` de Lucide junto al nombre visible de la columna.

El ícono de ayuda deberá estar disponible para:

* Administradores.
* Usuarios normales, únicamente cuando la columna sea visible para ellos.

---

#### 9.6 Visibilidad de listas de precios

Cada lista de precios podrá tener un control:

```text
Visible para usuarios normales: Sí / No
```

Si una lista de precios está oculta, el usuario normal no podrá verla ni acceder a sus ítems.

---

## Parte III — Experiencia de usuario

### 10. Landing pública

La aplicación contará con una landing institucional básica ya desarrollada en su primera versión.

Deberá incluir:

* Logo o marca temporal.
* Nombre del negocio.
* Título principal.
* Descripción.
* Datos de contacto.
* Horarios.
* Dirección.
* Ubicación.
* Marcas comercializadas.
* Botón de contacto por WhatsApp.
* Acceso al sistema mediante botón “Iniciar Sesión”.

La landing no mostrará información privada de los catálogos ni de las listas de precios.

Los textos dirigidos al cliente deberán utilizar un tono formal y tratarlo de “Usted”.

El dominio público será:

```text
www.rothamelrepuestos.com.ar
```

---

### 11. Autenticación

El sistema deberá permitir:

* Inicio de sesión con correo electrónico y contraseña.
* Cierre de sesión.
* Recuperación de contraseña.
* Protección de rutas privadas.
* Persistencia segura de la sesión.
* Control de permisos según rol.
* Desactivación de usuarios.
* Cierre de sesión en el dispositivo.
* Eliminación de datos offline al cerrar sesión, cuando corresponda.

La página de login ya se encuentra implementada en su primera versión.

---

### 12. Panel privado

Después de iniciar sesión, el usuario accederá al panel privado.

El panel tendrá una navegación lateral con acceso a:

```text
Catálogos
Precios
Archivos
```

La sección **Catálogos** concentrará la consulta y gestión de catálogos, carpetas y productos.

La sección **Precios** concentrará la consulta y gestión de listas de precios importadas desde Excel. Esta sección será independiente de los catálogos y no tendrá relación directa con la estructura Catálogo → Carpeta → Producto.

La sección **Archivos** concentrará la administración de archivos Excel subidos, historial e informes de importación.

La sección Precios deberá seguir el mismo criterio general de tablas dinámicas del sistema, pero con diferencias funcionales:

* No reconocerá imágenes.
* No extraerá imágenes embebidas.
* No permitirá asociar imágenes a registros.
* No utilizará modal de imagen de producto.
* Reconocerá columnas, filas y campos del Excel.
* Permitirá columnas variables según cada archivo.
* Permitirá combinar o reemplazar listas importadas.
* Permitirá administrar columnas de la lista.
* Permitirá editar nombre visible, visibilidad y ayuda contextual de columnas.

---

### 13. Navegación de catálogos y carpetas

El usuario podrá navegar mediante:

* Selector de catálogo.
* Selector de carpeta.
* Tabla de productos.
* Buscador global.
* Buscador dentro del catálogo o carpeta.
* Filtros acumulables por columna.
* Pills de filtros activos.
* Ayuda contextual en cabeceras de columna, cuando exista.

Ejemplo:

```text
Catálogo: Embragues
Carpeta: Discos
Tabla: Productos de Discos
```

Cada carpeta podrá abrirse como una tabla independiente.

En catálogos con muchas carpetas se podrá utilizar:

* Selector desplegable.
* Menú lateral interno.
* Buscador de carpetas.
* Pestañas, si el diseño lo requiere.

---

### 14. Gestión de catálogos y carpetas

#### 14.1 Gestión de catálogos

El administrador podrá:

* Crear un catálogo.
* Editar su nombre.
* Editar su descripción.
* Cambiar su orden.
* Ocultarlo para usuarios normales.
* Mostrarlo para usuarios normales.
* Borrarlo.
* Vaciarlo.
* Asociarlo con archivos subidos.

---

#### 14.2 Borrar catálogo

Borrar un catálogo eliminará:

* El catálogo.
* Sus carpetas.
* Sus productos.
* Sus relaciones internas.

Esta acción deberá mostrar un modal de confirmación.

El archivo Excel original no deberá eliminarse automáticamente.

---

#### 14.3 Vaciar catálogo

Vaciar un catálogo eliminará los productos contenidos en sus carpetas, pero conservará:

* El catálogo.
* Sus carpetas.
* La configuración de columnas, cuando corresponda.
* La configuración de visibilidad, cuando corresponda.

Esta acción deberá mostrar un modal de confirmación.

---

#### 14.4 Gestión de carpetas

El administrador podrá:

* Crear carpetas manualmente.
* Crear carpetas desde hojas de Excel.
* Renombrar una carpeta.
* Cambiar su orden.
* Ocultarla para usuarios normales.
* Mostrarla para usuarios normales.
* Configurar sus columnas.
* Configurar su buscador.
* Configurar sus filtros.
* Borrarla.
* Vaciarla.

---

#### 14.5 Borrar carpeta

Borrar una carpeta eliminará:

* La carpeta.
* Sus productos.
* Sus imágenes asociadas, según estrategia de almacenamiento.
* Sus configuraciones propias.

Esta acción deberá mostrar un modal de confirmación.

---

#### 14.6 Vaciar carpeta

Vaciar una carpeta eliminará todos sus productos, pero conservará:

* El nombre de la carpeta.
* Su pertenencia al catálogo.
* Su configuración.
* Su visibilidad.

Esta acción deberá mostrar un modal de confirmación.

---

#### 14.7 Hojas auxiliares

Durante una importación, una hoja podrá marcarse como:

* Carpeta importable.
* Hoja índice.
* Hoja auxiliar.
* Hoja ignorada.

Las hojas índice de Excel no tendrán que convertirse obligatoriamente en carpetas dentro del sistema.

---

### 15. Gestión manual de productos

El administrador podrá:

* Crear un producto.
* Editar un producto.
* Eliminar un producto.
* Duplicar un producto.
* Editar campos dinámicos.
* Editar cualquier columna importada.
* Agregar equivalencias.
* Eliminar equivalencias.
* Agregar imágenes.
* Reemplazar imágenes.
* Eliminar imágenes.
* Consultar fecha de creación.
* Consultar fecha de modificación.

Los formularios deberán generarse según la configuración de columnas de cada carpeta.

El usuario normal solo podrá visualizar los productos. No tendrá acceso a controles de edición.

---

### 15.1 Configuración manual de columnas

El administrador podrá configurar las columnas de cada carpeta o tabla dinámica.

Cada columna tendrá:

* Nombre original.
* Nombre visible.
* Visibilidad para usuario normal.
* Estado buscable.
* Estado filtrable.
* Texto de ayuda opcional.
* Imagen de ayuda opcional.

El **nombre original** provendrá del Excel y deberá conservarse como referencia interna.

El nombre original:

* No será editable.
* Deberá poder visualizarse en el panel de edición de columna.
* Servirá para rastrear la columna original importada.

El **nombre visible** será la cabecera que se mostrará en la tabla.

El nombre visible:

* Será obligatorio.
* Será editable únicamente por el administrador.
* Podrá ser distinto del nombre original.
* No deberá alterar el nombre original importado desde Excel.

Ejemplo:

```text
Nombre original: CANT. ESTRIAS
Nombre visible: Cant. de estrías
```

La visibilidad para usuario normal se manejará mediante un toggle.

La ayuda contextual será opcional. Si no se carga texto ni imagen de ayuda, la columna funcionará normalmente y no mostrará ícono de información.

---

### 15.2 Ayuda contextual en cabeceras de columna

Cuando una columna tenga texto de ayuda o imagen de ayuda, la cabecera de la tabla deberá mostrar un ícono `Info` de Lucide junto al nombre visible de la columna.

Ejemplo visual:

```text
Cant. de estrías  [Info]
```

El ícono `Info` solo deberá mostrarse si existe al menos uno de estos datos:

* Texto de ayuda.
* Imagen de ayuda.

Si la columna no tiene ayuda contextual, no deberá mostrarse el ícono.

#### Comportamiento del ícono Info

Al hacer hover o focus sobre el ícono `Info`, se mostrará un popover o tooltip con la ayuda disponible.

Casos posibles:

1. Columna con solo texto de ayuda:

   * El popover mostrará únicamente el texto.

2. Columna con solo imagen de ayuda:

   * El popover mostrará una miniatura o previsualización de la imagen.

3. Columna con texto e imagen de ayuda:

   * El popover mostrará ambos elementos.

En dispositivos móviles, donde no existe hover real, el ícono deberá responder mediante tap o click.

#### Modal de imagen de ayuda

Si la ayuda contextual contiene una imagen, esa imagen deberá ser clickeable.

Al hacer click sobre la imagen de ayuda:

* Se abrirá un modal.
* La imagen se mostrará en tamaño ampliado.
* Si existe texto de ayuda, se mostrará junto a la imagen o debajo de ella.
* Si no existe texto de ayuda, el modal mostrará solo la imagen.
* El modal tendrá una cruz de cierre arriba a la derecha.
* El modal podrá cerrarse con `Escape`.
* El modal podrá cerrarse haciendo click fuera del contenido.

No deberá abrirse un modal vacío.

---

### 15.3 Sección Precios

El sistema contará con una sección privada llamada **Precios**.

La sección Precios será independiente de Catálogos.

No dependerá de:

* Catálogos.
* Carpetas.
* Productos de catálogos.
* Imágenes de productos.
* Galerías.
* Revisión de imágenes.

La sección Precios permitirá administrar listas de precios importadas desde archivos Excel.

Cada lista de precios podrá tener:

* Nombre.
* Descripción opcional.
* Columnas dinámicas.
* Filas o ítems de precio.
* Fecha de última actualización.
* Archivo de origen.
* Estado visible u oculto para usuario normal, si corresponde.

Ejemplos de columnas posibles:

```text
Código
Descripción
Precio
Monto
Marca
Aplicación
Proveedor
Observaciones
```

El sistema deberá reconocer columnas desde Excel de forma similar al sistema de catálogos, pero sin procesar imágenes.

El administrador podrá:

* Crear una lista de precios.
* Editar el nombre de una lista de precios.
* Borrar una lista de precios.
* Vaciar una lista de precios.
* Importar una lista de precios desde Excel.
* Combinar una lista importada con una lista existente.
* Reemplazar una lista existente.
* Editar columnas de la lista.
* Editar el nombre visible de las columnas.
* Configurar visibilidad de columnas.
* Agregar ayuda contextual opcional a columnas.
* Consultar el archivo original asociado.

El usuario normal podrá consultar listas de precios visibles, si el administrador habilita esa visibilidad.

Los filtros de la sección Precios serán más simples que los filtros de Catálogos y se definirán posteriormente.

---

## Parte IV — Importación de datos

### 16. Importación de archivos Excel

#### 16.1 Formatos iniciales

El MVP deberá admitir:

* `.xlsx`
* `.xlsm`

Los archivos `.xlsm` serán procesados únicamente como fuentes de datos.

El sistema:

* No ejecutará macros.
* No ejecutará código Visual Basic.
* No dependerá de rutas locales.
* No replicará internamente la lógica VBA.

El soporte para `.xls` antiguo quedará sujeto a validación técnica.

---

#### 16.2 Principio de importación

Los archivos Excel podrán importarse hacia dos tipos de destino:

```text
Destino tipo Catálogo:
Catálogo elegido
└── Carpeta elegida
```

```text
Destino tipo Precios:
Lista de precios elegida
```

El sistema no deberá decidir automáticamente el destino final sin confirmación del administrador.

Para importaciones de Catálogos, el administrador deberá seleccionar catálogo y carpeta.

Para importaciones de Precios, el administrador deberá seleccionar una lista de precios existente o crear una nueva.

La importación de Precios no deberá procesar imágenes.

---

### 17. Asistente de importación

La importación se realizará mediante un asistente guiado por pasos.

No se implementará como un único modal sobrecargado.

---

#### 17.1 Paso 1 — Subir archivo

El administrador selecciona:

* Archivo Excel.
* ZIP de imágenes, cuando corresponda.
* Imágenes sueltas, cuando corresponda.

El sistema valida:

* Formato.
* Tamaño.
* Extensión.
* Tipo MIME.
* Integridad básica.

El archivo original se almacena como respaldo antes de procesarse.

Cuando el destino sea Precios, no se solicitará ZIP de imágenes ni imágenes sueltas.

---

#### 17.2 Paso 2 — Seleccionar destino

Antes de aplicar los productos o registros, el sistema deberá solicitar el tipo de destino.

```text
Tipo de destino:
Catálogos
Precios
```

Si el administrador selecciona **Catálogos**, el flujo continuará con:

```text
Catálogo: [dropdown] [+]
Carpeta: [dropdown dependiente] [+]
```

El dropdown de carpeta dependerá del catálogo seleccionado.

El botón `+` junto al catálogo permitirá crear un catálogo nuevo.

El botón `+` junto a la carpeta permitirá crear una carpeta nueva dentro del catálogo seleccionado.

Si el administrador selecciona **Precios**, el flujo continuará con:

```text
Lista de precios: [dropdown] [+]
```

El botón `+` junto a la lista de precios permitirá crear una nueva lista de precios.

---

#### 17.3 Paso 3 — Reconocer estructura

El sistema deberá analizar el archivo y reconocer:

* Hojas disponibles.
* Columnas.
* Filas.
* Campos detectados.
* Campo de referencia principal.
* Posibles códigos únicos.
* Fórmulas.
* Filas vacías.
* Encabezados duplicados.
* Celdas combinadas.

Para importaciones de Catálogos, el sistema también podrá reconocer:

* Imágenes embebidas.
* Referencias a imágenes externas.
* Código de imagen.

Para importaciones de Precios, el sistema no deberá reconocer ni procesar imágenes.

Si el Excel de Precios contiene imágenes, estas deberán ser ignoradas o informadas como contenido no procesado, sin bloquear la importación.

El sistema deberá mostrar una vista previa antes de aplicar cualquier cambio.

---

#### 17.4 Paso 4 — Mostrar registros reconocidos

Una vez seleccionado el destino, el sistema mostrará una lista preliminar de registros reconocidos.

Si el destino es Catálogos, los registros serán productos.

Si el destino es Precios, los registros serán ítems de lista de precios.

La vista previa deberá incluir:

* Columnas detectadas.
* Registros reconocidos.
* Código o campo de referencia.
* Registros con errores.
* Registros posiblemente coincidentes con registros existentes.
* Cantidad total de registros.
* Cantidad de advertencias.

Para Catálogos, también podrá incluir:

* Imágenes asociadas.
* Cantidad de imágenes detectadas.
* Imágenes pendientes.
* Imágenes rechazadas.

Para Precios, no deberá incluir datos de imágenes.

---

#### 17.5 Paso 5 — Resolver destino existente

Si el destino seleccionado está vacío, el sistema deberá permitir aplicar la lista directamente después de la vista previa.

Si el destino seleccionado ya contiene registros, el sistema deberá ofrecer:

```text
Combinar lista
Reemplazar lista
```

Los registros coincidentes deberán resaltarse con color amarillo o una señal visual clara, indicando que ya existen dentro del destino.

---

#### 17.6 Paso 6 — Confirmar operación

Las operaciones que puedan modificar datos existentes deberán abrir un modal de confirmación.

Deberán requerir confirmación:

* Combinar lista cuando existan coincidencias.
* Reemplazar lista.
* Borrar catálogo.
* Vaciar catálogo.
* Borrar carpeta.
* Vaciar carpeta.
* Borrar lista de precios.
* Vaciar lista de precios.
* Eliminar producto.
* Eliminar imagen.
* Eliminar ítem de precio.
* Eliminar imagen de ayuda de columna.

---

### 18. Combinar, reemplazar e importar listas

El sistema deberá permitir aplicar listas importadas tanto en Catálogos como en Precios.

En Catálogos, la lista se aplicará sobre una carpeta.

En Precios, la lista se aplicará sobre una lista de precios.

---

#### 18.1 Destino vacío

Si el destino está vacío, el sistema deberá mostrar:

```text
Cancelar
Aplicar lista
```

`Cancelar` detendrá el proceso y no agregará registros.

`Aplicar lista` cerrará el asistente y agregará los registros reconocidos al destino seleccionado.

No será necesario un modal de confirmación adicional en este caso, porque no existen registros previos que puedan perderse.

---

#### 18.2 Destino con registros existentes

Si el destino ya contiene registros, el sistema deberá mostrar:

```text
Combinar lista
Reemplazar lista
```

---

#### 18.3 Combinar lista

La acción `Combinar lista` agregará registros nuevos al destino existente.

Para el MVP, la estrategia recomendada será:

```text
Agregar registros nuevos y omitir registros coincidentes.
```

Los registros coincidentes deberán aparecer resaltados en amarillo en la previsualización.

El sistema deberá mostrar un modal de confirmación antes de aplicar la combinación cuando existan coincidencias.

---

#### 18.4 Reemplazar lista

La acción `Reemplazar lista` sustituirá la lista actual por la lista reconocida desde el Excel.

Antes de aplicar esta acción, el sistema deberá mostrar un modal de confirmación.

El modal deberá indicar claramente:

* Qué destino será afectado.
* Cuántos registros actuales existen.
* Cuántos registros nuevos serán cargados.
* Que el archivo original quedará respaldado.
* Que una importación fallida no deberá borrar la lista vigente.

---

#### 18.5 Registros coincidentes

El sistema deberá detectar posibles coincidencias mediante:

* Código principal.
* Código normalizado.
* Campo de referencia elegido.
* Equivalencias, cuando correspondan.

Para Catálogos, también podrá considerar:

* Código de imagen, si aplica.

Para Precios, la coincidencia deberá basarse principalmente en:

* Código.
* Código normalizado.
* Campo de referencia elegido.

Cuando existan coincidencias, deberán destacarse visualmente.

---

### 19. Fórmulas de Excel

Algunos archivos contienen fórmulas.

El importador deberá:

* Leer el valor calculado disponible.
* Conservar opcionalmente la fórmula original.
* No ejecutar fórmulas arbitrarias en el servidor.
* Advertir cuando una fórmula no tenga un valor calculado guardado.
* Permitir corregir manualmente el valor después de la importación.

Ejemplo:

```text
Fórmula original: =(12)*25.4
Valor importado: 304.8
```

El valor mostrado en la aplicación será el resultado calculado.

---

### 20. Macros de Visual Basic

El sistema no ejecutará ni trasladará macros de Visual Basic.

Las funciones utilizadas actualmente mediante macros deberán recrearse como funciones web.

Ejemplo del catálogo de Embragues:

```text
Comportamiento actual:
Moverse por una fila → la macro busca una imagen local → muestra una miniatura.

Comportamiento web:
Abrir o seleccionar el producto → el sistema consulta la imagen asociada → muestra una miniatura o galería.
```

Las macros podrán analizarse para comprender la relación entre datos e imágenes, pero no formarán parte de la aplicación final.

---

### 21. Publicación segura de importaciones

Las importaciones deberán procesarse primero en estado preliminar.

Estados posibles:

* Archivo almacenado.
* Analizando.
* Pendiente de destino.
* Pendiente de configuración.
* Procesando.
* Pendiente de revisión.
* Listo para aplicar.
* Aplicado.
* Publicado.
* Fallido.
* Cancelado.

Los registros nuevos no deberán reemplazar la versión activa hasta que la importación se complete correctamente y sea confirmada.

---

### 22. Informe de importación

Al finalizar, el sistema deberá informar:

* Archivo procesado.
* Tipo de destino: Catálogos o Precios.
* Catálogo destino, cuando corresponda.
* Carpeta destino, cuando corresponda.
* Lista de precios destino, cuando corresponda.
* Hojas detectadas.
* Hojas importadas.
* Registros procesados.
* Registros creados.
* Registros omitidos.
* Registros coincidentes.
* Fórmulas detectadas.
* Columnas detectadas.
* Errores.
* Advertencias.
* Acción aplicada: importar, combinar o reemplazar.

Para importaciones de Catálogos, también deberá informar:

* Imágenes detectadas.
* Imágenes asociadas.
* Imágenes pendientes.
* Imágenes rechazadas.

Para importaciones de Precios, el informe no deberá incluir métricas de imágenes.

Los errores deberán presentarse con lenguaje comprensible.

---

## Parte V — Imágenes

### 23. Gestión de imágenes

#### 23.1 Tipos de imágenes soportadas

El sistema deberá manejar:

1. Imágenes embebidas en Excel.
2. Imágenes externas asociadas por código.
3. Imágenes externas asociadas por nombre de archivo.
4. Imágenes cargadas manualmente.
5. Varias imágenes dentro de una misma fila.
6. Imágenes de ayuda de columnas.

Las imágenes de ayuda de columnas no deberán tratarse como imágenes de producto.

---

#### 23.2 Imágenes opcionales

Un producto podrá tener:

* Ninguna imagen.
* Una imagen.
* Varias imágenes.

La ausencia de una imagen no deberá impedir la importación.

Una columna podrá tener:

* Ningún contenido de ayuda.
* Texto de ayuda.
* Imagen de ayuda.
* Texto e imagen de ayuda.

La ausencia de ayuda contextual no deberá impedir el uso de la columna.

---

#### 23.3 Permisos sobre imágenes

El administrador podrá:

* Agregar imágenes.
* Reemplazar imágenes.
* Eliminar imágenes.
* Marcar una imagen como principal.
* Corregir asociaciones.
* Ver imágenes ampliadas.
* Agregar imágenes de ayuda de columna.
* Reemplazar imágenes de ayuda de columna.
* Eliminar imágenes de ayuda de columna.

El usuario normal solo podrá:

* Ver miniaturas.
* Abrir imágenes ampliadas.
* Ver ayudas contextuales de columnas visibles.
* Abrir imágenes de ayuda en modal, si existen.

---

### 24. Imágenes embebidas

Las imágenes pegadas dentro de las hojas deberán extraerse durante la importación de catálogos.

El sistema deberá considerar:

* Hoja de origen.
* Fila de anclaje.
* Columna de anclaje.
* Posición de la imagen.
* Encabezado de la columna.
* Producto relacionado.

La columna de origen podrá utilizarse para identificar la función de la imagen.

Cuando la asociación no sea segura, la imagen deberá quedar pendiente de revisión.

En importaciones de Precios, las imágenes embebidas deberán ignorarse o informarse como contenido no procesado.

---

### 25. Imágenes externas

Para archivos como Embragues, el administrador deberá poder subir:

* El archivo Excel.
* Un archivo ZIP con las imágenes.
* Varias imágenes seleccionadas manualmente.

El sistema deberá intentar asociarlas mediante:

* Código de imagen.
* Código del producto.
* Nombre del archivo.
* Nombre sin extensión.
* Columna configurada.
* Regla de asociación definida en la importación.

Ejemplo:

```text
Código de imagen en Excel:
PLACA-55120IAR

Archivo:
PLACA-55120IAR.jpg
```

Ambos deberán asociarse automáticamente.

Las rutas locales originales de Windows no deberán almacenarse como dependencia de funcionamiento.

La sección Precios no deberá asociar imágenes externas a sus registros.

---

### 26. Formatos de imagen

El sistema admitirá inicialmente:

* `.jpg`
* `.jpeg`
* `.png`
* `.webp`

Deberá validar:

* Extensión.
* Tipo MIME.
* Tamaño.
* Integridad.
* Nombre de archivo.
* Posibles duplicados.

Una imagen dañada no deberá cancelar toda la importación.

---

### 27. Asociación y revisión de imágenes

Cada imagen de producto podrá tener uno de estos estados:

* Asociada automáticamente.
* Asociada manualmente.
* Pendiente de revisión.
* Archivo no encontrado.
* Asociación ambigua.
* Nombre duplicado.
* Formato rechazado.
* Eliminada.

El panel deberá incluir una sección de revisión de imágenes.

El administrador podrá:

* Ver imágenes no asociadas.
* Buscar un producto.
* Asociar la imagen manualmente.
* Reemplazar una asociación.
* Eliminar la imagen.
* Marcar una imagen como principal.
* Cambiar el orden.
* Cambiar su etiqueta o función.

Las imágenes de ayuda de columnas no participarán en este flujo de asociación de productos.

---

### 28. Visualización ampliada de imágenes

Las tablas podrán mostrar miniaturas optimizadas.

Cuando un producto tenga imagen, el usuario podrá hacer click sobre la miniatura para abrir un modal de vista ampliada.

El modal deberá:

* Mostrar la imagen en mayor tamaño.
* Tener una cruz de cierre arriba a la derecha.
* Permitir cerrar con `Escape`.
* Permitir cerrar haciendo click fuera del contenido.
* No abrirse si el producto no tiene imagen.
* No abrirse vacío.
* Mantener buena visualización en desktop, tablet y mobile.

Si el producto tiene varias imágenes, el sistema podrá:

* Mostrar la imagen seleccionada.
* Permitir navegación entre imágenes, si se implementa galería.
* Mostrar una galería en el detalle del producto.

Para el MVP, la prioridad será abrir la imagen seleccionada en tamaño ampliado.

Las imágenes de ayuda de columnas también podrán abrirse en modal ampliado, pero se mostrarán dentro del flujo de ayuda contextual de cabeceras y no como imágenes de producto.

---

## Parte VI — Búsqueda, códigos y filtros

### 29. Códigos y equivalencias

#### 29.1 Código principal

Cada producto podrá tener un código principal opcional.

Cada ítem de precio también podrá tener un código principal opcional.

---

#### 29.2 Equivalencias

Un producto podrá contener:

* Ninguna equivalencia.
* Una equivalencia.
* Múltiples equivalencias.

Las equivalencias en listas de precios podrán evaluarse posteriormente si Pablo lo requiere.

---

#### 29.3 Celdas con múltiples códigos

Algunas celdas pueden contener varios códigos separados mediante:

* Saltos de línea.
* Signos igual.
* Guiones.
* Barras.
* Espacios.
* Paréntesis.
* Texto descriptivo.

El sistema deberá conservar el contenido original y generar, en paralelo, valores normalizados para búsqueda.

Ejemplo:

```text
Contenido original:
2902=1408=0193-SILVA

Códigos buscables:
2902
1408
0193
0193SILVA
```

La separación automática deberá poder revisarse cuando el formato sea ambiguo.

---

### 30. Normalización de búsqueda

La búsqueda deberá ignorar diferencias de formato que no alteren el código.

Como mínimo:

* Mayúsculas y minúsculas.
* Espacios.
* Guiones.
* Guiones bajos.
* Puntos.
* Barras.
* Separadores configurados.

Ejemplo:

```text
Código original: 1-A

Consultas válidas:
1-A
1A
1_a
1 A
1A_
```

Todos los términos se compararán mediante una versión normalizada.

---

### 31. Búsqueda por carpeta

Cada carpeta tendrá su propio buscador.

Podrá buscar sobre:

* Código principal.
* Equivalencias.
* Descripción.
* Marca.
* Categoría.
* Modelo.
* Aplicación.
* Columnas configuradas como buscables.

Cada carpeta podrá definir qué columnas participan en la búsqueda.

Ejemplo:

```text
Catálogo: Embragues
Carpeta: Discos
Buscador: Buscar en Discos
```

---

### 32. Búsqueda por catálogo

Dentro de un catálogo se podrá realizar una búsqueda que recorra todas sus carpetas visibles para el usuario.

Ejemplo:

```text
Catálogo: Embragues

La búsqueda recorre:
- Placas
- Discos
- Crapodinas
```

Cada resultado deberá indicar la carpeta de origen.

---

### 33. Búsqueda global

La búsqueda global será una función principal del sistema.

Permitirá buscar simultáneamente en:

* Todos los catálogos activos.
* Todas las carpetas activas.
* Códigos principales.
* Equivalencias.
* Descripciones.
* Campos configurados como globalmente buscables.

Cada resultado deberá mostrar:

* Catálogo.
* Carpeta.
* Código principal.
* Descripción.
* Coincidencia encontrada.
* Imagen principal, cuando exista.
* Acción para abrir el producto.

El usuario no deberá conocer previamente en qué archivo, catálogo o carpeta se encuentra el repuesto.

La inclusión de listas de precios dentro de una búsqueda global general podrá evaluarse posteriormente. En la primera versión, Precios podrá tener su propia búsqueda o filtrado independiente.

---

### 34. Filtros acumulables por columna

Esta será una funcionalidad central del sistema de Catálogos.

El objetivo es permitir que el usuario reduzca rápidamente una lista amplia de productos hasta encontrar opciones relevantes, incluso cuando el cliente no conoce el código exacto.

Ejemplo:

```text
Catálogo: Embragues
Carpeta: Discos

Filtro 1:
Montadora contiene "John D"

Filtro 2:
Cant. de estrías = 19

Resultado:
La lista se reduce de 100 productos a pocos resultados relevantes.
```

---

#### 34.1 Funcionamiento visual

Cada columna filtrable deberá mostrar un botón o ícono de filtro.

El ícono podrá aparecer:

* Al hacer hover sobre el nombre de la columna.
* Siempre visible si la columna tiene un filtro activo.

Al hacer click en el ícono, se abrirá un input flotante debajo del nombre de la columna.

El usuario podrá escribir el valor a filtrar.

El sistema aplicará el filtro de forma automática con un pequeño debounce de 250 a 300 ms.

---

#### 34.2 Estado activo del filtro

Cuando una columna tenga un filtro activo:

* El ícono deberá quedar visible.
* La columna deberá mostrar un indicador visual.
* El filtro deberá aparecer en la zona superior de filtros activos.

Ejemplo:

```text
Filtrando por:
[Cant. estrías: 19 ×] [Montadora: John D ×]
```

Cada pill deberá tener una cruz para eliminar ese filtro.

---

#### 34.3 Limpieza de filtros

El usuario podrá eliminar filtros de tres maneras:

* Borrando el texto dentro del input flotante.
* Haciendo click en la cruz del pill correspondiente.
* Usando una acción general de limpiar filtros, si se implementa.

---

#### 34.4 Tipos de filtro

Para el MVP:

* Columnas de texto: filtro por “contiene”.
* Columnas numéricas: filtro por coincidencia exacta o contiene, según el dato importado.
* Columnas con valores repetidos: podrán utilizar input o selector, según la implementación.

El filtrado avanzado por rangos, mayor que, menor que o reglas complejas podrá evaluarse después.

---

#### 34.5 Filtros acumulables

Los filtros deberán combinarse entre sí.

Ejemplo:

```text
Montadora: John Deere
+
Cant. estrías: 19
+
Marca: Sachs
```

El resultado deberá cumplir todos los filtros activos.

---

#### 34.6 Meta de usabilidad

El sistema deberá permitir encontrar un producto o reducir una búsqueda a un conjunto pequeño de opciones en menos de 5 minutos.

Esto será un criterio central del éxito del sistema.

---

### 35. Filtros globales

El buscador global podrá contar con filtros comunes entre catálogos.

Los filtros definitivos se definirán posteriormente con Pablo.

Ejemplos posibles:

* Catálogo.
* Carpeta.
* Marca.
* Categoría.
* Fabricante.
* Aplicación.
* Con imagen.
* Con equivalencias.

Como los nombres de las columnas varían, deberá existir un mapeo a campos globales.

Ejemplo:

```text
Columna del catálogo A: Marca
Columna del catálogo B: Fabricante
Columna del catálogo C: Proveedor

Campo global configurado:
Fabricante o marca
```

Este mapeo no deberá realizarse automáticamente sin confirmación.

Los filtros de la sección Precios serán más simples que los filtros de Catálogos y se definirán posteriormente.

---

### 36. Configuración de columnas

Cada columna podrá configurarse como:

* Visible para administrador.
* Visible para usuario normal.
* Editable por administrador.
* Buscable.
* Buscable globalmente.
* Filtrable.
* Filtrable globalmente.
* Código principal.
* Equivalencia.
* Descripción.
* Código de imagen.
* Obligatoria.
* Solo lectura.

También se podrá configurar:

* Nombre original.
* Nombre visible.
* Orden.
* Tipo de dato.
* Ancho.
* Formato.
* Unidad.
* Etiqueta.
* Texto de ayuda.
* Imagen de ayuda.
* Texto alternativo de imagen de ayuda.

El nombre original provendrá del Excel y deberá conservarse como referencia.

El nombre original:

* No será editable.
* Deberá mostrarse en el CRUD de columnas.
* Servirá para identificar la cabecera original del archivo importado.

El nombre visible será obligatorio.

El nombre visible:

* Será editable por el administrador.
* Será la cabecera utilizada en la tabla.
* Podrá diferir del nombre original.
* No deberá modificar el nombre original almacenado.

La visibilidad para usuario normal será obligatoria y se manejará mediante un toggle.

El texto de ayuda y la imagen de ayuda serán opcionales.

Si una columna no tiene texto de ayuda ni imagen de ayuda, no deberá mostrar ícono `Info`.

Si una columna tiene texto de ayuda o imagen de ayuda, deberá mostrar el ícono `Info` de Lucide junto al nombre visible.

La imagen de ayuda, si existe, deberá poder ampliarse en un modal.

Esta configuración aplicará tanto a columnas de Catálogos como a columnas de Precios.

---

## Parte VII — Archivos y modo offline

### 37. Archivos subidos

> **Implementación backend (Fase 8):** `GET/DELETE /api/admin/files/*`, reproceso, informes. Ver [`ENDPOINTS.md`](./ENDPOINTS.md). UI pendiente.

El sistema tendrá una sección denominada **Archivos subidos**.

Por cada archivo se mostrará:

* Nombre original.
* Extensión.
* Tamaño.
* Fecha de carga.
* Usuario.
* Tipo de destino: Catálogos o Precios.
* Catálogo relacionado, cuando corresponda.
* Carpeta relacionada, cuando corresponda.
* Lista de precios relacionada, cuando corresponda.
* Cantidad de hojas.
* Hojas importadas.
* Estado.
* Fecha del último procesamiento.
* Cantidad de productos.
* Cantidad de registros de precios importados, cuando corresponda.
* Cantidad de imágenes, cuando corresponda.
* Errores encontrados.

Acciones:

* Descargar original.
* Consultar detalles.
* Reprocesar.
* Crear un nuevo catálogo.
* Crear una nueva carpeta.
* Crear una nueva lista de precios.
* Combinar lista.
* Reemplazar lista.
* Combinar una lista de precios.
* Reemplazar una lista de precios.
* Eliminar el archivo.
* Consultar el informe de importación.
* Consultar informe de importación de precios.

La eliminación de un catálogo, carpeta o lista de precios no deberá eliminar automáticamente el archivo original.

---

### 38. Modo offline

La aplicación deberá permitir consultar información sin conexión.

El modo offline será exclusivamente de lectura.

---

#### 38.1 Funciones disponibles offline

* Abrir la aplicación.
* Consultar el panel sincronizado.
* Abrir catálogos visibles.
* Abrir carpetas visibles.
* Consultar productos.
* Buscar dentro de una carpeta.
* Buscar dentro de un catálogo.
* Utilizar la búsqueda global.
* Aplicar filtros acumulables.
* Consultar equivalencias.
* Ver miniaturas sincronizadas.
* Abrir imágenes sincronizadas.
* Consultar ayudas contextuales sincronizadas.
* Consultar listas de precios sincronizadas, si la sección Precios se habilita offline.
* Consultar ítems de precios.
* Aplicar filtros simples en listas de precios sincronizadas.

---

#### 38.2 Funciones bloqueadas offline

* Subir archivos.
* Crear catálogos.
* Editar catálogos.
* Borrar catálogos.
* Vaciar catálogos.
* Crear carpetas.
* Editar carpetas.
* Borrar carpetas.
* Vaciar carpetas.
* Crear productos.
* Editar productos.
* Eliminar productos.
* Reprocesar archivos.
* Administrar imágenes.
* Gestionar usuarios.
* Cambiar configuraciones.
* Modificar visibilidad.
* Crear listas de precios.
* Editar listas de precios.
* Borrar listas de precios.
* Vaciar listas de precios.
* Importar listas de precios.
* Combinar listas de precios.
* Reemplazar listas de precios.
* Editar columnas de listas de precios.
* Editar ayudas contextuales de columnas.

---

#### 38.3 Estado de conexión

La interfaz deberá mostrar:

* Indicador sin conexión.
* Fecha de última sincronización.
* Advertencia sobre posibles datos desactualizados.
* Funciones bloqueadas.

---

#### 38.4 Sincronización

Cuando vuelva la conexión:

1. Se verificará si existen actualizaciones.
2. Se descargarán cambios.
3. Se actualizarán los datos locales.
4. Se registrará la nueva fecha de sincronización.

Como no habrá edición offline, no será necesario resolver conflictos de escritura.

---

### 39. Imágenes offline

Para controlar el espacio del dispositivo:

* Se sincronizarán miniaturas optimizadas.
* Las imágenes completas podrán descargarse bajo demanda.
* Se podrá ofrecer una opción para sincronizar imágenes completas.
* Se mostrará un reemplazo cuando una imagen no esté disponible localmente.
* Los archivos Excel originales no se almacenarán offline.
* Las imágenes de ayuda de columnas podrán sincronizarse como recursos livianos cuando sea necesario.

---

## Parte VIII — Requerimientos

### 40. Requerimientos funcionales

| ID     | Requerimiento                        | Descripción                                                                                                             |
| ------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| RF-001 | Autenticación                        | El sistema deberá permitir iniciar y cerrar sesión con correo y contraseña.                                             |
| RF-002 | Roles                                | El sistema deberá diferenciar administradores y usuarios normales.                                                      |
| RF-003 | Landing pública                      | La información institucional deberá ser pública, pero los catálogos serán privados.                                     |
| RF-004 | Dominio                              | El sistema utilizará el dominio `www.rothamelrepuestos.com.ar`.                                                         |
| RF-005 | Estructura Catálogo-Carpeta-Producto | El sistema deberá organizar la información en catálogos, carpetas y productos.                                          |
| RF-006 | Gestión de catálogos                 | El administrador podrá crear, editar, ordenar, ocultar, mostrar, borrar y vaciar catálogos.                             |
| RF-007 | Gestión de carpetas                  | El administrador podrá crear, editar, ordenar, ocultar, mostrar, borrar y vaciar carpetas.                              |
| RF-008 | Gestión de productos                 | El administrador podrá crear, editar, duplicar y eliminar productos.                                                    |
| RF-009 | Edición de columnas                  | El administrador podrá editar todas las columnas de un producto.                                                        |
| RF-010 | Visibilidad de catálogos             | El administrador podrá definir si un catálogo es visible para usuarios normales.                                        |
| RF-011 | Visibilidad de carpetas              | El administrador podrá definir si una carpeta es visible para usuarios normales.                                        |
| RF-012 | Visibilidad de columnas              | El administrador podrá definir si una columna es visible para usuarios normales.                                        |
| RF-013 | Subida de Excel                      | El administrador podrá subir archivos `.xlsx` y `.xlsm`.                                                                |
| RF-014 | Respaldo                             | El archivo original deberá almacenarse antes de procesarse.                                                             |
| RF-015 | Selección de destino                 | El administrador deberá seleccionar el destino antes de aplicar una lista importada.                                    |
| RF-016 | Creación rápida de destino           | El asistente de importación deberá permitir crear catálogos, carpetas o listas de precios desde botones `+`.            |
| RF-017 | Análisis de hojas                    | El sistema deberá detectar hojas del archivo.                                                                           |
| RF-018 | Detección de columnas                | El sistema deberá detectar encabezados y columnas.                                                                      |
| RF-019 | Campos dinámicos                     | Las columnas particulares deberán conservarse sin modificar la base de datos.                                           |
| RF-020 | Vista previa                         | El sistema deberá mostrar registros reconocidos antes de aplicar cambios.                                               |
| RF-021 | Coincidencias                        | El sistema deberá detectar y resaltar registros coincidentes.                                                           |
| RF-022 | Combinar lista                       | El administrador podrá combinar una lista importada con un destino existente.                                           |
| RF-023 | Reemplazar lista                     | El administrador podrá reemplazar los registros de un destino existente.                                                |
| RF-024 | Importar lista vacía                 | El administrador podrá aplicar una lista a un destino vacío.                                                            |
| RF-025 | Confirmaciones                       | Las acciones destructivas deberán solicitar confirmación.                                                               |
| RF-026 | Fórmulas                             | El sistema deberá importar valores calculados sin ejecutar fórmulas arbitrarias.                                        |
| RF-027 | Macros                               | El sistema no deberá ejecutar macros.                                                                                   |
| RF-028 | Imágenes embebidas                   | El sistema deberá extraer imágenes pegadas cuando sea técnicamente posible en catálogos.                                |
| RF-029 | Imágenes externas                    | El sistema deberá asociar imágenes externas mediante códigos o nombres en catálogos.                                    |
| RF-030 | Imágenes múltiples                   | Un producto podrá contener varias imágenes.                                                                             |
| RF-031 | Revisión de imágenes                 | Las asociaciones dudosas deberán quedar pendientes de revisión.                                                         |
| RF-032 | Modal de imagen                      | Las imágenes de productos deberán poder abrirse en un modal ampliado.                                                   |
| RF-033 | Equivalencias                        | Los productos podrán tener múltiples códigos equivalentes.                                                              |
| RF-034 | Normalización                        | El sistema deberá normalizar códigos y consultas.                                                                       |
| RF-035 | Búsqueda por carpeta                 | Cada carpeta deberá tener un buscador configurable.                                                                     |
| RF-036 | Búsqueda por catálogo                | El sistema deberá buscar entre todas las carpetas de un catálogo.                                                       |
| RF-037 | Búsqueda global                      | El sistema deberá buscar entre todos los catálogos activos.                                                             |
| RF-038 | Origen del resultado                 | Cada resultado deberá indicar catálogo y carpeta.                                                                       |
| RF-039 | Filtros acumulables                  | Las columnas filtrables deberán admitir filtros acumulables.                                                            |
| RF-040 | Pills de filtros activos             | El sistema deberá mostrar filtros activos encima de la tabla.                                                           |
| RF-041 | Limpieza de filtros                  | Cada filtro activo deberá poder eliminarse individualmente.                                                             |
| RF-042 | Configuración de columnas            | El administrador podrá definir columnas visibles, buscables y filtrables.                                               |
| RF-043 | Archivos subidos                     | El administrador podrá consultar y descargar los archivos originales.                                                   |
| RF-044 | Publicación segura                   | Una importación fallida no deberá afectar los datos vigentes.                                                           |
| RF-045 | Consulta offline                     | Los catálogos sincronizados deberán estar disponibles sin conexión.                                                     |
| RF-046 | Bloqueo offline                      | Las modificaciones deberán bloquearse sin conexión.                                                                     |
| RF-047 | Sincronización                       | La copia local deberá actualizarse al recuperar Internet.                                                               |
| RF-048 | Nombre visible de columnas           | El administrador podrá editar el nombre visible de cada columna sin modificar el nombre original importado desde Excel. |
| RF-049 | Nombre original no editable          | El nombre original de cada columna deberá conservarse y mostrarse como dato no editable.                                |
| RF-050 | Ayuda contextual de columnas         | Las columnas podrán tener texto de ayuda opcional e imagen de ayuda opcional.                                           |
| RF-051 | Ícono Info en columnas               | El ícono `Info` solo deberá mostrarse cuando exista texto o imagen de ayuda en la columna.                              |
| RF-052 | Modal de imagen de ayuda             | La imagen de ayuda de una columna deberá poder abrirse en un modal ampliado.                                            |
| RF-053 | Sección Precios                      | El sistema deberá contar con una sección privada llamada Precios, independiente de Catálogos.                           |
| RF-054 | Listas de precios                    | El administrador podrá crear, editar, borrar, vaciar e importar listas de precios.                                      |
| RF-055 | Importación de precios               | La sección Precios deberá importar archivos Excel reconociendo columnas, filas y campos.                                |
| RF-056 | Precios sin imágenes                 | La importación de Precios no deberá procesar imágenes embebidas, imágenes externas ni galerías.                         |
| RF-057 | Combinar precios                     | El administrador podrá combinar una lista de precios importada con una lista existente.                                 |
| RF-058 | Reemplazar precios                   | El administrador podrá reemplazar una lista de precios existente mediante importación desde Excel.                      |
| RF-059 | Columnas de precios                  | Las columnas de listas de precios deberán admitir nombre visible, visibilidad y ayuda contextual opcional.              |

---

### 41. Requerimientos no funcionales

#### 41.1 Rendimiento

* Las búsquedas habituales deberán responder rápidamente.
* Las tablas deberán utilizar paginación o virtualización.
* Las imágenes deberán mostrarse mediante miniaturas.
* La búsqueda global deberá utilizar índices.
* Las importaciones extensas deberán mostrar progreso.
* La interfaz no deberá cargar todos los productos simultáneamente cuando el volumen sea elevado.
* Los filtros por columna deberán responder con fluidez.
* El filtrado deberá utilizar debounce para evitar cálculos excesivos.
* El usuario deberá poder reducir una lista amplia a resultados relevantes en menos de 5 minutos.
* La sección Precios deberá cargar y filtrar listas con fluidez.

---

#### 41.2 Seguridad

* Rutas privadas protegidas.
* Acceso mediante correo y contraseña.
* Control de roles.
* Storage privado.
* Validación de archivos.
* Validación MIME.
* Límites de tamaño.
* Sanitización de nombres.
* Archivos ZIP extraídos de forma segura.
* Descargas autorizadas.
* Confirmación antes de eliminaciones.
* Registro de operaciones importantes.
* Protección de datos offline.
* Ocultamiento real de datos no visibles para usuario normal.
* Las imágenes de ayuda de columnas deberán almacenarse de forma segura.
* El usuario normal solo podrá ver ayudas contextuales de columnas visibles.
* La sección Precios será privada y no deberá exponerse en la landing pública.
* Las listas de precios ocultas no deberán ser accesibles por usuarios normales.

---

#### 41.3 Usabilidad

* Interfaz clara.
* Navegación sencilla.
* Catálogos y carpetas fáciles de identificar.
* Importador guiado por pasos.
* Mensajes comprensibles.
* Vista previa antes de aplicar importaciones.
* Confirmación de acciones destructivas.
* Textos formales.
* Prioridad de uso en computadoras y notebooks.
* Filtros por columna rápidos y acumulables.
* Pills visibles para comprender qué filtros están activos.
* Modal de imagen simple y rápido.
* Las cabeceras de tabla deberán poder mostrar ayuda contextual mediante ícono `Info`.
* La ayuda contextual deberá ser clara, breve y no invasiva.
* El ícono `Info` deberá responder a hover, focus y click/tap.
* Las imágenes de ayuda deberán poder ampliarse en modal.
* La sección Precios deberá ser simple y rápida de consultar.
* La sección Precios no deberá mezclar su navegación con Catálogos.

---

#### 41.4 Compatibilidad

* Google Chrome.
* Microsoft Edge.
* Navegadores modernos.
* Diseño adaptable.
* Uso desde computadoras, tablets y celulares.

---

## Parte IX — Arquitectura técnica

### 42. Modelo conceptual de datos

#### User

Representa usuarios del sistema.

Campos principales:

* ID.
* Nombre.
* Correo.
* Rol.
* Estado.
* Último acceso.

Roles:

```text
ADMIN
USER
```

---

#### Catalog

Representa un catálogo.

Campos principales:

* ID.
* Nombre.
* Descripción.
* Imagen representativa.
* Estado.
* Orden.
* Visible para usuario normal.
* Fecha de creación.
* Fecha de actualización.

---

#### CatalogFolder

Representa una carpeta dentro de un catálogo.

Campos principales:

* ID.
* Catálogo.
* Nombre.
* Descripción.
* Estado.
* Orden.
* Visible para usuario normal.
* Configuración de búsqueda.
* Configuración de filtros.
* Fecha de creación.
* Fecha de actualización.

---

#### FolderColumn

Representa una columna configurada dentro de una carpeta de catálogo.

Campos principales:

* ID.
* Carpeta.
* Nombre original.
* Nombre visible.
* Clave interna.
* Tipo.
* Orden.
* Visible para usuario normal.
* Buscable.
* Buscable globalmente.
* Filtrable.
* Filtrable globalmente.
* Editable por administrador.
* Campo global relacionado.
* Es código principal.
* Es equivalencia.
* Es descripción.
* Es código de imagen.
* Texto de ayuda opcional.
* Imagen de ayuda opcional.
* Texto alternativo de imagen de ayuda.
* Fecha de creación.
* Fecha de modificación.

El nombre original no será editable.

El nombre visible será editable por el administrador.

El texto de ayuda y la imagen de ayuda serán opcionales.

---

#### Product

Representa un producto dentro de una carpeta.

Campos principales:

* ID.
* Carpeta.
* Código principal.
* Código normalizado.
* Descripción.
* Datos dinámicos en JSONB.
* Texto original.
* Texto indexado.
* Fecha de creación.
* Fecha de modificación.

---

#### EquivalentCode

Representa un código equivalente.

Campos principales:

* ID.
* Producto.
* Código original.
* Código normalizado.
* Tipo opcional.

---

#### ProductImage

Representa una imagen asociada a un producto.

Campos principales:

* ID.
* Producto opcional.
* Ruta.
* Nombre original.
* Tipo MIME.
* Tamaño.
* Orden.
* Imagen principal.
* Etiqueta.
* Hoja de origen.
* Fila de origen.
* Columna de origen.
* Estado de asociación.
* Origen.

---

#### PriceList

Representa una lista de precios independiente de los catálogos.

Campos principales:

* ID.
* Nombre.
* Descripción.
* Estado.
* Orden.
* Visible para usuario normal.
* Archivo de origen opcional.
* Fecha de creación.
* Fecha de actualización.

Una lista de precios no pertenece a un catálogo ni a una carpeta.

---

#### PriceColumn

Representa una columna configurada dentro de una lista de precios.

Campos principales:

* ID.
* Lista de precios.
* Nombre original.
* Nombre visible.
* Clave interna.
* Tipo.
* Orden.
* Visible para usuario normal.
* Buscable.
* Filtrable.
* Editable por administrador.
* Es código.
* Es descripción.
* Es precio o monto.
* Texto de ayuda opcional.
* Imagen de ayuda opcional.
* Texto alternativo de imagen de ayuda.
* Fecha de creación.
* Fecha de modificación.

El nombre original no será editable.

El nombre visible será editable por el administrador.

El texto de ayuda y la imagen de ayuda serán opcionales.

---

#### PriceItem

Representa una fila dentro de una lista de precios.

Campos principales:

* ID.
* Lista de precios.
* Código principal opcional.
* Código normalizado opcional.
* Descripción opcional.
* Precio o monto opcional.
* Datos dinámicos en JSONB.
* Texto original.
* Texto indexado.
* Fecha de creación.
* Fecha de modificación.

---

#### UploadedFile

Representa un archivo almacenado.

Campos principales:

* ID.
* Nombre original.
* Ruta.
* Tipo.
* Tamaño.
* Usuario.
* Fecha.
* Estado.

---

#### ImportJob

Representa una operación de importación.

Campos principales:

* ID.
* Archivo.
* Tipo de destino.
* Catálogo destino opcional.
* Carpeta destino opcional.
* Lista de precios destino opcional.
* Estado.
* Tipo de acción.
* Configuración.
* Resultados.
* Fecha de inicio.
* Fecha de finalización.

Tipos de destino:

```text
CATALOG_FOLDER
PRICE_LIST
```

Tipos de acción:

```text
IMPORTAR_LISTA
COMBINAR_LISTA
REEMPLAZAR_LISTA
```

Cuando el tipo de destino sea `CATALOG_FOLDER`, la importación podrá procesar imágenes.

Cuando el tipo de destino sea `PRICE_LIST`, la importación no deberá procesar imágenes.

---

#### ImportPreview

Representa la vista previa de registros reconocidos antes de aplicar cambios.

Campos principales:

* ID.
* Importación.
* Registros reconocidos.
* Registros coincidentes.
* Errores.
* Advertencias.
* Estado.

---

#### GlobalFieldMapping

Relaciona columnas particulares con campos globales.

Campos principales:

* ID.
* Columna.
* Campo global.
* Configuración.

---

#### OfflineSyncManifest

Representa la sincronización offline.

Campos principales:

* Usuario.
* Dispositivo.
* Catálogos sincronizados.
* Carpetas sincronizadas.
* Listas de precios sincronizadas.
* Versión.
* Fecha de sincronización.

---

#### AuditLog

Representa operaciones importantes.

Campos principales:

* Usuario.
* Acción.
* Entidad.
* Identificador.
* Fecha.

---

### 43. Estrategia de almacenamiento

No se creará una tabla física en PostgreSQL por cada Excel, catálogo, carpeta o lista de precios.

Se utilizará:

* Estructura relacional para usuarios, catálogos, carpetas, archivos, productos, precios e imágenes.
* Columnas específicas para campos importantes.
* JSONB para datos variables de productos.
* JSONB para datos variables de ítems de precios.
* Índices para búsquedas.
* Índices para filtros frecuentes.
* Storage privado para Excel e imágenes.

Esto permitirá:

* Agregar nuevos archivos sin migraciones.
* Conservar estructuras diferentes.
* Mantener un buscador global.
* Incorporar nuevos catálogos sin modificar el código.
* Crear carpetas dinámicamente.
* Crear listas de precios dinámicamente.
* Configurar visibilidad.
* Simplificar el modo offline.

Además:

* Las listas de precios se almacenarán de forma independiente de los catálogos.
* Las listas de precios utilizarán estructura relacional para listas y columnas.
* Los ítems de precios utilizarán JSONB para datos variables.
* Las imágenes de ayuda de columnas se almacenarán como recursos privados.
* Las imágenes de ayuda no serán imágenes de producto.
* Las importaciones de Precios no deberán generar miniaturas ni galerías.

---

### 44. Stack tecnológico propuesto

#### Frontend

* Next.js.
* React.
* TypeScript.
* SCSS Modules.
* TanStack Table.
* React Hook Form.
* Zod.
* Lucide React para iconos.

Se utilizará una versión estable y compatible de cada tecnología al comenzar el desarrollo.

---

#### Backend

El backend principal se desarrollará dentro del ecosistema Next.js mediante:

* Route Handlers.
* Server Actions cuando correspondan.
* Services.
* Repositories.
* Validadores.
* Procesadores de importación.
* Procesadores de imágenes.
* Tareas de procesamiento en segundo plano cuando sean necesarias.

**NestJS no se utilizará en el MVP ni en futuras fases del proyecto.**

---

#### Base de datos

* PostgreSQL.
* Supabase.
* Prisma.
* JSONB.

---

#### Almacenamiento

* Supabase Storage privado.

Se utilizará para:

* Archivos Excel.
* Imágenes.
* Miniaturas.
* Archivos temporales.
* ZIP de imágenes.
* Imágenes de ayuda de columnas.

---

#### Procesamiento de Excel

* ExcelJS como herramienta principal.
* Librerías adicionales únicamente cuando exista una necesidad concreta.

---

#### Procesamiento de imágenes

Se deberán utilizar herramientas compatibles con Node.js para:

* Extraer imágenes.
* Validar formatos.
* Generar miniaturas.
* Optimizar archivos.
* Leer metadatos.

La sección Precios no deberá procesar imágenes asociadas a sus ítems.

---

#### Modo offline

* Progressive Web App.
* Service Worker.
* Cache Storage.
* IndexedDB.

---

### 45. Arquitectura propuesta

```text
src/
├── app/
│   ├── (public)/
│   ├── login/
│   └── admin/
│
├── features/
│   ├── auth/
│   ├── landing/
│   ├── admin/
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
│   ├── prices/
│   ├── price-lists/
│   ├── price-imports/
│   ├── column-help/
│   ├── users/
│   └── offline/
│
├── shared/
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   ├── constants/
│   └── types/
│
└── server/
    ├── services/
    ├── repositories/
    ├── validators/
    ├── importers/
    ├── image-processors/
    ├── search/
    ├── filters/
    ├── prices/
    ├── column-help/
    ├── storage/
    ├── auth/
    └── database/
```

---

### 46. Servicios principales

#### CatalogService

* Crea catálogos.
* Edita catálogos.
* Borra catálogos.
* Vacía catálogos.
* Gestiona visibilidad.

---

#### FolderService

* Crea carpetas.
* Edita carpetas.
* Borra carpetas.
* Vacía carpetas.
* Gestiona visibilidad.
* Gestiona configuración de columnas.

---

#### ProductService

* Crea productos.
* Edita productos.
* Elimina productos.
* Gestiona datos dinámicos.
* Gestiona equivalencias.

---

#### ColumnConfigurationService

* Edita nombres visibles de columnas.
* Conserva nombres originales no editables.
* Gestiona visibilidad de columnas.
* Gestiona configuración buscable y filtrable.
* Gestiona texto de ayuda de columnas.
* Gestiona imagen de ayuda de columnas.

---

#### ColumnHelpService

* Guarda textos de ayuda.
* Valida imágenes de ayuda.
* Almacena imágenes de ayuda.
* Elimina imágenes de ayuda.
* Devuelve la información necesaria para mostrar el ícono `Info`.
* Devuelve la información necesaria para mostrar el modal de ayuda.

---

#### CatalogImportService

* Analiza archivos.
* Detecta hojas.
* Procesa filas.
* Genera importaciones preliminares.
* Gestiona importaciones, combinaciones y reemplazos.

---

#### ExcelStructureService

* Detecta encabezados.
* Detecta columnas.
* Analiza celdas combinadas.
* Identifica fórmulas.
* Identifica hojas auxiliares.

---

#### ImageExtractionService

* Extrae imágenes embebidas.
* Detecta filas y columnas de origen.
* Genera miniaturas.
* Registra imágenes pendientes.

---

#### ImageMatchingService

* Asocia imágenes por código.
* Asocia imágenes por nombre.
* Detecta duplicados.
* Registra coincidencias ambiguas.

---

#### SearchService

* Normaliza consultas.
* Busca por carpeta.
* Busca por catálogo.
* Ejecuta la búsqueda global.
* Ordena resultados.

---

#### ColumnFilterService

* Gestiona filtros por columna.
* Aplica filtros acumulables.
* Genera pills de filtros activos.
* Limpia filtros.

---

#### VisibilityService

* Determina qué catálogos ve cada rol.
* Determina qué carpetas ve cada rol.
* Determina qué columnas ve cada rol.
* Determina qué listas de precios ve cada rol.

---

#### PriceListService

* Crea listas de precios.
* Edita listas de precios.
* Borra listas de precios.
* Vacía listas de precios.
* Gestiona visibilidad de listas de precios.
* Gestiona columnas de listas de precios.

---

#### PriceImportService

* Analiza archivos Excel de precios.
* Detecta columnas.
* Detecta filas.
* Reconoce campos como código, descripción, precio o monto.
* Genera vista previa.
* Detecta coincidencias.
* Combina listas.
* Reemplaza listas.
* Omite procesamiento de imágenes.

---

#### OfflineSyncService

* Prepara datos sincronizables.
* Actualiza IndexedDB.
* Gestiona versiones.
* Sincroniza miniaturas.
* Sincroniza datos de precios cuando corresponda.

---

### 47. Flujo resumido de importación

```text
Administrador
      │
      ▼
Selecciona tipo de importación
      │
      ├── Catálogos
      │
      └── Precios
      │
      ▼
Sube Excel
      │
      ▼
Si corresponde a Catálogos, puede subir ZIP o imágenes externas
      │
      ▼
Si corresponde a Precios, no se solicitan imágenes
      │
      ▼
Se almacenan los archivos originales
      │
      ▼
Si es Catálogos:
      │     ├── Selecciona catálogo destino o crea uno nuevo
      │     └── Selecciona carpeta destino o crea una nueva
      │
      ▼
Si es Precios:
      │     └── Selecciona lista de precios o crea una nueva
      │
      ▼
Se detectan hojas, columnas, fórmulas y filas
      │
      ▼
Si es Catálogos, también se detectan imágenes
      │
      ▼
Se muestra una vista previa de registros reconocidos
      │
      ▼
Se detectan coincidencias con registros existentes
      │
      ▼
Si el destino está vacío:
      │     ├── Cancelar
      │     └── Aplicar lista
      │
      ▼
Si el destino tiene registros:
      │     ├── Combinar lista
      │     └── Reemplazar lista
      │
      ▼
Se confirma la acción cuando corresponde
      │
      ▼
Se procesa una versión preliminar
      │
      ▼
Se revisan errores
      │
      ▼
Si es Catálogos, se revisan asociaciones de imágenes
      │
      ▼
Se aplica la lista
      │
      ▼
El destino queda actualizado
```

---

## Parte X — Planificación y cierre

### 48. Roadmap funcional

> **Estado de implementación técnica:** [`BACKEND-IMPLEMENTATION.md`](./BACKEND-IMPLEMENTATION.md) · **Contratos API:** [`ENDPOINTS.md`](./ENDPOINTS.md) · **Import catálogos:** [`METHOD-IMPORT.md`](./METHOD-IMPORT.md)

#### Fase 1 — Base visual y acceso

* Landing pública.
* Login.
* Panel admin base.
* Sidebar admin.
* Rutas protegidas.
* Roles admin/user.

**Estado:** ✅ UI base y auth operativos (backend Fase 2).

---

#### Fase 2 — Modelo Catálogo-Carpeta-Producto

* Crear modelo de catálogos.
* Crear modelo de carpetas.
* Crear modelo de productos.
* Crear configuración de columnas.
* Crear visibilidad por rol.
* Crear estructura base de tablas.
* Edición de nombre visible de columnas.
* Visibilidad de columnas para usuario normal.
* Ayuda contextual de columnas.
* Imagen de ayuda opcional por columna.
* Modal de imagen de ayuda.

**Estado:** ✅ Backend completo (backend Fase 3). Integración UI → frontend.

---

#### Fase 3 — Administración manual

* Crear catálogo.
* Editar catálogo.
* Borrar catálogo.
* Vaciar catálogo.
* Crear carpeta.
* Editar carpeta.
* Borrar carpeta.
* Vaciar carpeta.
* Crear producto.
* Editar producto.
* Eliminar producto.
* Reemplazar imágenes.
* Configurar columnas.
* Configurar ayudas contextuales.

**Estado:** ✅ Backend completo (backend Fase 6). Integración UI formularios/imágenes manuales → frontend.

---

#### Fase 4 — Filtros y búsqueda

* Búsqueda por carpeta.
* Búsqueda por catálogo.
* Búsqueda global.
* Normalización de códigos.
* Filtros por columna.
* Pills de filtros activos.
* Limpieza de filtros.
* Optimización de rendimiento.

**Estado:** ✅ Backend completo (backend Fase 7). Integración UI buscador/filtros/pills → frontend.

---

#### Fase 5 — Importador

* Subida de Excel.
* Respaldo.
* Selección de tipo de destino — ✅ Catálogos · ⏳ Precios.
* Selección de catálogo y carpeta — ✅.
* Selección de lista de precios — ⏳.
* Creación rápida mediante `+` — ✅ catálogo/carpeta · ⏳ lista de precios.
* Análisis de hojas.
* Detección de encabezados.
* Vista previa.
* Detección de coincidencias.
* Combinar lista.
* Reemplazar lista.
* Aplicar lista.
* Confirmaciones.

**Estado:** ✅ Backend completo para **importación de catálogos** (backend Fase 4). ⏳ Tipo destino Precios, listas de precios e import Excel de precios (RF-053–059). Detalle: [`METHOD-IMPORT.md`](./METHOD-IMPORT.md). Integración UI asistente → frontend.

---

#### Fase 6 — Imágenes

* Extracción de imágenes embebidas.
* Importación mediante ZIP.
* Asociación por código.
* Generación de miniaturas.
* Modal de imagen ampliada.
* Revisión manual.
* Reemplazo de imágenes.

**Estado:** ✅ Backend completo (backend Fase 5). UI miniaturas en tabla, panel revisión y modal ampliado ⏳.

---

#### Fase adicional — Precios

* Crear sección Precios en el sidenav.
* Crear listas de precios.
* Crear columnas dinámicas de precios.
* Importar Excel de precios.
* Detectar columnas y filas.
* Omitir procesamiento de imágenes.
* Combinar listas de precios.
* Reemplazar listas de precios.
* Consultar precios desde el panel.
* Configurar columnas de precios.
* Definir filtros simples para precios en una etapa posterior.

**Estado:** ⏳ Nueva funcionalidad a implementar (RF-053–059). Sin modelos ni APIs — ver [`BACKEND-IMPLEMENTATION.md`](./BACKEND-IMPLEMENTATION.md) §4.2.

---

#### Fase 7 — Archivos subidos

* Historial.
* Descarga.
* Estado de importaciones.
* Informes.
* Reprocesamiento.
* Relación con catálogos, carpetas y listas de precios.

**Estado:** ✅ Backend Fase 8 (RF-043): listado, descarga (URL firmada), informe, reproceso, eliminación. Respaldo en upload ✅. UI `/admin/archivos` pendiente.

---

#### Fase 8 — Offline

* PWA.
* IndexedDB.
* Sincronización.
* Búsquedas offline.
* Filtros offline.
* Miniaturas offline.
* Bloqueo de edición.
* Consulta offline de precios, si se habilita.

**Estado:** ⏳ (backend Fase 9). Señal `grg:offline:clear` preparada en logout.

---

#### Fase 9 — Pruebas y entrega

* Pruebas con archivos reales.
* Pruebas de imágenes.
* Pruebas de búsqueda.
* Pruebas de filtros acumulables.
* Pruebas de combinar/reemplazar.
* Pruebas de visibilidad por usuario.
* Pruebas de ayudas contextuales.
* Pruebas de listas de precios.
* Pruebas offline.
* Capacitación.
* Documentación.
* Despliegue en dominio final.

**Estado:** ⏳ (backend Fase 10).

---

### 49. Funciones fuera del alcance

No se incluyen inicialmente:

* Ejecución de macros VBA.
* Edición de archivos Excel desde la web.
* Edición offline.
* Sincronización de modificaciones offline.
* OCR.
* Inteligencia artificial.
* Búsqueda semántica.
* Aplicación móvil nativa.
* Multiempresa.
* Facturación.
* Control de stock.
* Ventas.
* Carrito de compras.
* Pagos.
* Integración contable.
* Integración automática con proveedores.
* Conversión automática de cualquier estructura sin configuración.
* Reconocimiento visual del contenido de las imágenes.
* Edición avanzada de fotografías.
* Asociación de imágenes a listas de precios.
* Galerías de imágenes en Precios.
* Reconocimiento de imágenes en Excel de Precios.
* Filtros avanzados de Precios en la primera versión.
* Relación automática entre productos de Catálogos y registros de Precios.
* Sincronización automática de precios con proveedores externos.
* NestJS.

---

### 50. Criterios de aceptación

#### Catálogos y carpetas

* Los catálogos aparecen automáticamente en el panel.
* Cada catálogo puede contener carpetas.
* Las carpetas pueden tener columnas diferentes.
* Se pueden agregar nuevos catálogos sin modificar el código.
* Se pueden crear carpetas desde el panel.
* Se pueden editar nombres de catálogos y carpetas.
* Se pueden borrar y vaciar catálogos con confirmación.
* Se pueden borrar y vaciar carpetas con confirmación.

---

#### Columnas

* El administrador puede ver el nombre original de cada columna.
* El nombre original de la columna no es editable.
* El administrador puede editar el nombre visible de cada columna.
* El nombre visible se muestra como cabecera de la tabla.
* El administrador puede activar o desactivar la visibilidad de la columna para usuarios normales.
* El administrador puede configurar si una columna es buscable.
* El administrador puede configurar si una columna es filtrable.
* El administrador puede agregar texto de ayuda opcional a una columna.
* El administrador puede agregar imagen de ayuda opcional a una columna.
* Si una columna no tiene texto ni imagen de ayuda, no se muestra el ícono `Info`.
* Si una columna tiene texto o imagen de ayuda, se muestra el ícono `Info`.
* Al hacer hover, focus o tap sobre el ícono `Info`, se muestra la ayuda disponible.
* Si la ayuda contiene imagen, la imagen puede abrirse en un modal ampliado.
* El modal de imagen de ayuda muestra la descripción si existe.
* El modal no se abre vacío.

---

#### Usuarios y permisos

* El admin puede editar.
* El user normal solo puede ver.
* Los controles de edición no aparecen para el user normal.
* El admin puede ocultar catálogos para users normales.
* El admin puede ocultar carpetas para users normales.
* El admin puede ocultar columnas para users normales.
* El user normal solo puede ver ayudas contextuales de columnas visibles.

---

#### Importación

* El archivo original queda respaldado.
* El sistema detecta hojas y columnas.
* El administrador selecciona tipo de destino.
* El administrador selecciona catálogo y carpeta destino para Catálogos.
* El administrador selecciona lista de precios destino para Precios.
* El administrador puede crear catálogo desde el asistente.
* El administrador puede crear carpeta desde el asistente.
* El administrador puede crear lista de precios desde el asistente.
* Se muestra una vista previa de registros reconocidos.
* Los registros coincidentes se resaltan.
* Si el destino está vacío, se puede aplicar la lista.
* Si el destino tiene registros, se puede combinar o reemplazar.
* Las acciones de combinar y reemplazar muestran confirmación cuando corresponde.
* Los campos dinámicos se conservan.
* Las fórmulas se importan mediante su valor calculado.
* Las macros no se ejecutan.
* Una importación fallida no reemplaza datos activos.

---

#### Productos

* El administrador puede crear productos.
* El administrador puede editar productos.
* El administrador puede eliminar productos.
* Todas las columnas pueden editarse por admin.
* Las imágenes pueden reemplazarse por admin.
* El user normal solo puede visualizar productos.

---

#### Imágenes

* Se extraen imágenes embebidas compatibles en catálogos.
* Se importan imágenes externas en catálogos.
* Las asociaciones por código funcionan.
* Las imágenes ambiguas quedan pendientes.
* Un producto admite múltiples imágenes.
* Una imagen dañada no cancela la importación completa.
* Se muestran miniaturas.
* Al hacer click en una imagen existente, se abre un modal ampliado.
* No se abre modal si el producto no tiene imagen.
* El modal tiene cruz de cierre.
* Las imágenes de ayuda de columna no se tratan como imágenes de producto.

---

#### Búsqueda y filtros

* Cada carpeta tiene un buscador.
* Cada catálogo puede buscar entre sus carpetas.
* El buscador global recorre todos los catálogos visibles.
* Los resultados indican catálogo y carpeta.
* Las equivalencias participan en la búsqueda.
* Los separadores de códigos no impiden encontrar resultados.
* Cada columna filtrable permite aplicar un filtro.
* Los filtros son acumulables.
* Los filtros activos se muestran como pills.
* Cada pill puede eliminarse individualmente.
* El usuario puede reducir una lista amplia a resultados relevantes en menos de 5 minutos.

---

#### Precios

* Existe una sección `Precios` en el sidenav.
* La sección Precios es independiente de Catálogos.
* La sección Precios no utiliza imágenes de producto.
* El administrador puede crear listas de precios.
* El administrador puede editar listas de precios.
* El administrador puede borrar listas de precios.
* El administrador puede vaciar listas de precios.
* El administrador puede importar Excel de precios.
* El importador de Precios reconoce columnas y filas.
* El importador de Precios no reconoce ni procesa imágenes.
* El administrador puede combinar listas de precios.
* El administrador puede reemplazar listas de precios.
* Las acciones destructivas de Precios muestran confirmación.
* Las columnas de Precios pueden tener nombre visible editable.
* Las columnas de Precios pueden tener visibilidad configurable.
* Las columnas de Precios pueden tener ayuda contextual opcional.
* El usuario normal solo puede consultar listas de precios visibles, si están habilitadas.

---

#### Archivos

* Existe una sección de archivos subidos.
* Los archivos originales pueden descargarse.
* Se pueden relacionar archivos con catálogos y carpetas.
* Se pueden relacionar archivos con listas de precios.
* Se pueden consultar informes de importación.
* Los archivos anteriores permanecen respaldados.

---

#### Offline

* Los catálogos sincronizados pueden consultarse.
* Las carpetas sincronizadas pueden consultarse.
* Las búsquedas funcionan offline.
* Los filtros funcionan offline.
* Las miniaturas sincronizadas se muestran.
* Las listas de precios sincronizadas pueden consultarse, si se habilita esta opción.
* Las modificaciones quedan bloqueadas.
* La fecha de sincronización es visible.

---

### 51. Criterios de éxito

El proyecto será considerado exitoso cuando:

* Pablo deje de utilizar el pendrive como medio de actualización.
* Ambos locales consulten la misma versión.
* Los archivos nuevos puedan incorporarse desde el panel.
* Los productos puedan organizarse por catálogo y carpeta.
* Los nombres de catálogos y carpetas puedan editarse.
* El administrador pueda adaptar los títulos de columnas sin perder la referencia del Excel original.
* El usuario pueda comprender columnas técnicas mediante ayudas contextuales.
* Las columnas técnicas puedan incluir texto o imagen explicativa.
* Las hojas de Excel puedan transformarse en carpetas utilizables.
* Los productos puedan buscarse sin conocer el archivo de origen.
* Los códigos equivalentes puedan encontrarse.
* Los filtros acumulables permitan reducir rápidamente una búsqueda.
* El usuario pueda encontrar opciones relevantes en menos de 5 minutos.
* Las imágenes de Rulemanes y Catálogo Azul se visualicen correctamente.
* Las imágenes externas de Embragues se relacionen sin depender de rutas locales.
* El administrador pueda corregir datos e imágenes.
* El administrador pueda ocultar catálogos, carpetas o columnas para usuarios normales.
* El usuario normal pueda ver, buscar y filtrar sin editar.
* Las listas de precios puedan importarse y actualizarse desde Excel sin mezclarse con Catálogos.
* El negocio pueda consultar precios desde una sección independiente del panel.
* Los archivos originales permanezcan respaldados.
* La información pueda consultarse sin conexión.
* El sistema sea comprensible para Pablo y su hermano.

---

### 52. Condiciones y supuestos

* Pablo deberá explicar el significado de las columnas particulares.
* Pablo deberá confirmar qué columnas deben ser visibles para usuarios normales.
* Pablo deberá confirmar qué columnas deben ser filtrables.
* Pablo deberá confirmar qué columnas deben ser buscables.
* Pablo deberá definir qué columnas necesitan ayuda contextual.
* Pablo deberá proveer las imágenes explicativas de columnas cuando correspondan.
* Las ayudas contextuales serán opcionales y no bloquearán el uso de una columna.
* Las imágenes de ayuda de columnas no reemplazan imágenes de productos.
* Pablo deberá proporcionar las imágenes externas con sus nombres originales.
* Deberá conservarse la estructura de carpetas de muestra durante el análisis.
* Algunas asociaciones de imágenes podrán requerir revisión manual.
* No se garantiza que todas las fórmulas tengan valores calculados almacenados.
* No se ejecutarán macros.
* Los filtros definitivos se acordarán por carpeta.
* Los filtros globales se definirán después de mapear los campos comunes.
* La sección Precios no tendrá relación automática con Catálogos en la primera versión.
* Los filtros específicos de Precios se definirán posteriormente.
* Los Excel de Precios podrán tener estructuras variables y requerir configuración inicial.
* El modo offline requerirá una sincronización previa.
* La primera importación podrá requerir configuración y asistencia de GRG.
* Los nuevos catálogos podrán reutilizar configuraciones anteriores cuando posean estructuras similares.
* Los Excel con estructuras muy diferentes podrán requerir configuración adicional.
* NestJS queda excluido de toda la arquitectura presente y futura del proyecto.
