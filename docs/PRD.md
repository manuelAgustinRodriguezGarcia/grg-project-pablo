# PRD — Sistema Web de Catálogos Técnicos de Repuestos

## Tabla de contenidos

- [Parte I — Contexto y visión](#parte-i--contexto-y-visión)
  - [1. Información general](#1-información-general)
  - [2. Contexto actual](#2-contexto-actual)
  - [3. Archivos de muestra analizados](#3-archivos-de-muestra-analizados)
  - [4. Objetivos](#4-objetivos)
  - [5. Principios del producto](#5-principios-del-producto)
- [Parte II — Modelo de dominio y usuarios](#parte-ii--modelo-de-dominio-y-usuarios)
  - [6. Estructura conceptual del contenido](#6-estructura-conceptual-del-contenido)
  - [7. Usuarios y permisos](#7-usuarios-y-permisos)
- [Parte III — Experiencia de usuario](#parte-iii--experiencia-de-usuario)
  - [8. Landing pública](#8-landing-pública)
  - [9. Autenticación](#9-autenticación)
  - [10. Directorio general](#10-directorio-general)
  - [11. Navegación de catálogos](#11-navegación-de-catálogos)
  - [12. Gestión de catálogos y secciones](#12-gestión-de-catálogos-y-secciones)
  - [13. Gestión manual de registros](#13-gestión-manual-de-registros)
- [Parte IV — Importación de datos](#parte-iv--importación-de-datos)
  - [14. Importación de archivos Excel](#14-importación-de-archivos-excel)
  - [15. Fórmulas de Excel](#15-fórmulas-de-excel)
  - [16. Macros de Visual Basic](#16-macros-de-visual-basic)
  - [17. Actualización y reimportación](#17-actualización-y-reimportación)
  - [18. Publicación segura de importaciones](#18-publicación-segura-de-importaciones)
  - [19. Informe de importación](#19-informe-de-importación)
- [Parte V — Imágenes](#parte-v--imágenes)
  - [20. Gestión de imágenes](#20-gestión-de-imágenes)
  - [21. Imágenes embebidas](#21-imágenes-embebidas)
  - [22. Imágenes externas](#22-imágenes-externas)
  - [23. Formatos de imagen](#23-formatos-de-imagen)
  - [24. Asociación y revisión de imágenes](#24-asociación-y-revisión-de-imágenes)
  - [25. Visualización de imágenes](#25-visualización-de-imágenes)
- [Parte VI — Búsqueda, códigos y filtros](#parte-vi--búsqueda-códigos-y-filtros)
  - [26. Códigos y equivalencias](#26-códigos-y-equivalencias)
  - [27. Normalización de búsqueda](#27-normalización-de-búsqueda)
  - [28. Búsqueda por sección](#28-búsqueda-por-sección)
  - [29. Búsqueda por catálogo](#29-búsqueda-por-catálogo)
  - [30. Búsqueda global](#30-búsqueda-global)
  - [31. Filtros por sección](#31-filtros-por-sección)
  - [32. Filtros globales](#32-filtros-globales)
  - [33. Configuración de columnas](#33-configuración-de-columnas)
- [Parte VII — Archivos y modo offline](#parte-vii--archivos-y-modo-offline)
  - [34. Archivos subidos](#34-archivos-subidos)
  - [35. Modo offline](#35-modo-offline)
  - [36. Imágenes offline](#36-imágenes-offline)
- [Parte VIII — Requerimientos](#parte-viii--requerimientos)
  - [37. Requerimientos funcionales](#37-requerimientos-funcionales)
  - [38. Requerimientos no funcionales](#38-requerimientos-no-funcionales)
- [Parte IX — Arquitectura técnica](#parte-ix--arquitectura-técnica)
  - [39. Modelo conceptual de datos](#39-modelo-conceptual-de-datos)
  - [40. Estrategia de almacenamiento](#40-estrategia-de-almacenamiento)
  - [41. Stack tecnológico propuesto](#41-stack-tecnológico-propuesto)
  - [42. Arquitectura propuesta](#42-arquitectura-propuesta)
  - [43. Servicios principales](#43-servicios-principales)
  - [44. Flujo resumido de importación](#44-flujo-resumido-de-importación)
- [Parte X — Planificación y cierre](#parte-x--planificación-y-cierre)
  - [45. Roadmap funcional](#45-roadmap-funcional)
  - [46. Funciones fuera del alcance](#46-funciones-fuera-del-alcance)
  - [47. Criterios de aceptación](#47-criterios-de-aceptación)
  - [48. Criterios de éxito](#48-criterios-de-éxito)
  - [49. Condiciones y supuestos](#49-condiciones-y-supuestos)

---

## Parte I — Contexto y visión

### 1. Información general

#### Nombre provisional

Sistema Web de Catálogos Técnicos de Repuestos

#### Cliente

Pablo R.
Casa de repuestos para camiones y vehículos pesados.
Chaco, Argentina.

#### Tipo de producto

Aplicación web privada para la administración y consulta de catálogos técnicos, acompañada por una landing institucional pública.

#### Objetivo principal

Reemplazar el sistema actual de archivos Excel transportados físicamente mediante pendrive por una plataforma web centralizada, segura y accesible desde diferentes ubicaciones.

La plataforma deberá permitir que Pablo, su hermano y otros usuarios autorizados consulten la misma información actualizada sin depender de copias locales ni traslados físicos.

---

### 2. Contexto actual

Pablo administra múltiples catálogos técnicos mediante archivos Excel.

Cada archivo representa un rubro distinto y puede contener:

- Varias hojas.
- Diferentes cantidades de columnas.
- Criterios de búsqueda particulares.
- Códigos principales.
- Códigos equivalentes.
- Fórmulas.
- Imágenes embebidas.
- Imágenes externas vinculadas mediante rutas locales.
- Macros de Visual Basic utilizadas para mostrar imágenes.

Actualmente Pablo actualiza los archivos, los copia en un pendrive y recorre aproximadamente 60 kilómetros para llevar la versión actualizada a la casa de repuestos de su hermano.

Este procedimiento provoca:

- Dependencia de dispositivos físicos.
- Duplicación de archivos.
- Riesgo de utilizar versiones desactualizadas.
- Posibilidad de pérdida o corrupción del pendrive.
- Dificultad para mantener ambos locales sincronizados.
- Pérdida de tiempo en traslados.
- Búsquedas fragmentadas entre múltiples archivos.
- Dependencia de Excel y de rutas locales específicas.
- Dificultad para incorporar nuevos catálogos de manera ordenada.

---

### 3. Archivos de muestra analizados

#### 3.1 Rulemanes

Características identificadas:

- Archivo `.xlsx`.
- Tres hojas.
- Algunas hojas contienen imágenes pegadas directamente en las filas.
- No depende de una carpeta externa de imágenes.
- Las hojas poseen estructuras y columnas propias.

Ejemplo de estructura:

```text
Rulemanes
├── Rodamientos
├── Tensores pesados
└── Tensores livianos
```

#### 3.2 Catálogo Azul

Características identificadas:

- Archivo `.xlsx`.
- Gran cantidad de hojas.
- La muestra recibida posee múltiples rubros y una hoja de índice.
- Pablo indicó que el catálogo completo puede contener aproximadamente 35 pestañas.
- Las imágenes están pegadas directamente en las hojas.
- Algunas filas pueden tener varias imágenes relacionadas.
- La hoja de índice funciona actualmente como carátula o directorio manual.

En la aplicación web, esa carátula no deberá mantenerse manualmente. El sistema deberá generar el directorio automáticamente según los catálogos y secciones disponibles.

#### 3.3 Embragues

Características identificadas:

- Archivo `.xlsm`.
- Tres hojas principales.
- Dos hojas utilizan imágenes almacenadas en una carpeta externa.
- Las imágenes se relacionan mediante códigos o nombres de archivo.
- El archivo contiene macros de Visual Basic.
- Las macros muestran una imagen al desplazarse por determinadas filas.
- Las rutas dependen actualmente de una carpeta local de Windows.

Ejemplo de ruta utilizada por el sistema actual:

```text
Mis documentos\Imagenes catalogos\Embragues
```

La plataforma web no deberá ejecutar estas macros ni depender de rutas locales.

El comportamiento deberá reemplazarse por:

- Asociación de imágenes mediante código.
- Miniatura en la tabla o detalle.
- Apertura ampliada de la imagen.
- Almacenamiento centralizado.

---

### 4. Objetivos

#### 4.1 Objetivo general

Crear una plataforma web que permita:

- Centralizar catálogos de diferentes estructuras.
- Consultar la información desde ambos locales.
- Incorporar nuevos archivos sin modificar el código.
- Administrar productos manualmente.
- Buscar dentro de cada sección.
- Buscar simultáneamente en todos los catálogos.
- Gestionar códigos equivalentes.
- Procesar imágenes embebidas y externas.
- Mantener los archivos originales respaldados.
- Consultar información sin conexión en modo lectura.

#### 4.2 Objetivos específicos

- Eliminar el traslado de archivos mediante pendrive.
- Mantener una única versión central de los catálogos.
- Permitir que cada archivo conserve su estructura particular.
- Representar cada hoja como una sección configurable.
- Generar automáticamente el directorio general.
- Permitir agregar nuevos catálogos desde el panel.
- Permitir reemplazar versiones anteriores de un catálogo.
- Procesar archivos Excel con estructuras variables.
- Conservar columnas que no estén estandarizadas.
- Extraer imágenes pegadas dentro de Excel.
- Asociar imágenes externas mediante códigos o nombres.
- Permitir correcciones manuales de asociaciones.
- Normalizar códigos para mejorar las búsquedas.
- Permitir filtros diferentes en cada sección.
- Permitir filtros globales entre catálogos.
- Mantener una interfaz simple para usuarios no técnicos.

---

### 5. Principios del producto

#### 5.1 Flexibilidad

La plataforma no deberá depender de una estructura fija de Excel.

Cada catálogo y cada sección podrán tener:

- Columnas diferentes.
- Filtros diferentes.
- Campos buscables diferentes.
- Distintas formas de asociar imágenes.
- Reglas particulares de visualización.

#### 5.2 Preservación de la información

El sistema deberá conservar:

- Archivo original.
- Nombre original de columnas.
- Contenido original de las celdas.
- Saltos de línea relevantes.
- Códigos escritos por Pablo.
- Fórmulas originales cuando sea necesario.
- Valor calculado de las fórmulas.
- Imágenes.
- Relación de cada imagen con su fila y columna de origen.

#### 5.3 Simplicidad de uso

La plataforma deberá evitar que Pablo necesite conocimientos de bases de datos o programación.

Las operaciones complejas deberán presentarse mediante asistentes guiados.

#### 5.4 Seguridad

Los catálogos no serán públicos.

Solo podrán acceder usuarios autenticados y autorizados.

---

## Parte II — Modelo de dominio y usuarios

### 6. Estructura conceptual del contenido

El sistema utilizará tres niveles principales:

```text
Catálogo
└── Sección
    └── Registro
```

#### 6.1 Catálogo

Representa un archivo o rubro principal.

Ejemplos:

- Rulemanes.
- Catálogo Azul.
- Embragues.

#### 6.2 Sección

Representa generalmente una hoja del Excel.

Ejemplos:

```text
Embragues
├── Placas
├── Discos
└── Crapodinas
```

Cada sección podrá tener sus propias:

- Columnas.
- Reglas de búsqueda.
- Imágenes.
- Filtros.
- Configuraciones de visualización.

#### 6.3 Registro

Representa una fila de datos dentro de una sección.

Según el catálogo, un registro puede representar:

- Un producto.
- Un repuesto.
- Una aplicación.
- Una equivalencia.
- Un conjunto técnico.
- Una combinación de códigos.

El sistema utilizará internamente el término `registro` para no asumir que todas las filas representan exactamente el mismo tipo de entidad.

---

### 7. Usuarios y permisos

#### 7.1 Visitante público

Podrá acceder únicamente a la landing institucional.

No podrá consultar catálogos ni productos.

#### 7.2 Administrador

Podrá:

- Iniciar sesión.
- Consultar todos los catálogos.
- Crear catálogos.
- Editar catálogos.
- Activar o desactivar catálogos.
- Subir archivos.
- Importar hojas.
- Reemplazar catálogos o secciones.
- Crear registros manualmente.
- Editar registros.
- Eliminar registros.
- Administrar imágenes.
- Configurar columnas.
- Configurar filtros.
- Configurar campos buscables.
- Descargar archivos originales.
- Gestionar usuarios.
- Consultar errores de importación.

#### 7.3 Usuario de consulta

Podrá:

- Iniciar sesión.
- Consultar el directorio.
- Abrir catálogos y secciones.
- Utilizar búsquedas.
- Aplicar filtros.
- Consultar imágenes.
- Utilizar el modo offline previamente sincronizado.

No podrá realizar modificaciones.

---

## Parte III — Experiencia de usuario

### 8. Landing pública

La aplicación contará con una landing institucional básica.

Deberá incluir:

- Logo.
- Nombre del negocio.
- Título principal.
- Descripción.
- Datos de contacto.
- Horarios.
- Dirección.
- Ubicación.
- Marcas comercializadas.
- Botón de contacto.
- Acceso al sistema.

La landing no mostrará información privada de los catálogos.

Los textos dirigidos al cliente deberán utilizar un tono formal y tratarlo de "Usted".

---

### 9. Autenticación

El sistema deberá permitir:

- Inicio de sesión con correo y contraseña.
- Cierre de sesión.
- Recuperación de contraseña.
- Protección de rutas privadas.
- Persistencia segura de la sesión.
- Control de permisos.
- Desactivación de usuarios.
- Cierre de sesión en el dispositivo.
- Eliminación de datos offline al cerrar sesión, cuando corresponda.

---

### 10. Directorio general

Después de iniciar sesión, el usuario accederá a un directorio general.

Este directorio deberá mostrar automáticamente los catálogos activos.

Cada catálogo podrá mostrarse mediante una tarjeta con:

- Nombre.
- Descripción.
- Imagen o icono opcional.
- Cantidad de secciones.
- Fecha de última actualización.
- Botón para abrir.
- Estado de sincronización offline.

Cuando el administrador agregue un nuevo catálogo, este deberá incorporarse automáticamente al directorio.

No será necesario editar manualmente una hoja índice ni modificar el código de la aplicación.

El administrador podrá configurar:

- Orden de los catálogos.
- Estado visible u oculto.
- Título.
- Descripción.
- Imagen representativa.
- Color o identificador visual opcional.

---

### 11. Navegación de catálogos

Al abrir un catálogo, el usuario podrá ver:

- Nombre.
- Descripción.
- Fecha de actualización.
- Lista de secciones.
- Buscador del catálogo.
- Acceso a filtros.
- Estado de conexión.

Cada sección podrá abrirse como una tabla independiente.

En catálogos con muchas secciones se podrá utilizar:

- Menú lateral.
- Selector desplegable.
- Pestañas.
- Buscador de secciones.

La solución visual definitiva se definirá durante el diseño de interfaz.

---

### 12. Gestión de catálogos y secciones

#### 12.1 Gestión de catálogos

El administrador podrá:

- Crear un catálogo.
- Editar su información.
- Activarlo.
- Desactivarlo.
- Cambiar su orden.
- Reemplazar su archivo.
- Eliminarlo.
- Asociarlo con archivos subidos.

#### 12.2 Gestión de secciones

El administrador podrá:

- Crear secciones manualmente.
- Crear secciones desde hojas de Excel.
- Renombrar una sección.
- Cambiar su orden.
- Activarla o desactivarla.
- Configurar sus columnas.
- Configurar su buscador.
- Configurar sus filtros.
- Eliminarla.

#### 12.3 Hojas auxiliares

Durante una importación, una hoja podrá marcarse como:

- Sección importable.
- Hoja índice.
- Hoja auxiliar.
- Hoja ignorada.

Las hojas índice de Excel no tendrán que convertirse obligatoriamente en tablas dentro del sistema.

---

### 13. Gestión manual de registros

El administrador podrá:

- Crear un registro.
- Editar un registro.
- Eliminar un registro.
- Duplicar un registro.
- Editar campos dinámicos.
- Agregar equivalencias.
- Eliminar equivalencias.
- Agregar imágenes.
- Reemplazar imágenes.
- Consultar fecha de creación.
- Consultar fecha de modificación.

Los formularios deberán generarse según la configuración de columnas de cada sección.

---

## Parte IV — Importación de datos

### 14. Importación de archivos Excel

#### 14.1 Formatos iniciales

El MVP deberá admitir:

- `.xlsx`
- `.xlsm`

Los archivos `.xlsm` serán procesados únicamente como fuentes de datos.

El sistema:

- No ejecutará macros.
- No ejecutará código Visual Basic.
- No dependerá de rutas locales.
- No replicará internamente la lógica VBA.

El soporte para `.xls` antiguo quedará sujeto a validación técnica.

#### 14.2 Flujo general de importación

1. El administrador selecciona un archivo.
2. El sistema valida su formato y tamaño.
3. El archivo original se almacena como respaldo.
4. Se analizan sus hojas.
5. Se detectan columnas, filas, fórmulas e imágenes.
6. Se muestra una vista previa.
7. El administrador selecciona las hojas que desea importar.
8. Cada hoja seleccionada se relaciona con una sección.
9. Se configuran las columnas especiales.
10. Se configuran las imágenes.
11. Se valida la importación.
12. El sistema procesa los datos en estado preliminar.
13. Se muestra un resumen.
14. El administrador confirma la publicación.
15. Los datos pasan a estar disponibles para los usuarios.

#### 14.3 Selección de hojas

El sistema deberá permitir seleccionar:

- Una hoja.
- Varias hojas.
- Todas las hojas válidas.

Cada hoja podrá:

- Crear una sección nueva.
- Reemplazar una sección existente.
- Ser ignorada.
- Marcarse como índice o auxiliar.

#### 14.4 Detección de encabezados

El sistema deberá intentar detectar:

- Fila de encabezados.
- Columnas vacías.
- Encabezados duplicados.
- Celdas combinadas.
- Filas decorativas.
- Títulos previos a la tabla.
- Columnas sin nombre.

Cuando la detección no sea segura, el administrador podrá seleccionar manualmente la fila de encabezados.

#### 14.5 Mapeo de columnas

El administrador podrá indicar qué columna corresponde a:

- Código principal.
- Código alternativo.
- Equivalencias.
- Descripción.
- Marca.
- Categoría.
- Modelo.
- Aplicación.
- Fabricante.
- Código de imagen.
- Observaciones.
- Otro campo global.

Las columnas no mapeadas deberán poder conservarse como campos dinámicos.

#### 14.6 Contenido dinámico

El sistema no deberá exigir que todos los catálogos utilicen las mismas columnas.

Los valores particulares se almacenarán de forma flexible.

Ejemplo:

```text
Sección A:
Código | Descripción | Marca | Aplicación

Sección B:
Número | Diámetro | Medida | Modelo | Imagen

Sección C:
Referencia | Equivalencias | Fabricante
```

Las tres estructuras deberán coexistir sin generar nuevas tablas físicas en la base de datos.

---

### 15. Fórmulas de Excel

Algunos archivos contienen fórmulas.

El importador deberá:

- Leer el valor calculado disponible.
- Conservar opcionalmente la fórmula original.
- No ejecutar fórmulas arbitrarias en el servidor.
- Advertir cuando una fórmula no tenga un valor calculado guardado.
- Permitir corregir manualmente el valor después de la importación.

Ejemplo:

```text
Fórmula original: =(12)*25.4
Valor importado: 304.8
```

El valor mostrado en la aplicación será el resultado calculado.

---

### 16. Macros de Visual Basic

El sistema no ejecutará ni trasladará macros de Visual Basic.

Las funciones utilizadas actualmente mediante macros deberán recrearse como funciones web.

Ejemplo del catálogo de Embragues:

```text
Comportamiento actual:
Moverse por una fila → la macro busca una imagen local → muestra una miniatura.

Comportamiento web:
Abrir o seleccionar el registro → el sistema consulta la imagen asociada → muestra una miniatura o galería.
```

Las macros podrán analizarse para comprender la relación entre datos e imágenes, pero no formarán parte de la aplicación final.

---

### 17. Actualización y reimportación

El administrador podrá utilizar un archivo para:

- Crear un catálogo nuevo.
- Crear nuevas secciones.
- Reemplazar una sección.
- Reemplazar un catálogo completo.

Durante el MVP, las estrategias seguras serán:

#### 17.1 Crear nuevo

Genera un catálogo independiente.

#### 17.2 Reemplazar sección

Sustituye todos los registros de una sección seleccionada.

#### 17.3 Reemplazar catálogo

Sustituye todas las secciones seleccionadas del catálogo.

Antes de reemplazar datos se deberá:

- Mostrar una vista previa.
- Informar qué se reemplazará.
- Solicitar confirmación.
- Conservar el archivo anterior.
- Evitar que una importación fallida elimine la versión vigente.

La actualización individual por coincidencia de códigos podrá evaluarse posteriormente debido a la variedad de estructuras y códigos.

---

### 18. Publicación segura de importaciones

Las importaciones deberán procesarse primero en estado preliminar.

Estados posibles:

- Archivo almacenado.
- Analizando.
- Pendiente de configuración.
- Procesando.
- Pendiente de revisión.
- Listo para publicar.
- Publicado.
- Fallido.
- Cancelado.

Los registros nuevos no deberán reemplazar la versión activa hasta que la importación se complete correctamente y sea confirmada.

---

### 19. Informe de importación

Al finalizar, el sistema deberá informar:

- Hojas detectadas.
- Hojas importadas.
- Registros procesados.
- Registros creados.
- Registros omitidos.
- Fórmulas detectadas.
- Imágenes detectadas.
- Imágenes asociadas.
- Imágenes pendientes.
- Imágenes rechazadas.
- Columnas detectadas.
- Errores.
- Advertencias.

Los errores deberán presentarse con lenguaje comprensible.

---

## Parte V — Imágenes

### 20. Gestión de imágenes

#### 20.1 Tipos de imágenes soportadas

El sistema deberá manejar:

1. Imágenes embebidas en Excel.
2. Imágenes externas asociadas por código.
3. Imágenes externas asociadas por nombre de archivo.
4. Imágenes cargadas manualmente.
5. Varias imágenes dentro de una misma fila.

#### 20.2 Imágenes opcionales

Un registro podrá tener:

- Ninguna imagen.
- Una imagen.
- Varias imágenes.

La ausencia de una imagen no deberá impedir la importación.

---

### 21. Imágenes embebidas

Las imágenes pegadas dentro de las hojas deberán extraerse durante la importación.

El sistema deberá considerar:

- Hoja de origen.
- Fila de anclaje.
- Columna de anclaje.
- Posición de la imagen.
- Encabezado de la columna.
- Registro relacionado.

La columna de origen podrá utilizarse para identificar la función de la imagen.

Ejemplo:

```text
Registro
├── Imagen principal
├── Imagen de componentes
├── Imagen de reparación
└── Imagen de aplicación
```

Cuando la asociación no sea segura, la imagen deberá quedar pendiente de revisión.

---

### 22. Imágenes externas

Para archivos como Embragues, el administrador deberá poder subir:

- El archivo Excel.
- Un archivo ZIP con las imágenes.
- Varias imágenes seleccionadas manualmente.

El sistema deberá intentar asociarlas mediante:

- Código de imagen.
- Código del producto.
- Nombre del archivo.
- Nombre sin extensión.
- Columna configurada.
- Regla de asociación definida en la importación.

Ejemplo:

```text
Código de imagen en Excel:
PLACA-55120IAR

Archivo:
PLACA-55120IAR.jpg
```

Ambos deberán asociarse automáticamente.

Las rutas locales originales de Windows no deberán almacenarse como dependencia de funcionamiento.

---

### 23. Formatos de imagen

El sistema admitirá inicialmente:

- `.jpg`
- `.jpeg`
- `.png`
- `.webp`

Deberá validar:

- Extensión.
- Tipo MIME.
- Tamaño.
- Integridad.
- Nombre de archivo.
- Posibles duplicados.

Una imagen dañada no deberá cancelar toda la importación.

---

### 24. Asociación y revisión de imágenes

Cada imagen podrá tener uno de estos estados:

- Asociada automáticamente.
- Asociada manualmente.
- Pendiente de revisión.
- Archivo no encontrado.
- Asociación ambigua.
- Nombre duplicado.
- Formato rechazado.
- Eliminada.

El panel deberá incluir una sección de revisión de imágenes.

El administrador podrá:

- Ver imágenes no asociadas.
- Buscar un registro.
- Asociar la imagen manualmente.
- Reemplazar una asociación.
- Eliminar la imagen.
- Marcar una imagen como principal.
- Cambiar el orden.
- Cambiar su etiqueta o función.

---

### 25. Visualización de imágenes

Las tablas podrán mostrar miniaturas optimizadas.

El detalle de un registro podrá mostrar:

- Imagen principal.
- Galería.
- Vista ampliada.
- Etiqueta de cada imagen.
- Imagen de reemplazo cuando no exista una fotografía.

Las imágenes no deberán cargarse todas en tamaño completo dentro de una tabla.

Se utilizarán miniaturas para mantener el rendimiento.

---

## Parte VI — Búsqueda, códigos y filtros

### 26. Códigos y equivalencias

#### 26.1 Código principal

Cada registro podrá tener un código principal opcional.

#### 26.2 Equivalencias

Un registro podrá contener:

- Ninguna equivalencia.
- Una equivalencia.
- Múltiples equivalencias.

#### 26.3 Celdas con múltiples códigos

Algunas celdas pueden contener varios códigos separados mediante:

- Saltos de línea.
- Signos igual.
- Guiones.
- Barras.
- Espacios.
- Paréntesis.
- Texto descriptivo.

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

### 27. Normalización de búsqueda

La búsqueda deberá ignorar diferencias de formato que no alteren el código.

Como mínimo:

- Mayúsculas y minúsculas.
- Espacios.
- Guiones.
- Guiones bajos.
- Puntos.
- Barras.
- Separadores configurados.

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

### 28. Búsqueda por sección

Cada sección tendrá su propio buscador.

Podrá buscar sobre:

- Código principal.
- Equivalencias.
- Descripción.
- Marca.
- Categoría.
- Modelo.
- Aplicación.
- Columnas configuradas como buscables.

Cada sección podrá definir qué columnas participan en la búsqueda.

---

### 29. Búsqueda por catálogo

Dentro de un catálogo se podrá realizar una búsqueda que recorra todas sus secciones.

Ejemplo:

```text
Catálogo: Embragues

La búsqueda recorre:
- Placas
- Discos
- Crapodinas
```

Cada resultado deberá indicar la sección de origen.

---

### 30. Búsqueda global

La búsqueda global será una función principal del sistema.

Permitirá buscar simultáneamente en:

- Todos los catálogos activos.
- Todas las secciones activas.
- Códigos principales.
- Equivalencias.
- Descripciones.
- Campos configurados como globalmente buscables.

Cada resultado deberá mostrar:

- Catálogo.
- Sección.
- Código principal.
- Descripción.
- Coincidencia encontrada.
- Imagen principal, cuando exista.
- Acción para abrir el registro.

El usuario no deberá conocer previamente en qué archivo o sección se encuentra el repuesto.

---

### 31. Filtros por sección

Cada sección podrá tener filtros diferentes.

Ejemplos:

- Marca.
- Medida.
- Modelo.
- Fabricante.
- Aplicación.
- Tipo.
- Diámetro.
- Vehículo.
- Categoría.

El administrador podrá indicar qué columnas son filtrables.

Los filtros concretos se definirán con Pablo para cada rubro.

---

### 32. Filtros globales

El buscador global contará con filtros comunes entre catálogos.

Los filtros definitivos se definirán posteriormente con Pablo.

Ejemplos posibles:

- Catálogo.
- Sección.
- Marca.
- Categoría.
- Fabricante.
- Aplicación.
- Con imagen.
- Con equivalencias.

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

---

### 33. Configuración de columnas

Cada columna podrá configurarse como:

- Visible.
- Oculta.
- Editable.
- Buscable.
- Buscable globalmente.
- Filtrable.
- Filtrable globalmente.
- Código principal.
- Equivalencia.
- Descripción.
- Código de imagen.
- Obligatoria.
- Solo lectura.

También se podrá configurar:

- Nombre visible.
- Orden.
- Tipo de dato.
- Ancho.
- Formato.
- Unidad.
- Etiqueta.

---

## Parte VII — Archivos y modo offline

### 34. Archivos subidos

El sistema tendrá una sección denominada **Archivos subidos**.

Por cada archivo se mostrará:

- Nombre original.
- Extensión.
- Tamaño.
- Fecha de carga.
- Usuario.
- Catálogo relacionado.
- Cantidad de hojas.
- Hojas importadas.
- Estado.
- Fecha del último procesamiento.
- Cantidad de registros.
- Cantidad de imágenes.
- Errores encontrados.

Acciones:

- Descargar original.
- Consultar detalles.
- Reprocesar.
- Crear un nuevo catálogo.
- Reemplazar un catálogo.
- Eliminar el archivo.
- Consultar el informe de importación.

La eliminación de un catálogo no deberá eliminar automáticamente el archivo original.

---

### 35. Modo offline

La aplicación deberá permitir consultar información sin conexión.

El modo offline será exclusivamente de lectura.

#### 35.1 Funciones disponibles offline

- Abrir la aplicación.
- Consultar el directorio sincronizado.
- Abrir catálogos.
- Abrir secciones.
- Consultar registros.
- Buscar dentro de una sección.
- Buscar dentro de un catálogo.
- Utilizar la búsqueda global.
- Aplicar filtros.
- Consultar equivalencias.
- Ver miniaturas sincronizadas.

#### 35.2 Funciones bloqueadas offline

- Subir archivos.
- Crear catálogos.
- Editar registros.
- Eliminar registros.
- Reprocesar archivos.
- Administrar imágenes.
- Gestionar usuarios.
- Cambiar configuraciones.

#### 35.3 Estado de conexión

La interfaz deberá mostrar:

- Indicador sin conexión.
- Fecha de última sincronización.
- Advertencia sobre posibles datos desactualizados.
- Funciones bloqueadas.

#### 35.4 Sincronización

Cuando vuelva la conexión:

1. Se verificará si existen actualizaciones.
2. Se descargarán cambios.
3. Se actualizarán los datos locales.
4. Se registrará la nueva fecha de sincronización.

Como no habrá edición offline, no será necesario resolver conflictos de escritura.

---

### 36. Imágenes offline

Para controlar el espacio del dispositivo:

- Se sincronizarán miniaturas optimizadas.
- Las imágenes completas podrán descargarse bajo demanda.
- Se podrá ofrecer una opción para sincronizar imágenes completas.
- Se mostrará un reemplazo cuando una imagen no esté disponible localmente.
- Los archivos Excel originales no se almacenarán offline.

---

## Parte VIII — Requerimientos

### 37. Requerimientos funcionales

| ID | Requerimiento | Descripción |
|---|---|---|
| RF-001 | Autenticación | El sistema deberá permitir iniciar y cerrar sesión. |
| RF-002 | Roles | El sistema deberá diferenciar administradores y usuarios de consulta. |
| RF-003 | Landing pública | La información institucional deberá ser pública, pero los catálogos serán privados. |
| RF-004 | Directorio automático | El sistema deberá generar el directorio según los catálogos activos. |
| RF-005 | Gestión de catálogos | El administrador podrá crear, editar, ordenar, activar y eliminar catálogos. |
| RF-006 | Gestión de secciones | El administrador podrá crear, editar, ordenar y eliminar secciones. |
| RF-007 | Subida de Excel | El administrador podrá subir archivos `.xlsx` y `.xlsm`. |
| RF-008 | Respaldo | El archivo original deberá almacenarse antes de procesarse. |
| RF-009 | Análisis de hojas | El sistema deberá detectar todas las hojas del archivo. |
| RF-010 | Selección de hojas | El administrador podrá seleccionar qué hojas importar. |
| RF-011 | Detección de columnas | El sistema deberá detectar encabezados y columnas. |
| RF-012 | Mapeo | El administrador podrá mapear columnas a campos especiales. |
| RF-013 | Campos dinámicos | Las columnas particulares deberán conservarse sin modificar la base de datos. |
| RF-014 | Fórmulas | El sistema deberá importar valores calculados sin ejecutar fórmulas arbitrarias. |
| RF-015 | Macros | El sistema no deberá ejecutar macros. |
| RF-016 | Imágenes embebidas | El sistema deberá extraer imágenes pegadas cuando sea técnicamente posible. |
| RF-017 | Imágenes externas | El sistema deberá asociar imágenes externas mediante códigos o nombres. |
| RF-018 | Imágenes múltiples | Un registro podrá contener varias imágenes. |
| RF-019 | Revisión de imágenes | Las asociaciones dudosas deberán quedar pendientes de revisión. |
| RF-020 | Gestión manual | El administrador podrá crear, editar y eliminar registros. |
| RF-021 | Equivalencias | Los registros podrán tener múltiples códigos equivalentes. |
| RF-022 | Normalización | El sistema deberá normalizar códigos y consultas. |
| RF-023 | Búsqueda por sección | Cada sección deberá tener un buscador configurable. |
| RF-024 | Búsqueda por catálogo | El sistema deberá buscar entre todas las secciones de un catálogo. |
| RF-025 | Búsqueda global | El sistema deberá buscar entre todos los catálogos activos. |
| RF-026 | Origen del resultado | Cada resultado deberá indicar catálogo y sección. |
| RF-027 | Filtros por sección | Cada sección podrá tener filtros particulares. |
| RF-028 | Filtros globales | La búsqueda global deberá admitir filtros compartidos. |
| RF-029 | Archivos subidos | El administrador podrá consultar y descargar los archivos originales. |
| RF-030 | Reimportación | El administrador podrá reemplazar catálogos o secciones de forma controlada. |
| RF-031 | Publicación segura | Una importación fallida no deberá afectar los datos vigentes. |
| RF-032 | Consulta offline | Los catálogos sincronizados deberán estar disponibles sin conexión. |
| RF-033 | Bloqueo offline | Las modificaciones deberán bloquearse sin conexión. |
| RF-034 | Sincronización | La copia local deberá actualizarse al recuperar Internet. |

---

### 38. Requerimientos no funcionales

#### 38.1 Rendimiento

- Las búsquedas habituales deberán responder rápidamente.
- Las tablas deberán utilizar paginación o virtualización.
- Las imágenes deberán mostrarse mediante miniaturas.
- La búsqueda global deberá utilizar índices.
- Las importaciones extensas deberán mostrar progreso.
- La interfaz no deberá cargar todos los registros simultáneamente.

#### 38.2 Seguridad

- Rutas privadas protegidas.
- Storage privado.
- Validación de archivos.
- Validación MIME.
- Límites de tamaño.
- Sanitización de nombres.
- Archivos ZIP extraídos de forma segura.
- Descargas autorizadas.
- Confirmación antes de eliminaciones.
- Registro de operaciones importantes.
- Protección de datos offline.

#### 38.3 Usabilidad

- Interfaz clara.
- Navegación sencilla.
- Importador guiado.
- Mensajes comprensibles.
- Vista previa antes de publicar.
- Confirmación de acciones destructivas.
- Textos formales.
- Prioridad de uso en computadoras y notebooks.

#### 38.4 Compatibilidad

- Google Chrome.
- Microsoft Edge.
- Navegadores modernos.
- Diseño adaptable.
- Uso desde computadoras, tablets y celulares.

---

## Parte IX — Arquitectura técnica

### 39. Modelo conceptual de datos

#### User

- ID.
- Nombre.
- Correo.
- Rol.
- Estado.
- Último acceso.

#### Catalog

- ID.
- Nombre.
- Descripción.
- Imagen representativa.
- Estado.
- Orden.
- Fecha de actualización.

#### CatalogSection

- ID.
- Catálogo.
- Nombre.
- Descripción.
- Estado.
- Orden.
- Configuración de búsqueda.
- Configuración de filtros.

#### SectionColumn

- ID.
- Sección.
- Nombre original.
- Nombre visible.
- Clave interna.
- Tipo.
- Orden.
- Visible.
- Buscable.
- Filtrable.
- Campo global relacionado.

#### CatalogRecord

- ID.
- Sección.
- Código principal.
- Código normalizado.
- Descripción.
- Datos dinámicos.
- Texto original.
- Texto indexado.
- Fecha de creación.
- Fecha de modificación.

#### EquivalentCode

- ID.
- Registro.
- Código original.
- Código normalizado.
- Tipo opcional.

#### ProductImage

- ID.
- Registro opcional.
- Ruta.
- Nombre original.
- Tipo MIME.
- Tamaño.
- Orden.
- Imagen principal.
- Etiqueta.
- Hoja de origen.
- Fila de origen.
- Columna de origen.
- Estado de asociación.
- Origen.

#### UploadedFile

- ID.
- Nombre original.
- Ruta.
- Tipo.
- Tamaño.
- Usuario.
- Fecha.
- Estado.

#### ImportJob

- ID.
- Archivo.
- Catálogo.
- Estado.
- Configuración.
- Resultados.
- Fecha de inicio.
- Fecha de finalización.

#### ImportSheet

- ID.
- Importación.
- Nombre de hoja.
- Sección de destino.
- Fila de encabezado.
- Estado.
- Cantidad de registros.

#### GlobalFieldMapping

- ID.
- Columna.
- Campo global.
- Configuración.

#### OfflineSyncManifest

- Usuario.
- Dispositivo.
- Catálogos sincronizados.
- Versión.
- Fecha de sincronización.

#### AuditLog

- Usuario.
- Acción.
- Entidad.
- Identificador.
- Fecha.

---

### 40. Estrategia de almacenamiento

No se creará una tabla física en PostgreSQL por cada Excel, catálogo o sección.

Se utilizará:

- Estructura relacional para catálogos, secciones, usuarios, archivos e imágenes.
- Columnas específicas para campos importantes.
- JSONB para datos variables.
- Índices para búsquedas.
- Storage privado para Excel e imágenes.

Esto permitirá:

- Agregar nuevos archivos sin migraciones.
- Conservar estructuras diferentes.
- Mantener un buscador global.
- Incorporar nuevos catálogos sin modificar el código.
- Simplificar el modo offline.

---

### 41. Stack tecnológico propuesto

#### Frontend

- Next.js.
- React.
- TypeScript.
- SCSS Modules.
- TanStack Table.
- React Hook Form.
- Zod.

Se utilizará una versión estable y compatible de cada tecnología al comenzar el desarrollo.

#### Backend

El backend principal se desarrollará dentro del ecosistema Next.js mediante:

- Route Handlers.
- Server Actions cuando correspondan.
- Services.
- Repositories.
- Validadores.
- Procesadores de importación.
- Procesadores de imágenes.
- Tareas de procesamiento en segundo plano cuando sean necesarias.

**NestJS no se utilizará en el MVP ni en futuras fases del proyecto.**

#### Base de datos

- PostgreSQL.
- Supabase.
- Prisma.
- JSONB.

#### Almacenamiento

- Supabase Storage privado.

Se utilizará para:

- Archivos Excel.
- Imágenes.
- Miniaturas.
- Archivos temporales.
- ZIP de imágenes.

#### Procesamiento de Excel

- ExcelJS como herramienta principal.
- Librerías adicionales únicamente cuando exista una necesidad concreta.

#### Procesamiento de imágenes

Se deberán utilizar herramientas compatibles con Node.js para:

- Extraer imágenes.
- Validar formatos.
- Generar miniaturas.
- Optimizar archivos.
- Leer metadatos.

#### Modo offline

- Progressive Web App.
- Service Worker.
- Cache Storage.
- IndexedDB.

---

### 42. Arquitectura propuesta

```text
src/
├── app/
│   ├── (public)/
│   ├── auth/
│   └── admin/
│
├── features/
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
    ├── storage/
    ├── auth/
    └── database/
```

---

### 43. Servicios principales

#### CatalogImportService

- Analiza archivos.
- Detecta hojas.
- Procesa filas.
- Genera importaciones preliminares.
- Publica resultados.

#### ExcelStructureService

- Detecta encabezados.
- Detecta columnas.
- Analiza celdas combinadas.
- Identifica fórmulas.
- Identifica hojas auxiliares.

#### ImageExtractionService

- Extrae imágenes embebidas.
- Detecta filas y columnas de origen.
- Genera miniaturas.
- Registra imágenes pendientes.

#### ImageMatchingService

- Asocia imágenes por código.
- Asocia imágenes por nombre.
- Detecta duplicados.
- Registra coincidencias ambiguas.

#### SearchService

- Normaliza consultas.
- Busca por sección.
- Busca por catálogo.
- Ejecuta la búsqueda global.
- Ordena resultados.

#### FilterService

- Aplica filtros particulares.
- Aplica filtros globales.
- Gestiona campos compartidos.

#### OfflineSyncService

- Prepara datos sincronizables.
- Actualiza IndexedDB.
- Gestiona versiones.
- Sincroniza miniaturas.

---

### 44. Flujo resumido de importación

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

---

## Parte X — Planificación y cierre

### 45. Roadmap funcional

#### Fase 1 — Análisis y definición

- Reunión con Pablo.
- Revisión de cada archivo.
- Definición de significado de columnas.
- Definición de equivalencias.
- Definición de filtros.
- Validación de imágenes externas.
- Identificación de hojas auxiliares.

#### Fase 2 — Base del sistema

- Proyecto.
- Base de datos.
- Storage.
- Autenticación.
- Usuarios.
- Landing.
- Directorio privado.

#### Fase 3 — Catálogos y secciones

- Gestión de catálogos.
- Gestión de secciones.
- Tablas dinámicas.
- Columnas configurables.
- Detalle del registro.

#### Fase 4 — Importador

- Subida.
- Respaldo.
- Análisis de hojas.
- Detección de encabezados.
- Mapeo.
- Vista previa.
- Publicación segura.

#### Fase 5 — Imágenes

- Extracción de imágenes embebidas.
- Importación mediante ZIP.
- Asociación por código.
- Generación de miniaturas.
- Revisión manual.

#### Fase 6 — Administración

- Creación manual.
- Edición.
- Eliminación.
- Equivalencias.
- Gestión de imágenes.

#### Fase 7 — Búsqueda y filtros

- Búsqueda por sección.
- Búsqueda por catálogo.
- Búsqueda global.
- Normalización.
- Filtros particulares.
- Filtros globales.

#### Fase 8 — Archivos y reimportación

- Historial.
- Descarga.
- Reemplazo de secciones.
- Reemplazo de catálogos.
- Informes.

#### Fase 9 — Offline

- PWA.
- IndexedDB.
- Sincronización.
- Búsquedas offline.
- Miniaturas offline.
- Bloqueo de edición.

#### Fase 10 — Pruebas y entrega

- Pruebas con archivos reales.
- Pruebas de imágenes.
- Pruebas de búsqueda.
- Pruebas de reemplazo.
- Pruebas offline.
- Capacitación.
- Documentación.
- Despliegue.

---

### 46. Funciones fuera del alcance

No se incluyen inicialmente:

- Ejecución de macros VBA.
- Edición de archivos Excel desde la web.
- Edición offline.
- Sincronización de modificaciones offline.
- OCR.
- Inteligencia artificial.
- Búsqueda semántica.
- Aplicación móvil nativa.
- Multiempresa.
- Facturación.
- Control de stock.
- Ventas.
- Carrito de compras.
- Pagos.
- Integración contable.
- Integración automática con proveedores.
- Conversión automática de cualquier estructura sin configuración.
- Reconocimiento visual del contenido de las imágenes.
- Edición avanzada de fotografías.
- NestJS.

---

### 47. Criterios de aceptación

#### Catálogos

- Los catálogos aparecen automáticamente en el directorio.
- Cada archivo puede generar varias secciones.
- Las secciones pueden tener columnas diferentes.
- Se pueden agregar nuevos catálogos sin modificar el código.

#### Importación

- El archivo original queda respaldado.
- El sistema detecta hojas y columnas.
- El administrador selecciona las hojas.
- Se muestra una vista previa.
- Los campos dinámicos se conservan.
- Las fórmulas se importan mediante su valor calculado.
- Las macros no se ejecutan.
- Una importación fallida no reemplaza los datos activos.

#### Imágenes

- Se extraen imágenes embebidas compatibles.
- Se importan imágenes externas.
- Las asociaciones por código funcionan.
- Las imágenes ambiguas quedan pendientes.
- Un registro admite múltiples imágenes.
- Una imagen dañada no cancela la importación completa.
- Se muestran miniaturas y vistas ampliadas.

#### Búsqueda

- Cada sección tiene un buscador.
- Cada catálogo puede buscar entre sus secciones.
- El buscador global recorre todos los catálogos.
- Los resultados indican catálogo y sección.
- Las equivalencias participan en la búsqueda.
- Los separadores de códigos no impiden encontrar resultados.

#### Filtros

- Cada sección puede tener filtros propios.
- Los filtros globales funcionan mediante campos mapeados.
- El administrador puede configurar columnas filtrables.

#### Archivos

- Existe una sección de archivos subidos.
- Los archivos originales pueden descargarse.
- Se pueden reemplazar secciones o catálogos.
- Los archivos anteriores permanecen respaldados.

#### Offline

- Los catálogos sincronizados pueden consultarse.
- Las búsquedas funcionan offline.
- Las miniaturas sincronizadas se muestran.
- Las modificaciones quedan bloqueadas.
- La fecha de sincronización es visible.

---

### 48. Criterios de éxito

El proyecto será considerado exitoso cuando:

- Pablo deje de utilizar el pendrive como medio de actualización.
- Ambos locales consulten la misma versión.
- Los archivos nuevos puedan incorporarse desde el panel.
- El directorio se actualice automáticamente.
- Las hojas se conviertan en secciones utilizables.
- Los productos puedan buscarse sin conocer el archivo de origen.
- Los códigos equivalentes puedan encontrarse.
- Las imágenes de Rulemanes y Catálogo Azul se visualicen correctamente.
- Las imágenes externas de Embragues se relacionen sin depender de rutas locales.
- El administrador pueda corregir datos e imágenes.
- Los archivos originales permanezcan respaldados.
- La información pueda consultarse sin conexión.
- El sistema sea comprensible para Pablo y su hermano.

---

### 49. Condiciones y supuestos

- Pablo deberá explicar el significado de las columnas particulares.
- Deberá proporcionar las imágenes externas con sus nombres originales.
- Deberá conservarse la estructura de carpetas de muestra durante el análisis.
- Algunas asociaciones de imágenes podrán requerir revisión manual.
- No se garantiza que todas las fórmulas tengan valores calculados almacenados.
- No se ejecutarán macros.
- Los filtros definitivos se acordarán por sección.
- Los filtros globales se definirán después de mapear los campos comunes.
- El modo offline requerirá una sincronización previa.
- La primera importación podrá requerir configuración y asistencia de GRG.
- Los nuevos catálogos podrán reutilizar configuraciones anteriores cuando posean estructuras similares.
- NestJS queda excluido de toda la arquitectura presente y futura del proyecto.
