# PRD — Nueva Etapa de Facturación Web  
## Sistema Rothamel Repuestos / Pablo R.

---

## 1. Información general

**Proyecto:** Sistema Rothamel Repuestos  
**Nueva etapa:** Módulo de Facturación Web  
**Cliente:** Pablo R. / Rothamel Repuestos  
**Presupuesto aprobado:** $2.800.000 ARS  
**Estado:** Aprobado para planificación y desarrollo  
**Fecha de definición:** Agosto 2026  
**Tipo de desarrollo:** Nueva etapa del sistema existente  
**Modalidad:** Sistema web  
**Objetivo fiscal futuro:** Facturación electrónica con ARCA  
**Modo inicial:** Modo prueba interno sin envío a ARCA  

---

## 2. Resumen ejecutivo

Se desarrollará una nueva etapa del sistema Rothamel Repuestos orientada a la gestión de facturación web.

Esta etapa no debe tratarse como un ajuste menor del sistema actual, sino como una sección nueva y completa que incluirá:

- Dashboard general del administrador.
- Gestión de clientes.
- Gestión de rubros.
- Creación de facturas en modo prueba.
- Listado e historial de comprobantes.
- PDFs personalizados.
- Impresión desde navegador.
- Recibos X, Notas de Crédito y Notas de Débito.
- Pagos a cuenta, imputaciones y cuenta corriente.
- Estados de pago y estados fiscales de facturas.
- Libro IVA mensual.
- Filtros y reportes.
- Preparación para integración posterior con ARCA.

La primera instancia del módulo funcionará en **modo prueba**, sin enviar datos reales a ARCA, para poder validar la creación de facturas, el diseño del PDF, la impresión, el historial, los filtros, los movimientos de cuenta corriente, el Libro IVA y el comportamiento general del sistema sin generar comprobantes fiscales reales.

Luego de validar el flujo interno, se avanzará con la integración fiscal mediante ARCA / Arca SDK para solicitar CAE, generar QR fiscal y emitir comprobantes electrónicos válidos.

---

## 3. Objetivos del módulo

### 3.1 Objetivo principal

Permitir que Pablo pueda gestionar la facturación desde el sistema web, dejando de depender operativamente de una única computadora conectada a una impresora fiscal.

### 3.2 Objetivos específicos

- Centralizar clientes de facturación.
- Crear clientes con datos fiscales controlados.
- Validar CUIT mediante dígito verificador.
- Gestionar rubros de facturación.
- Crear facturas A o B según reglas internas.
- Generar facturas en modo prueba sin conexión a ARCA.
- Generar PDFs personalizados con logo Rothamel.
- Permitir descargar e imprimir facturas desde navegador.
- Registrar cobros mediante Recibos X internos, con imputación a una o varias facturas o como pago a cuenta.
- Emitir Notas de Crédito y Notas de Débito asociadas a una factura determinada.
- Distinguir estado de pago de estado fiscal, y factura paga de anulación fiscal por Nota de Crédito total.
- Pagar facturas únicamente mediante Recibos X, con imputación a una o varias facturas o como pago a cuenta.
- Generar Libro IVA mensual en PDF A4 horizontal, separado por Facturas A y Facturas B.
- Consultar historial de facturas por cliente.
- Filtrar facturas por fecha, tipo, estado, cliente, CUIT o número.
- Mostrar métricas relevantes en el dashboard del administrador.
- Preparar la arquitectura para integración futura con ARCA.

---

## 4. Alcance aprobado

El presupuesto aprobado de **$2.800.000 ARS** contempla el desarrollo de la nueva etapa de facturación web.

### 4.1 Incluido

- Nuevo ítem **Inicio / Dashboard** en el SideNav.
- Nueva sección **Facturación** en el SideNav.
- Subsección **Clientes**.
- Subsección **Rubros**.
- Subsección **Nueva factura**.
- Subsección **Facturas**.
- Subsección **Movimientos**.
- Subsección **Configuración fiscal / ARCA**.
- Modo prueba interno sin envío a ARCA.
- Validación de CUIT.
- Determinación automática de letra de factura.
- Límite configurable para facturación a cliente genérico.
- IVA editable solo por administrador con confirm modal.
- PDF personalizado.
- Descarga e impresión de PDF.
- Historial de facturas.
- Recibos X internos, pagos a cuenta e imputaciones.
- Notas de Crédito y Notas de Débito asociadas a factura.
- Cuenta corriente y cálculo de saldo de facturas.
- Estados de pago (impaga, parcialmente pagada, paga) y estados fiscales.
- Libro IVA mensual descargable e imprimible desde la sección **Facturas**.
- Dashboard administrativo.
- Preparación técnica para integración con ARCA.

### 4.2 No incluido

No forma parte del presupuesto base:

- Asesoramiento contable.
- Trámites en ARCA.
- Alta del punto de venta.
- Gestión de certificado y clave privada.
- Costos de proveedor fiscal externo, si se decide usar uno.
- Mantenimiento mensual.
- Cambios normativos futuros.
- Integración con impresora fiscal.
- Integración bancaria.
- WhatsApp Business API.
- Stock.
- Multiempresa.
- Migraciones masivas desde Excel u otros sistemas, salvo que se presupuesten aparte.
- App mobile nativa.
- Sistema contable completo.

---

## 5. Estructura de navegación

La estructura del SideNav deberá quedar organizada así:

```txt
Inicio / Dashboard
Catálogos
Listas de precios
Facturación
├── Clientes
├── Rubros
├── Nueva factura
├── Facturas
├── Movimientos
└── Configuración fiscal / ARCA
```

### 5.1 Inicio / Dashboard

El dashboard no pertenece internamente a Facturación.

Será el primer ítem del SideNav y estará ubicado por encima de Catálogos. Será la pantalla inicial que verá el usuario administrador luego del login.

### 5.2 Facturación

Facturación será una sección operativa que agrupe todas las herramientas necesarias para crear clientes, cargar rubros, emitir comprobantes, consultar facturas, gestionar movimientos de cuenta corriente y configurar la integración fiscal futura.

La subsección **Facturas** es el listado de facturas y el lugar desde donde se genera el **Libro IVA** mensual. La subsección **Movimientos** no debe duplicar ese listado: allí se gestionan Recibos X, Notas de Crédito, Notas de Débito, pagos a cuenta e imputaciones. El Libro IVA no pertenece a Movimientos.

---

## 6. Roles y permisos

### 6.1 Rol principal

El sistema actual tendrá foco en el usuario administrador, Pablo.

### 6.2 Permisos del administrador

El administrador podrá:

- Ver dashboard.
- Crear clientes.
- Editar clientes.
- Crear rubros.
- Editar rubros.
- Crear facturas.
- Editar parámetros controlados como IVA y límite de facturación genérica.
- Registrar Recibos X e imputarlos a facturas.
- Crear Notas de Crédito y Notas de Débito asociadas a una factura.
- Generar e imprimir Libro IVA mensual desde la sección Facturas.
- Descargar facturas.
- Imprimir facturas.
- Compartir facturas por WhatsApp o email.
- Ver métricas y gráficos.
- Acceder a configuración fiscal.

### 6.3 Reglas de permisos

- Solo el administrador podrá editar datos de clientes.
- Solo el administrador podrá editar IVA.
- Solo el administrador podrá editar el límite para facturación genérica.
- Solo el administrador podrá registrar Recibos X, imputaciones, Notas de Crédito y Notas de Débito.
- El estado de pago de una factura se deriva de su saldo pendiente. No se marcará como paga de forma desconectada de un Recibo X.
- El estado de pago no se elige a mano al crear la factura: se calcula según el método de pago y, luego, según los movimientos.
- Las facturas ya creadas deberán conservar sus datos originales aunque luego se edite el cliente.

---

## 7. Dashboard / Inicio

### 7.1 Objetivo

Mostrar al administrador un resumen general del sistema al ingresar.

El dashboard debe mezclar información operativa de facturación, catálogos, listas de precios, clientes, rubros y deudas.

### 7.2 Visibilidad

El dashboard será visible únicamente para el administrador.

### 7.3 Ubicación

Será el primer ítem del SideNav.

### 7.4 Contenido esperado

El dashboard deberá mostrar:

- Último catálogo subido o editado.
- Link directo al último catálogo.
- Última lista de precios subida o editada.
- Link directo a la última lista de precios.
- Resumen mensual de facturación A.
- Resumen mensual de facturación B.
- Total facturado del mes.
- Top 5 clientes con más compras del mes.
- Top 5 rubros más vendidos del mes.
- Facturas impagas.
- Clientes con deuda.
- Accesos rápidos a:
  - Nueva factura.
  - Nuevo cliente.
  - Nuevo rubro.
  - Facturas impagas.
  - Movimientos.

### 7.5 Reglas

- El dashboard debe tomar información real de facturas, clientes, rubros, catálogos y listas.
- Las métricas de facturación deben permitir discriminar Factura A y Factura B.
- Los rankings comerciales (clientes con más compras, rubros más vendidos y equivalentes) deben ordenarse por **monto total acumulado**, no por cantidad de facturas.
- Las facturas impagas deben tener prioridad visual.
- El lenguaje para clientes deudores debe ser respetuoso, evitando términos agresivos.

Ejemplo de ranking por monto:

```txt
Cliente A: 1 factura por $10.000.000
Cliente B: 59 facturas por $900.000
```

Debe aparecer primero Cliente A, porque el monto acumulado es mayor.

---

## 8. Módulo Clientes

### 8.1 Objetivo

Crear y administrar la lista de clientes utilizados para facturación.

Los clientes serán cargados manualmente por el usuario.

---

### 8.2 Creación de cliente

El formulario de creación de cliente se dividirá en dos bloques principales:

1. Datos del cliente.
2. Identificación y condición de IVA.

---

### 8.3 Datos del cliente

Campos:

- Nombre o razón social.
- Dirección.
- Localidad.
- Provincia.
- Email.
- WhatsApp.

### 8.4 Reglas de datos generales

- El nombre o razón social deberá guardarse en mayúsculas.
- Email y WhatsApp podrán quedar vacíos, especialmente para clientes genéricos.
- Dirección, localidad y provincia deberán estar disponibles para clientes con datos completos.
- El campo **Provincia** no será texto libre. Deberá implementarse como un dropdown con todas las provincias argentinas. El usuario deberá seleccionar una provincia de la lista.
- Los datos serán editables únicamente por el administrador.

### 8.4.1 Unicidad de CUIT y DNI

No debe ser posible crear dos clientes con el mismo CUIT o el mismo DNI.

Reglas:

- Si el usuario carga un CUIT ya existente en otro cliente, el sistema debe bloquear la creación o edición.
- Si el usuario carga un DNI ya existente en otro cliente, el sistema debe bloquear la creación o edición.
- Esta validación debe aplicarse tanto en creación como en edición, excluyendo al propio cliente que se está editando.
- El mensaje de error debe ser claro.

Ejemplo:

```txt
Ya existe un cliente registrado con este CUIT.
```

o:

```txt
Ya existe un cliente registrado con este DNI.
```

---

### 8.5 Tipo de identificación

El formulario tendrá una fila con tres opciones:

- CUIT.
- DNI.
- Nada.

Estas opciones definirán qué campo se habilita.

### 8.6 Comportamiento de identificación

Si se selecciona **CUIT**:

- Se habilita el input de CUIT.
- El sistema debe validar el CUIT.
- Se habilitan todas las opciones de condición de IVA.

Si se selecciona **DNI**:

- Se habilita el input de DNI.
- Solo se habilita la condición **C.F — Consumidor Final**.

Si se selecciona **Nada**:

- No se habilita ningún input de documento.
- Solo se habilita la condición **C.F — Consumidor Final**.
- El cliente podrá operar como cliente genérico sujeto al límite configurable.

---

### 8.7 Validación de CUIT

El CUIT deberá validarse antes de guardar el cliente.

Reglas:

- Debe contener 11 dígitos numéricos.
- No debe guardarse con guiones.
- Puede mostrarse con formato visual, pero debe persistirse normalizado.
- Debe validarse con algoritmo de dígito verificador.

### 8.8 Algoritmo de dígito verificador CUIT

El sistema deberá implementar validación módulo 11.

Proceso esperado:

```txt
1. Tomar los primeros 10 dígitos del CUIT.
2. Multiplicarlos por los pesos:
   5, 4, 3, 2, 7, 6, 5, 4, 3, 2
3. Sumar los resultados.
4. Calcular 11 - (suma % 11).
5. Normalizar resultado:
   - Si da 11, el dígito verificador esperado es 0.
   - Si da 10, el CUIT debe considerarse inválido o manejarse según regla definida.
   - En los demás casos, el resultado debe coincidir con el último dígito.
```

Si el CUIT no pasa la validación, el sistema no debe permitir guardar el cliente.

---

### 8.9 Condición de IVA

Luego de elegir CUIT, DNI o Nada, el sistema mostrará las opciones de condición de IVA.

Opciones:

- **R.I** — Responsable Inscripto.
- **R.N.I** — Responsable No Inscripto.
- **M** — Monotributista.
- **C.F** — Consumidor Final.
- **E** — Exento.

### 8.10 Reglas de habilitación

Si el cliente tiene **CUIT**:

```txt
Se habilitan:
- R.I
- R.N.I
- M
- C.F
- E
```

Si el cliente tiene **DNI**:

```txt
Solo se habilita:
- C.F
```

Si el cliente no tiene documento:

```txt
Solo se habilita:
- C.F
```

---

### 8.11 Código automático de cliente

Al finalizar la creación del cliente, el sistema deberá asignar un código de cliente generado automáticamente.

### 8.12 Reglas para código de cliente

El código deberá:

- Ser único.
- Ser legible.
- Poder generarse a partir del nombre o razón social.
- Tener un componente incremental de 5 dígitos para evitar duplicados.
- Poder editarse luego desde la ficha del cliente.

Reglas de generación automática:

- Tomar la primera letra de cada palabra de la razón social.
- Ignorar abreviaturas con punto o sufijos societarios (`S.A.`, `S.H.`, `SRL`, etc.).
- Si una palabra tiene dos letras y no es artículo (`SP`), usar ambas letras.
- Formato: `PREFIJO-00000`.

Ejemplos:

```txt
GRG SOLUTIONS → GRG-00001
GOMERIA LA RUTA → GLR-00002
SP REPUESTOS → SPR-00003
```

---

### 8.13 Listado de clientes

La sección Clientes deberá mostrar la lista total de clientes.

Cada card de cliente deberá mostrar:

- Código de cliente.
- Nombre o razón social.
- Dirección.
- Localidad.
- Provincia.
- Email.
- WhatsApp.
- Tipo de identificación.
- CUIT o DNI si corresponde.
- Condición de IVA.
- Estado de pago: Al día / Adeuda.
- Monto adeudado si corresponde.
- Acciones disponibles.

---

### 8.14 Buscador y filtros de clientes

La sección Clientes deberá incluir:

- Buscador por nombre o razón social.
- Buscador por código.
- Buscador por CUIT o DNI.
- Orden A-Z.
- Orden Z-A.
- Filtro por estado:
  - Al día.
  - Adeuda.
- Filtro por condición de IVA.
- Filtro por tipo de identificación:
  - CUIT.
  - DNI.
  - Nada.

---

### 8.15 Historial de facturas por cliente

Al hacer click sobre una card de cliente, el sistema deberá mostrar el historial de facturación del cliente.

Puede implementarse como modal o página de detalle, pero para esta etapa se prioriza modal.

El historial deberá mostrar:

- Facturas emitidas o creadas para ese cliente.
- Fecha.
- Tipo de factura.
- Número.
- Total.
- Estado de pago.
- Estado fiscal.
- Método de pago.
- Saldo pendiente.
- Movimientos asociados: Recibos X, Notas de Crédito y Notas de Débito.
- Totales del período filtrado:
  - Total facturado en monto.
  - Cantidad total de facturas.
  - Total pendiente.
  - Total pagado.

No se adjuntarán comprobantes de pago (imagen o PDF) a las facturas. El cobro se documenta únicamente con Recibos X.

### 8.16 Filtros del historial

El historial y los totales del detalle de cliente deberán poder filtrarse por período.

#### Rango personalizado

El usuario podrá elegir:

```txt
Desde: DD/MM/AAAA
Hasta: DD/MM/AAAA
```

#### Períodos predeterminados

Además del rango manual, el sistema debe ofrecer selección rápida por mes del año vigente.

Ejemplo:

- Enero 2026.
- Febrero 2026.
- Marzo 2026.
- Abril 2026.
- Mayo 2026.
- Junio 2026.
- Julio 2026.
- Agosto 2026.
- Septiembre 2026.
- Octubre 2026.
- Noviembre 2026.
- Diciembre 2026.

Al seleccionar un mes, el sistema filtra automáticamente desde el primer día hasta el último día de ese mes.

---

### 8.17 Totales por período

En el detalle de cliente, los siguientes datos deben recalcularse según el período seleccionado:

- Total facturado en monto.
- Cantidad total de facturas.
- Total pendiente.
- Total pagado.
- Movimientos asociados.

---

### 8.18 Gráficos de clientes

La sección Clientes deberá incluir una columna lateral (junto al listado principal) con:

- **Clientes con más compras:** ranking por **monto total acumulado**, no por cantidad de facturas, sin numeración de posición visible.
- **Clientes con deuda:** listado en cards apiladas con nombre, cantidad de comprobantes con saldo y monto adeudado.

Un cliente con una sola factura de $10.000.000 debe aparecer por encima de un cliente con 59 facturas por $900.000.

Regla de comunicación:

- Evitar textos agresivos.
- Usar términos como “clientes con deuda”, no etiquetas despectivas.

**Pendiente (vinculación con facturación — Sprint 2 o posterior):**

- Al hacer clic en un cliente del panel **Clientes con deuda**, el sistema deberá abrir el modal de detalle de ese cliente posicionado en el **historial de facturación**, para consultar sus comprobantes, saldo y movimientos asociados.
- Los datos de ambos paneles laterales deberán provenir de la facturación real cuando el módulo esté disponible (hoy pueden mostrarse con datos mock en Sprint 1).

---

## 9. Módulo Rubros

### 9.1 Objetivo

Administrar los rubros utilizados para crear facturas.

La sección se llamará **Rubros**.

No representa productos específicos de stock. Representa categorías o conceptos de facturación.

Ejemplos:

- Embragues.
- Filtros.
- Alternadores.
- Cardanes.
- Frenos.
- Repuestos varios.

---

### 9.2 Campos del rubro

Cada rubro tendrá:

- Código.
- Rubro.
- Descripción.
- Fecha de creación.
- Fecha de última edición.
- Estado activo/inactivo.

---

### 9.3 Código de rubro

El código podrá ser alfanumérico.

Puede ser:

- Ingresado manualmente por el administrador.
- O generado automáticamente por el sistema.

La decisión final se podrá tomar en diseño técnico, pero el sistema deberá asegurar unicidad.

---

### 9.4 Descripción del rubro

La descripción será utilizada como texto base dentro de la factura.

Al crear una factura:

- El sistema traerá la descripción del rubro.
- El administrador podrá sobrescribir la descripción solo para esa factura.
- La descripción original del rubro no deberá modificarse.

---

### 9.5 Listado de rubros

La sección Rubros deberá mostrar todos los rubros creados.

Cada card o fila deberá mostrar:

- Código.
- Nombre del rubro.
- Descripción.
- Fecha de creación.
- Estado.
- Acciones.

---

### 9.6 Buscador y filtros de rubros

La sección Rubros deberá permitir:

- Buscar por código.
- Buscar por nombre de rubro.
- Ordenar por nombre A-Z.
- Ordenar por nombre Z-A.
- Ordenar por código A-Z.
- Ordenar por código Z-A.
- Filtrar por rango de fechas.
- Filtrar por estado activo/inactivo.

---

### 9.7 Estadísticas de rubros

La sección Rubros deberá incluir una columna lateral (junto al listado principal) con:

- **Monto vendido:** gráfico redondo por tipo de facturación (A / B), monto total en el centro y cantidad de comprobantes en el encabezado.
- **Rubros más vendidos:** ranking por **monto total acumulado**, no por cantidad de facturas, sin numeración de posición visible.

La métrica de monto vendido deberá considerar lo facturado, independientemente de si la factura está paga o impaga. El criterio de ordenamiento principal es el importe, no la cantidad de comprobantes.

**Pendiente (vinculación con facturación — Sprint 2 o posterior):**

- Ambos paneles laterales deberán consumir datos reales de comprobantes emitidos cuando el módulo de facturación esté disponible (hoy pueden mostrarse con datos mock en Sprint 1).
- Las estadísticas por rango de fechas (filtro Desde/Hasta) se aplicarán cuando exista historial de facturación.

---

## 10. Módulo Facturación

### 10.1 Objetivo

Permitir crear facturas A o B a partir de clientes y rubros ya cargados, y gestionar los movimientos posteriores vinculados a esas facturas.

La sección Facturación consumirá los datos de:

- Clientes.
- Rubros.
- Configuración fiscal.
- Parámetros del sistema.
- Movimientos de cuenta corriente.

---

### 10.2 Orden de desarrollo

No se debe comenzar por integración ARCA.

El orden correcto será:

```txt
1. Clientes
2. Rubros
3. Facturación en modo prueba
4. PDFs, impresión, historial, movimientos y Libro IVA
5. Integración ARCA en homologación
6. Producción ARCA
```

---

## 11. Determinación automática de letra de factura

### 11.1 Regla principal

La letra de la factura no se selecciona manualmente.

El sistema la determina internamente según:

- Tipo de identificación.
- Condición de IVA del cliente.

---

### 11.2 Matriz de determinación

| Identificación | Condición IVA | Letra resultante | Descripción |
|---|---|---:|---|
| Nada | C.F | B | Factura B como consumidor final sin identificación |
| DNI | C.F | B | Factura B como consumidor final |
| CUIT | E | B | Factura B como exento |
| CUIT | C.F | B | Factura B como consumidor final |
| CUIT | M | B | Factura B como monotributista |
| CUIT | R.I | A | Factura A como responsable inscripto |
| CUIT | R.N.I | B | Factura B como responsable no inscripto |

### 11.3 Nota sobre R.N.I

Pablo indicó “Factura Bb” para el caso de CUIT + Responsable No Inscripto.

**Aclaración confirmada:** “Bb” se interpreta como **Factura B** (no existe un tipo Bb distinto). El sistema usa **Factura B** para ese caso.

---

### 11.4 Mensaje visible en creación de factura

Durante la creación de factura, el sistema deberá mostrar un mensaje claro:

```txt
Se generará una Factura tipo A.
```

o:

```txt
Se generará una Factura tipo B.
```

Si el cliente es genérico sin identificación, deberá mostrar:

```txt
Se generará una Factura tipo B para consumidor final sin identificación.
Límite vigente: $400.000.
```

El valor del límite debe tomar el parámetro vigente en el sistema.

---

## 12. Límite para cliente genérico sin identificación

### 12.1 Regla

Si el cliente no tiene:

- CUIT.
- DNI.
- Email.
- Teléfono.

Se considerará cliente genérico sin datos.

En ese caso:

- Solo podrá ser Consumidor Final.
- Solo podrá generar Factura B.
- Tendrá un límite de facturación configurable.

### 12.2 Valor inicial

Valor inicial:

```txt
$400.000
```

### 12.3 Edición del límite

El límite será editable únicamente por el administrador.

Al editarlo, el sistema deberá mostrar un modal de confirmación.

Ejemplo:

```txt
Está por modificar el límite de facturación para clientes sin identificación.
Valor actual: $400.000
Nuevo valor: $XXX.XXX

¿Desea confirmar este cambio?
```

### 12.4 Reglas

- Si una factura supera el límite vigente para cliente genérico, el sistema debe bloquear la creación.
- El sistema debe informar claramente el motivo del bloqueo.
- El límite debe guardarse como parámetro de configuración.
- El cambio de límite debe quedar registrado en auditoría interna.

---

## 13. Creación de factura

### 13.1 Flujo general

El flujo de creación será:

```txt
1. Seleccionar cliente, o crear uno nuevo desde el selector.
2. El sistema determina tipo de factura A/B.
3. Mostrar mensaje: “Se generará una Factura tipo X”.
4. Cargar ítems (rubro, detalle, cantidad, precio unitario con IVA incluido, total).
5. Aplicar descuento si corresponde.
6. Calcular subtotal, descuento, subtotal neto, IVA y total.
7. Elegir método de pago.
8. El sistema informa el estado de pago inicial según el método (no es editable).
9. Confirmar factura.
10. Generar factura en modo prueba o emitir con ARCA, según ambiente activo.
11. Generar PDF.
12. Guardar en historial.
```

### 13.1.1 Layout de una sola columna

La pantalla **Nueva factura** no deberá organizarse en dos columnas.

Nuevo orden vertical:

```txt
Cliente
Rubros / Ítems
Descuento
Resumen de cálculo
Método de pago
Estado de pago
Botón Crear factura
```

Todo debe organizarse en una única columna vertical.

---

### 13.2 Selector de cliente

El selector deberá:

- Permitir escribir para buscar.
- Buscar por nombre, código, CUIT o DNI.
- Mostrar datos básicos del cliente.
- Al seleccionar, traer condición fiscal e identificación.
- Determinar automáticamente si corresponde Factura A o B.

Como primer ítem del dropdown deberá aparecer:

```txt
+ Agregar nuevo cliente
```

Al hacer click en esa opción:

- Se debe abrir el modal existente de creación de cliente.
- El modal debe abrirse por encima de la pantalla Nueva factura.
- El usuario no debe ser redirigido a la sección Clientes.
- Al guardar el nuevo cliente, este debe quedar disponible y seleccionado o seleccionable en Nueva factura.

Objetivo: evitar salir de Nueva factura, ir a Clientes, crear el cliente y volver.

---

### 13.3 Selector de rubros

El selector deberá:

- Permitir escribir para buscar.
- Buscar por código o nombre.
- Traer descripción del rubro.
- Permitir sobrescribir la descripción para la factura actual.
- No modificar la descripción original del rubro.

---

### 13.4 Ítems de factura

Cada ítem deberá verse en **una sola fila**, como renglón de factura real.

En la misma línea deberá mostrar:

- Rubro.
- Detalle.
- Cantidad.
- Precio unitario con IVA incluido.
- Precio total.

Objetivo: que la carga de ítems se parezca visualmente al cuerpo de una factura real.

Cada ítem deberá contener:

- Código.
- Detalle.
- Cantidad.
- Precio unitario con IVA incluido.
- Precio total.

### 13.5 Múltiples ítems

El sistema deberá contemplar que una factura pueda tener uno o varios ítems.

### 13.6 Límites de cantidad y precio

Cada ítem deberá respetar:

```txt
Cantidad máxima: 99
Precio unitario máximo: 99.999.999
```

Si el usuario supera esos valores, el sistema debe bloquear la carga o mostrar error.

---

## 14. IVA, subtotal, descuento y total

### 14.1 IVA inicial

El IVA inicial será:

```txt
21%
```

### 14.2 Edición del IVA

El IVA será editable únicamente por el administrador.

Al editarlo, el sistema deberá mostrar un confirm modal.

Ejemplo:

```txt
Está por modificar el valor del IVA.
Valor actual: 21%
Nuevo valor: XX%

Esta acción puede afectar los cálculos de facturación.
¿Desea continuar?
```

### 14.3 Factura A

Para Factura A:

- El IVA debe discriminarse visualmente.
- El sistema carga el **precio unitario con IVA incluido**.
- El sistema deberá calcular el neto dividiendo por `1 + alícuota` (por ejemplo 1.21 si el IVA es 21%).
- Si el IVA vigente no es 21%, se debe usar la alícuota configurada.

Cálculo esperado:

```txt
Precio unitario con IVA incluido / 1.21 = Precio neto unitario
Precio neto unitario * cantidad = Subtotal neto antes de descuento
Descuento = porcentaje aplicado sobre subtotal neto
Subtotal neto final = subtotal neto antes de descuento - descuento
IVA = subtotal neto final * 21%
Total = subtotal neto final + IVA
```

Ejemplo validado:

```txt
Precio unitario con IVA: $1.210
Cantidad: 3
IVA: 21%
Descuento: 5%
```

```txt
$1.210 / 1.21 = $1.000 neto unitario
$1.000 * 3 = $3.000 subtotal neto antes de descuento
5% de $3.000 = $150 descuento
Subtotal neto final = $2.850
IVA = $598,50
Total = $3.448,50
```

Esta lógica debe cumplirse siempre. Se solicita revisión técnica para asegurarla en todos los casos (varios ítems, cambio de alícuota, Factura B interna, redondeo).

### 14.4 Factura B

Para Factura B:

- Se muestra principalmente el precio final.
- No se discrimina visualmente el IVA como en Factura A.
- El sistema puede conservar cálculos internos, pero el PDF debe respetar la visualización de Factura B.

---

### 14.5 Descuento

La creación de factura deberá incluir una sección:

```txt
DESCUENTO
```

Campos:

- Input numérico.
- Símbolo `%`.
- Botón “Aplicar”.

Reglas:

- El botón Aplicar solo se habilita si el input tiene un valor válido.
- El descuento se aplica sobre el subtotal neto (precio sin IVA × cantidad), no sobre el total con IVA.
- Si no hay descuento, no debe mostrarse una línea vacía en el resumen.
- No debe mostrarse “DTO 0%” ni “DTO % 0”.

---

### 14.6 Resumen de cálculo

El resumen deberá mostrar:

```txt
Subtotal
Descuento
Subtotal neto
IVA
Total
```

Si no hay descuento, no debe mostrarse una línea vacía ni “DTO 0%”. El IVA se muestra según corresponda a Factura A.

---

## 15. Redondeo

### 15.1 Reglas solicitadas

Pablo indicó las siguientes reglas de redondeo visual:

- Si es `10.200,01`, mostrar `10.200`.
- Si es `10.199,99`, mostrar `10.200`.
- Si el decimal está entre `.41` y `.59`, redondear a `.50`.
- Si es mayor a `.59`, redondear a `1`.
- Si es menor a `.41`, redondear a `0`.

### 15.2 Recomendación técnica

El sistema deberá separar:

```txt
Valor fiscal exacto
Valor visual redondeado
```

### 15.3 Regla para ARCA

Cuando se active ARCA, los valores enviados deberán coincidir con los valores fiscales reales del comprobante.

No debe existir una diferencia entre el total autorizado fiscalmente y el total visible final del PDF fiscal.

### 15.4 Implementación recomendada

En modo prueba se podrá mostrar el redondeo visual para validar con Pablo.

Antes de activar ARCA en producción, se deberá definir si:

1. El redondeo es solo visual en pantallas internas.
2. El redondeo impacta el total real.
3. El redondeo se representa como ajuste/descuento/redondeo en la factura.

---

## 16. Métodos de pago

### 16.1 Métodos disponibles

Se elimina el método **Contado efectivo**.

Los métodos de pago disponibles serán:

- Contado.
- Tarjeta.
- Transferencia.
- Otros.
- Cuenta corriente.

### 16.2 Layout visual de métodos de pago

Los métodos deberán mostrarse así:

```txt
Contado        Tarjeta
Transferencia  Otros
Cuenta corriente
```

Reglas visuales:

- Los primeros cuatro métodos van en grilla de dos columnas y dos filas.
- **Cuenta corriente** debe ir debajo, en una fila propia, ocupando el ancho completo.

### 16.3 Estado de pago automático al crear la factura

El campo **Estado de pago** ya no debe ser seleccionable manualmente en Nueva factura.

Debe seguir mostrándose, pero bloqueado o en modo informativo.

Regla:

```txt
Si método de pago = Cuenta corriente
→ Estado inicial: Impaga
```

```txt
Si método de pago = Contado / Tarjeta / Transferencia / Otros
→ Estado inicial: Paga
```

El usuario no debe poder elegir entre paga o impaga al crear la factura.

A partir de esta actualización, la única forma de pagar una factura impaga o parcialmente pagada será mediante un **Recibo X**. No se pagará una factura cambiando manualmente el estado desde la factura.

### 16.4 Estados de pago posteriores

Luego de emitida, el estado de pago se calcula por saldo (ver secciones 17 y 18):

```txt
Saldo pendiente = 0
→ Paga
```

```txt
Saldo pendiente = total ajustado
→ Impaga
```

```txt
Saldo pendiente > 0 y menor al total ajustado
→ Parcialmente pagada
```

El **total ajustado** es el total de la factura menos Notas de Crédito más Notas de Débito.

No se debe confundir estado de pago con estado fiscal. Una factura con Nota de Crédito total no debe marcarse simplemente como “paga”.

---

## 17. Movimientos: Recibos X, Notas de Crédito y Notas de Débito

### 17.1 Objetivo

Permitir gestionar movimientos posteriores o vinculados a facturas emitidas:

- Recibos X.
- Notas de Crédito.
- Notas de Débito.
- Pagos a cuenta.
- Imputaciones contra una o varias facturas.
- Ajustes de saldo de cuenta corriente.

Este módulo debe estar conectado con:

- Clientes.
- Facturas.
- Estados de saldo.
- Cuenta corriente.
- Libro IVA mensual.
- Integración futura con ARCA.

La sección **Movimientos** no debe comportarse como una copia de la lista de facturas. Para ver facturas y generar el Libro IVA ya existe **Facturas**. Movimientos es la sección de cobros, ajustes y cuenta corriente del cliente.

---

### 17.2 Navegación

La sección anteriormente prevista como **Pagos / Recibos** se reemplaza por **Movimientos**.

Nombre de la subsección:

```txt
Movimientos
```

Nombre alternativo aceptable, si en UI se prefiere un rótulo más operativo:

```txt
Pagos y Ajustes
```

Dentro de esta sección se gestionarán:

- Recibos X.
- Notas de Crédito.
- Notas de Débito.
- Pagos a cuenta.
- Imputaciones.

El Libro IVA no se gestiona en Movimientos. Se genera desde la sección **Facturas**.

---

### 17.3 Recibos X — concepto

El recibo será un comprobante interno del sistema, identificado como **Recibo X**.

Reglas:

- No utilizará el punto de venta fiscal 0007.
- No tendrá CAE.
- No se informará a ARCA.
- No impactará en el Libro IVA.

Su función será documentar un cobro o pago recibido.

---

### 17.4 Recibos X — numeración

Los recibos tendrán numeración interna propia, independiente de la numeración fiscal.

Ejemplo:

```txt
REC-X-00000001
REC-X-00000002
REC-X-00000003
```

La numeración deberá comenzar desde cero o desde el primer número definido por el sistema.

---

### 17.5 Recibos X — usos

A partir de esta actualización, la única forma de pagar una factura impaga o parcialmente pagada será mediante un **Recibo X**.

No se pagará una factura cargando comprobante de pago.

No se pagará una factura cambiando manualmente el estado desde la factura.

El recibo podrá utilizarse para:

1. Pagar una factura de cuenta corriente.
2. Pagar varias facturas de cuenta corriente.
3. Registrar un pago parcial.
4. Registrar un pago total.
5. Registrar un pago a cuenta adelantado, sin factura asociada todavía.
6. Imputar posteriormente un pago a cuenta a una factura futura.

### 17.5.1 Botón “Emitir recibo” en lista de facturas

En la sección **Facturas**, toda factura impaga o parcialmente pagada de cuenta corriente deberá mostrar un botón adicional:

```txt
Emitir recibo
```

Este botón deberá mostrarse junto a las acciones existentes:

- Descargar.
- Imprimir.
- Compartir.
- Ver detalle.

Solo debe aparecer en facturas con saldo pendiente.

### 17.5.2 Flujo al emitir recibo desde una factura

Cuando el usuario presiona **Emitir recibo** desde una factura:

1. El sistema identifica el cliente de esa factura.
2. El sistema busca todas las facturas impagas o parcialmente pagadas de ese cliente.
3. Si el cliente tiene una sola factura con saldo pendiente:
   - Se abre directamente el modal de emisión de recibo.
   - Esa factura queda preseleccionada.
4. Si el cliente tiene dos o más facturas con saldo pendiente:
   - El sistema muestra un paso previo.
   - El usuario debe elegir qué facturas desea pagar con el recibo.

### 17.5.3 Recibo por monto mayor a una factura

El recibo puede tener un importe mayor al saldo de una factura individual.

Ejemplo:

```txt
Factura 1: $1.000.000
Factura 2: $1.000.000
Deuda total: $2.000.000

Recibo emitido: $1.500.000
```

Resultado esperado:

```txt
Factura 1: paga
Factura 2: parcialmente pagada, saldo pendiente $500.000
```

---

### 17.6 Recibos X — datos mínimos

Cada recibo deberá incluir:

- Número interno de recibo.
- Fecha.
- Cliente.
- Factura asociada, si existe.
- Una o varias facturas asociadas, si corresponde.
- Importe.
- Forma de pago.
- Observaciones.
- Estado de imputación.
- PDF del recibo.
- Usuario que lo generó.

---

### 17.7 Recibos X — formas de pago

El recibo podrá registrar una forma de pago entre:

- Efectivo.
- Cheque.
- Transferencia.
- Tarjeta.
- Otros.

---

### 17.8 Recibos X — pago a cuenta

El sistema deberá permitir crear un recibo sin factura asociada.

En ese caso, el recibo quedará como:

```txt
Pago a cuenta pendiente de imputación
```

Luego, cuando se cree una factura para ese cliente, el sistema deberá permitir imputar ese saldo a favor contra la factura correspondiente.

---

### 17.9 Recibos X — efecto sobre facturas

Cuando un recibo se imputa a una factura:

- Reduce el saldo pendiente de esa factura.
- Si cubre el saldo total, la factura pasa a estado de pago **Paga**.
- Si cubre solo una parte, la factura queda **Parcialmente pagada**.
- Si se imputa a varias facturas, el sistema debe distribuir el importe entre ellas.

**Regla importante:** cancelar el saldo de una factura no significa anular fiscalmente la factura.

El sistema deberá diferenciar:

```txt
Estado de pago: Paga
```

de:

```txt
Estado fiscal: Anulada por Nota de Crédito
```

El Recibo X deberá poder descargarse como PDF.

---

### 17.10 Notas de Crédito — concepto

La Nota de Crédito es un comprobante oficial que permite anular total o parcialmente una factura emitida.

Debe estar asociada a un número de factura determinado.

Debe informarse a ARCA cuando el sistema opere en modo real.

Debe tener su propio número fiscal, CAE, vencimiento de CAE, QR fiscal y PDF fiscal.

---

### 17.11 Notas de Crédito — usos

Las Notas de Crédito pueden aplicarse sobre **cualquier factura**.

No están restringidas a facturas de cuenta corriente.

Pueden aplicarse sobre:

- Facturas pagas.
- Facturas impagas.
- Facturas parcialmente pagadas.
- Facturas con cualquier método de pago.

La Nota de Crédito se utilizará para:

- Devoluciones.
- Anulación total de una factura.
- Anulación parcial de una factura.
- Ajustes que reduzcan el monto de una factura ya emitida.

---

### 17.12 Notas de Crédito — reglas

**Asociación:** toda Nota de Crédito deberá estar vinculada a una factura específica. No se permitirá crear una Nota de Crédito suelta sin factura asociada.

**Importe:** el importe de la Nota de Crédito deberá ser igual o menor al importe disponible de la factura asociada.

Casos:

```txt
Factura original: $1.000
Nota de Crédito: $1.000
Resultado: anulación total
```

```txt
Factura original: $1.000
Nota de Crédito: $300
Resultado: anulación parcial / saldo reducido
```

Si una factura ya tiene una Nota de Crédito previa, el sistema deberá validar contra el saldo restante disponible, no solo contra el total original.

---

### 17.13 Notas de Crédito — efecto sobre saldo y Libro IVA

La Nota de Crédito reduce el saldo de la factura.

Si la Nota de Crédito cubre el total de la factura, la factura queda fiscalmente **Anulada por Nota de Crédito**. No debe marcarse simplemente como “paga”.

Si la Nota de Crédito es parcial, la factura queda vigente pero **Ajustada por Nota de Crédito**.

Ejemplo:

```txt
Factura: $1.000
Nota de Crédito: -$300
Saldo restante: $700
Recibo posterior: $700
Estado de pago: Paga
Estado fiscal: Ajustada por Nota de Crédito
```

Las Notas de Crédito deberán incluirse en el Libro IVA mensual con signo negativo, ya que restan.

Ejemplo:

```txt
Factura A: $1.000
Nota de Crédito A: -$300
Total neto considerado: $700
```

---

### 17.14 Notas de Crédito — ARCA

En modo prueba, la Nota de Crédito será interna y no se enviará a ARCA.

En modo real, la Nota de Crédito deberá enviarse a ARCA como comprobante oficial y deberá recibir:

- Número fiscal.
- CAE.
- Vencimiento de CAE.
- QR fiscal.
- PDF fiscal.

---

### 17.15 Notas de Débito — concepto

La Nota de Débito es un comprobante oficial que permite sumar un importe adicional a una factura ya emitida.

Debe estar asociada a un número de factura determinado.

Debe informarse a ARCA cuando el sistema opere en modo real.

Debe tener su propio número fiscal, CAE, vencimiento de CAE, QR fiscal y PDF fiscal.

---

### 17.16 Notas de Débito — usos

Las Notas de Débito **solo podrán aplicarse sobre facturas de cuenta corriente con saldo pendiente**.

No se podrán aplicar sobre facturas ya pagadas.

Regla:

```txt
Factura paga
→ No permite Nota de Débito
```

```txt
Factura impaga o parcialmente pagada de cuenta corriente
→ Permite Nota de Débito
```

Motivo: si una factura ya fue pagada, comercialmente la operación está cerrada y no tiene sentido agregarle un monto posterior.

La Nota de Débito se utilizará cuando sea necesario incrementar el saldo de una factura de cuenta corriente. Ejemplos indicados por Pablo:

- El cliente no pagó en tiempo.
- El producto cambió de precio.
- Se genera una Nota de Débito asociada a la factura original.

---

### 17.17 Notas de Débito — reglas y efecto sobre saldo

**Asociación:** toda Nota de Débito deberá estar vinculada a una factura específica. No se permitirá crear una Nota de Débito suelta sin factura asociada.

**Aplicabilidad:** solo facturas de cuenta corriente con saldo pendiente (impaga o parcialmente pagada). El sistema debe rechazar Notas de Débito sobre facturas pagas.

La Nota de Débito aumenta el saldo pendiente de la factura. El estado fiscal pasa a **Ajustada por Nota de Débito**.

Ejemplo:

```txt
Factura original: $1.000
Nota de Débito: $200
Total a pagar: $1.200
Recibo posterior: $1.200
Estado de pago: Paga
Estado fiscal: Ajustada por Nota de Débito
```

---

### 17.18 Notas de Débito — Libro IVA y ARCA

Las Notas de Débito deberán incluirse en el Libro IVA mensual con signo positivo, ya que suman.

Ejemplo:

```txt
Factura A: $1.000
Nota de Débito A: +$200
Total neto considerado: $1.200
```

En modo prueba, la Nota de Débito será interna y no se enviará a ARCA.

En modo real, la Nota de Débito deberá enviarse a ARCA como comprobante oficial y deberá recibir:

- Número fiscal.
- CAE.
- Vencimiento de CAE.
- QR fiscal.
- PDF fiscal.

---

### 17.19 Cuenta corriente y saldo de facturas

El sistema deberá calcular el saldo de una factura considerando:

```txt
Saldo pendiente =
Total factura
- Notas de Crédito aplicadas
+ Notas de Débito aplicadas
- Recibos imputados
```

Ejemplo con Nota de Crédito:

```txt
Factura: $1.000
Nota de Crédito: -$300
Recibo: -$700
Saldo pendiente: $0
Estado de pago: Paga
Estado fiscal: Ajustada por Nota de Crédito
```

Ejemplo con Nota de Débito:

```txt
Factura: $1.000
Nota de Débito: +$200
Recibo: -$1.200
Saldo pendiente: $0
Estado de pago: Paga
Estado fiscal: Ajustada por Nota de Débito
```

**Regla clave:**

- Las facturas, Notas de Crédito y Notas de Débito afectan el Libro IVA.
- Los Recibos X no afectan el Libro IVA; solo afectan el saldo y el cobro.

El detalle de estado de pago versus estado fiscal está en la sección 18. El reporte de Libro IVA se genera desde la sección **Facturas**, no desde Movimientos. El detalle funcional está en la sección 19.

---

## 18. Estado de pago y estado fiscal

Se elimina por completo la funcionalidad de **comprobante de pago adjunto**.

No formará parte del alcance:

- Dropzone de comprobante de pago.
- Carga de imagen o PDF como comprobante de pago.
- Edición única de comprobante de pago.
- Comprobante de pago en el historial del cliente o en la lista de facturas.

El pago de facturas no se resuelve con archivos adjuntos, sino mediante **Recibos X**.

Si existiera un campo o entidad `payment_proofs` por compatibilidad histórica, deberá quedar sin uso.

---

### 18.1 Separación de conceptos

El sistema debe separar claramente dos conceptos:

```txt
Estado de pago
```

y:

```txt
Estado fiscal
```

### 18.2 Estado de pago

Estados posibles:

- Impaga.
- Parcialmente pagada.
- Paga.

Estos estados dependen del saldo pendiente de la factura.

### 18.3 Estado fiscal

Estados posibles sugeridos:

- Vigente.
- Ajustada por Nota de Crédito.
- Ajustada por Nota de Débito.
- Anulada por Nota de Crédito.
- Autorizada por ARCA.
- Rechazada por ARCA.
- Error técnico ARCA.

En modo prueba interno, el estado fiscal podrá indicarse como modo prueba / vigente, sin CAE.

### 18.4 Regla clave

Una factura puede estar fiscalmente vigente pero parcialmente pagada.

Una factura puede estar anulada por Nota de Crédito total sin ser “paga”.

Una factura puede estar ajustada por Nota de Débito y seguir impaga.

El sistema no debe mezclar estos conceptos.

---

## 19. Facturas

### 19.1 Objetivo

Consultar y administrar facturas creadas.

En la UI, esta subsección se llama **Facturas**.

La sección no será solo para crear facturas, sino también para ver, filtrar, descargar, imprimir y compartir comprobantes, y para generar el **Libro IVA** mensual.

Esta sección es el listado de facturas. No debe duplicarse en **Movimientos**. Desde el detalle de una factura se podrá acceder a sus Recibos X, Notas de Crédito y Notas de Débito asociados.

El Libro IVA pertenece a esta sección, no a Movimientos.

---

### 19.2 Listado

El listado de facturas deberá estar paginado o limitado por cantidad de resultados.

Cada factura deberá mostrar:

- Fecha.
- Cliente.
- CUIT o DNI si corresponde.
- Tipo de factura A/B.
- Punto de venta.
- Número de factura.
- Total sin IVA, si corresponde.
- IVA.
- Total.
- Método de pago.
- Estado de pago.
- Saldo pendiente.
- Estado fiscal.
- Botón emitir recibo, solo si hay saldo pendiente y el método es cuenta corriente.
- Botón descargar.
- Botón imprimir.
- Botón compartir.
- Botón ver detalle.

---

### 19.3 Filtros

La sección Facturas deberá permitir filtrar por:

- Rango de fechas.
- Tipo de factura A/B.
- Facturas pagas.
- Facturas impagas.
- Facturas parcialmente pagadas.
- Facturas anuladas por Nota de Crédito.
- Cliente.
- CUIT.
- DNI.
- Número de factura.
- Método de pago.
- Estado fiscal.

---

### 19.4 Buscador

El buscador deberá encontrar facturas por:

- Número.
- CUIT.
- DNI.
- Nombre del cliente.
- Código del cliente.

---

### 19.5 Colores por tipo de factura

Se podrán usar colores diferenciados para distinguir Factura A y Factura B.

Ejemplo:

- Factura A: naranja.
- Factura B: azul.

Los colores definitivos se definirán en diseño UI.

---

### 19.6 Totales

La sección deberá mostrar:

- Total diario facturado.
- Total mensual facturado.
- Total Factura A.
- Total Factura B.
- Total general.
- Total pendiente.
- Total pagado.

---

### 19.7 Libro IVA mensual

El Libro IVA es un reporte de la sección **Facturas**. No debe aparecer como ítem propio del SideNav ni dentro de **Movimientos**.

Forma parte del alcance del módulo y no debe considerarse un adicional.

#### Formato

El Libro IVA deberá generarse en PDF en formato:

```txt
A4 horizontal / apaisado
```

Debe estar preparado para meses con alto volumen de comprobantes, aproximadamente entre 300 y 400 facturas mensuales.

#### Separación por tipo de comprobante

El reporte deberá separar las hojas por tipo de factura:

```txt
Facturas A y movimientos asociados
Facturas B y movimientos asociados
```

Las Facturas A y B no deberán mezclarse en una misma tabla.

#### Contenido del reporte

El Libro IVA deberá incluir:

- Facturas.
- Notas de Crédito.
- Notas de Débito.

No deberá incluir Recibos X.

#### Signos

Las Notas de Crédito deberán mostrarse con signo negativo.

Las Notas de Débito deberán mostrarse con signo positivo.

Ejemplo:

```txt
Factura A      + $1.000
Nota Crédito A - $300
Nota Débito A  + $200
```

#### Columnas esperadas

Las columnas finales podrán ajustarse en diseño, pero deberán contemplar:

- Fecha.
- Tipo de comprobante.
- Letra.
- Punto de venta.
- Número.
- Cliente.
- CUIT / DNI si corresponde.
- Condición IVA.
- Neto.
- IVA.
- Total.
- Comprobante asociado, si corresponde.

#### Descarga e impresión

Desde la sección **Facturas**, el Libro IVA deberá poder:

- Descargarse como PDF.
- Imprimirse.
- Filtrarse por mes.
- Separar Factura A y Factura B en hojas o secciones diferentes.

---

## 20. PDF de factura

### 20.1 Objetivo

Generar un PDF personalizado de cada factura.

### 20.2 Diseño general

El PDF deberá tener diseño personalizado con identidad Rothamel.

Estructura esperada:

#### Encabezado izquierdo

- Logo de Rothamel.
- Datos de Rothamel:
  - Razón social.
  - CUIT.
  - Dirección.
  - Localidad.
  - Provincia.
  - Condición fiscal.
  - Otros datos que Pablo provea.

#### Encabezado derecho

- Letra de factura: A o B.
- Punto de venta.
- Número de factura.
- Fecha.

#### Datos del cliente

- Nombre o razón social.
- Dirección.
- Localidad.
- Provincia.
- CUIT o DNI si corresponde.
- Condición de IVA.

#### Detalle

Columnas:

- Código.
- Detalle.
- Cantidad.
- Precio unitario.
- Precio total.

#### Pie de factura

- Método de pago.
- Subtotal.
- Descuento, solo si existe.
- IVA, según corresponda.
- Total.
- QR, cuando exista integración ARCA.
- CAE, cuando exista integración ARCA.
- Vencimiento CAE, cuando exista integración ARCA.

---

### 20.3 Formato de números

Los importes deberán mostrarse con separador de miles usando punto.

Ejemplo:

```txt
10.000.000
```

---

### 20.4 Modo prueba

En modo prueba, el PDF deberá indicar claramente:

```txt
MODO PRUEBA — NO VÁLIDO COMO FACTURA FISCAL
```

No debe mostrar CAE real.

No debe simular un QR fiscal real.

Puede mostrar un QR interno o placeholder solo si queda visualmente claro que no es válido fiscalmente.

---

## 21. Impresión

### 21.1 Objetivo

Permitir imprimir facturas desde una impresora común no fiscal.

### 21.2 Alcance

El botón imprimir abrirá el PDF o una vista imprimible y usará el diálogo de impresión del navegador.

### 21.3 Reglas

- No será impresión silenciosa.
- No seleccionará automáticamente impresora.
- No se conectará a impresora fiscal.
- No controlará drivers locales.
- No dependerá de la computadora actual de la impresora fiscal.
- Funcionará como impresión web estándar.

---

## 22. Compartir factura

### 22.1 Objetivo

Permitir compartir la factura por WhatsApp o email usando los datos cargados en el cliente.

### 22.2 WhatsApp

El botón deberá mostrar:

```txt
Enviar a {número}
```

Si el cliente no tiene WhatsApp cargado:

```txt
Enviar por WhatsApp
```

Pero el botón estará deshabilitado.

### 22.3 Email

El botón deberá mostrar:

```txt
Enviar a {email}
```

Si el cliente no tiene email cargado:

```txt
Enviar por email
```

Pero el botón estará deshabilitado.

### 22.4 Alcance

En esta etapa, WhatsApp será mediante enlace manual.

No incluye WhatsApp Business API.

---

## 23. Inalterabilidad de facturas

### 23.1 Regla principal

Las facturas creadas deben conservar los datos originales usados al momento de su creación.

Si luego se edita el cliente, las facturas previas no deben cambiar.

### 23.2 Datos que deben congelarse

Cada factura deberá guardar una copia de:

- Nombre o razón social.
- Dirección.
- Localidad.
- Provincia.
- Email.
- WhatsApp.
- CUIT o DNI.
- Condición de IVA.
- Tipo de factura.
- Rubros utilizados.
- Descripciones usadas.
- Cantidades.
- Precios.
- IVA aplicado.
- Descuento aplicado.
- Total.
- Método de pago.

### 23.3 Regla de edición

Una factura ya creada no debe editarse como un registro común.

En modo prueba, se puede permitir cancelar o rehacer facturas según decisión del flujo, pero debe quedar claro que en producción fiscal las facturas autorizadas serán inalterables.

---

## 24. Modo prueba interno

### 24.1 Objetivo

Permitir probar todo el flujo de facturación sin enviar datos a ARCA.

### 24.2 Incluye

- Crear clientes.
- Crear rubros.
- Crear facturas A y B simuladas.
- Validar tipo de factura.
- Validar límite para cliente genérico.
- Aplicar IVA.
- Aplicar descuento.
- Generar PDFs.
- Descargar PDFs.
- Imprimir PDFs.
- Guardar facturas en historial.
- Filtrar facturas.
- Registrar Recibos X, pagos a cuenta e imputaciones.
- Crear Notas de Crédito y Notas de Débito internas.
- Generar Libro IVA mensual.
- Ver dashboard.

### 24.3 No incluye

- Envío a ARCA.
- CAE real.
- QR fiscal real.
- Factura, Nota de Crédito o Nota de Débito fiscal válida.
- Impacto tributario real.

Los Recibos X no se envían a ARCA ni en modo prueba ni en producción. Son comprobantes internos.

### 24.4 Numeración en modo prueba

En modo prueba se podrá usar numeración interna simulada.

Ejemplo:

```txt
0007-PRUEBA-000000001
```

O una numeración visual similar, siempre indicando que no es fiscal.

### 24.5 Advertencia visible

Toda pantalla de factura en modo prueba deberá mostrar una advertencia:

```txt
Modo prueba activo. Los comprobantes creados no se envían a ARCA y no tienen validez fiscal.
```

---

## 25. Integración futura con ARCA

### 25.1 Objetivo

Luego de validar el modo prueba, se integrará el sistema con ARCA para solicitar CAE y generar comprobantes electrónicos.

### 25.2 Tecnología sugerida

Se utilizará backend Node.js/TypeScript con Arca SDK.

Paquetes sugeridos:

- `@arcasdk/core`
- `@arcasdk/pdf`, si se decide usar el generador de PDF de la SDK o tomarlo como referencia.

### 25.3 Regla técnica principal

La conexión con ARCA no se hará desde el frontend.

Debe ejecutarse desde backend.

### 25.4 Motivo

El backend debe proteger:

- Certificado.
- Clave privada.
- CUIT emisor.
- Tokens WSAA.
- Configuración de ambiente.
- Respuestas fiscales.

### 25.5 Datos necesarios

Pablo y su contadora deberán gestionar:

- CUIT emisor.
- Certificado.
- Clave privada.
- Alta del servicio correspondiente.
- Punto de venta.
- Autorización para webservice.
- Confirmación de condiciones fiscales.

### 25.6 Punto de venta

Pablo y su contadora indicaron que se gestionará un nuevo punto de venta:

```txt
0007
```

El formato esperado de factura, Nota de Crédito y Nota de Débito será:

```txt
0007-XXXXXXXXX
```

o:

```txt
0007-XXXXXXXXXX
```

La cantidad final de dígitos se ajustará al formato fiscal usado por ARCA.

Los Recibos X no utilizarán el punto de venta fiscal 0007. Tendrán numeración interna propia (`REC-X-########`).

---

## 26. Flujo ARCA futuro

### 26.1 Flujo esperado

```txt
1. Usuario crea factura, Nota de Crédito o Nota de Débito.
2. Sistema valida cliente, condición IVA, tipo A/B, importes, límite y, si aplica, factura asociada.
3. Sistema muestra confirmación.
4. Backend prepara solicitud fiscal.
5. Backend consulta o determina próximo número.
6. Backend envía solicitud a ARCA mediante Arca SDK.
7. ARCA responde.
8. Si autoriza:
   - Se guarda CAE.
   - Se guarda vencimiento de CAE.
   - Se guarda número fiscal.
   - Se genera QR fiscal.
   - Se genera PDF fiscal.
   - El comprobante queda inalterable.
9. Si rechaza:
   - Se guarda el error.
   - No se marca como emitida.
   - Se permite revisar o reintentar según caso.
10. Si hay error técnico:
   - Se guarda intento.
   - Se informa al administrador.
   - Se permite reintento controlado.
```

Los Recibos X no recorren este flujo. Son comprobantes internos y nunca se envían a ARCA.

### 26.2 Estados fiscales

Estados posibles:

- Vigente.
- Ajustada por Nota de Crédito.
- Ajustada por Nota de Débito.
- Anulada por Nota de Crédito.
- Autorizada por ARCA.
- Rechazada por ARCA.
- Error técnico ARCA.
- Modo prueba.
- Pendiente de emisión.
- Enviando a ARCA.

---

## 27. Configuración fiscal / ARCA

### 27.1 Objetivo

Preparar una sección para manejar parámetros fiscales y de conexión.

### 27.2 Campos esperados

- CUIT emisor.
- Razón social.
- Condición fiscal.
- Punto de venta.
- Ambiente:
  - Modo prueba interno.
  - Homologación ARCA.
  - Producción ARCA.
- Certificado.
- Clave privada.
- Estado de conexión.
- Fecha de última prueba.
- IVA vigente.
- Límite para cliente genérico.

### 27.3 Ambientes

#### Modo prueba interno

- No conecta a ARCA.
- No genera CAE.
- No genera QR fiscal.
- Sirve para validar el flujo.

#### Homologación ARCA

- Conecta a ambiente de prueba ARCA.
- Permite validar integración técnica.
- No debe usarse para operación real.

#### Producción ARCA

- Emite comprobantes reales.
- Requiere confirmación explícita.
- Solo debe activarse después de validación con Pablo y contadora.

---

## 28. Arquitectura técnica recomendada

### 28.1 Frontend

Responsabilidades:

- Formularios de clientes.
- Formularios de rubros.
- Creación visual de facturas.
- Listados.
- Filtros.
- Dashboard.
- Descarga de PDFs.
- Impresión.
- Carga de comprobantes de pago.
- Recibos X, Notas de Crédito y Notas de Débito.
- Libro IVA, desde la sección Facturas.
- Mensajes de validación.

### 28.2 Backend

Responsabilidades:

- Persistencia.
- Validaciones críticas.
- Cálculo de importes.
- Generación de PDFs.
- Manejo de estados.
- Preparación de integración ARCA.
- Uso futuro de Arca SDK.
- Protección de credenciales.
- Auditoría.
- Control de permisos.

### 28.3 Base de datos

Entidades sugeridas:

- clients
- client_codes
- rubros
- invoices
- invoice_items
- invoice_snapshots
- credit_notes
- debit_notes
- payment_receipts
- receipt_allocations
- customer_account_movements
- monthly_vat_books
- vat_book_entries
- fiscal_settings
- arca_emission_attempts
- dashboard_metrics opcional
- audit_logs

### 28.4 Storage

Se deberá almacenar:

- PDFs de facturas.
- PDFs de Recibos X.
- PDFs de Notas de Crédito y Notas de Débito.
- PDFs de Libro IVA.
- Logo Rothamel.
- Archivos fiscales futuros si corresponde.

---

## 29. Modelo de datos conceptual

### 29.1 Cliente

Campos mínimos:

- id
- codigo_cliente
- nombre_razon_social
- direccion
- localidad
- provincia
- email
- whatsapp
- tipo_identificacion
- cuit (único si está presente)
- dni (único si está presente)
- condicion_iva
- estado_pago
- created_at
- updated_at

### 29.2 Rubro

Campos mínimos:

- id
- codigo
- nombre
- descripcion
- estado
- created_at
- updated_at

### 29.3 Factura

Campos mínimos:

- id
- modo
- cliente_id
- cliente_snapshot
- tipo_factura
- punto_venta
- numero_factura
- fecha
- subtotal
- descuento_porcentaje
- descuento_monto
- iva_porcentaje
- iva_monto
- total
- total_visual_redondeado
- metodo_pago
- estado_pago
- saldo_pendiente
- estado_fiscal
- cae
- cae_vencimiento
- qr_url
- pdf_url
- created_at
- updated_at

### 29.4 Ítem de factura

Campos mínimos:

- id
- factura_id
- rubro_id
- codigo
- detalle
- cantidad (máximo 99)
- precio_unitario (con IVA incluido; máximo 99.999.999)
- precio_total

### 29.5 Nota de Crédito (`credit_notes`)

Campos mínimos:

- id
- invoice_id
- client_id
- amount
- reason
- fiscal_status
- point_of_sale
- number
- cae
- cae_expiration
- pdf_url
- created_at

Toda Nota de Crédito debe tener `invoice_id`. No se permiten notas sueltas.

### 29.6 Nota de Débito (`debit_notes`)

Campos mínimos:

- id
- invoice_id
- client_id
- amount
- reason
- fiscal_status
- point_of_sale
- number
- cae
- cae_expiration
- pdf_url
- created_at

Toda Nota de Débito debe tener `invoice_id`. No se permiten notas sueltas.

### 29.7 Recibo X (`payment_receipts`)

Campos mínimos:

- id
- client_id
- receipt_number
- fecha
- amount
- payment_method
- observations
- pdf_url
- status
- created_at

`status` deberá contemplar al menos: imputado, parcialmente imputado, y pago a cuenta pendiente de imputación.

Un Recibo X no tiene punto de venta fiscal ni CAE. La asociación a facturas se resuelve en `receipt_allocations`, no con un único `invoice_id` obligatorio.

### 29.8 Imputación de recibo (`receipt_allocations`)

Campos mínimos:

- id
- receipt_id
- invoice_id
- allocated_amount
- created_at

### 29.9 Movimiento de cuenta corriente (`customer_account_movements`)

Campos mínimos:

- id
- client_id
- source_type
- source_id
- sign
- amount
- description
- created_at

`source_type` deberá identificar el origen: factura, Recibo X, Nota de Crédito o Nota de Débito.

### 29.10 Libro IVA mensual (`monthly_vat_books`)

Campos mínimos:

- id
- period
- generated_at
- generated_by
- pdf_url
- created_at

### 29.11 Entrada de Libro IVA (`vat_book_entries`)

Campos mínimos:

- id
- period
- source_type
- source_id
- voucher_type
- letter
- point_of_sale
- number
- client_snapshot
- net_amount
- iva_amount
- total_amount
- sign
- created_at

`source_type` / `voucher_type` deberán cubrir facturas, Notas de Crédito y Notas de Débito. Los Recibos X no generan entradas de Libro IVA.

### 29.12 Comprobante de pago

Se elimina del alcance. No se deben crear ni usar entidades `payment_proofs` para el flujo de cobro.

Si existiera un modelo histórico de comprobantes adjuntos, deberá quedar sin uso. El cobro se documenta con `payment_receipts` y `receipt_allocations`.

---

## 30. Auditoría interna

### 30.1 Eventos auditables

El sistema deberá registrar:

- Creación de cliente.
- Edición de cliente.
- Creación de rubro.
- Edición de rubro.
- Creación de factura.
- Creación de Recibo X.
- Imputación de Recibo X.
- Creación de Nota de Crédito.
- Creación de Nota de Débito.
- Cambio de IVA.
- Cambio de límite de cliente genérico.
- Cambio de estado de pago derivado de movimientos.
- Generación de Libro IVA.
- Cambio de ambiente fiscal.
- Intento de emisión ARCA futuro.
- Error ARCA futuro.

### 30.2 Datos de auditoría

Cada evento deberá guardar:

- Fecha.
- Usuario.
- Acción.
- Entidad afectada.
- Valor anterior.
- Valor nuevo.
- Observación opcional.

---

## 31. Planificación por sprints

El desarrollo del módulo de Facturación Web se organizará en **3 sprints**.

| Sprint | Alcance | Duración estimada |
|---|---|---|
| Sprint 1 | Clientes y Rubros | 1 semana y media |
| Sprint 2 | Facturación modo prueba + PDFs + Movimientos internos | 2 semanas |
| Sprint 3 | Integración ARCA + comprobantes oficiales | 2 semanas |

**Total estimado:** 5 a 6 semanas.

### 31.1 Sprint 1 — Clientes y Rubros

Duración estimada: **1 semana y media**.

Incluye:

- Base visual y estructura de navegación (Inicio / Dashboard + sección Facturación).
- Módulo Clientes completo.
- Módulo Rubros completo.

Corresponde a las fases 1, 2 y 3.

### 31.2 Sprint 2 — Facturación modo prueba + PDFs + Movimientos internos

Duración estimada: **2 semanas**.

Incluye:

- Nueva factura en modo prueba.
- Layout actualizado de una sola columna e ítems en una sola fila.
- Métodos de pago actualizados (sin Contado efectivo; Cuenta corriente a ancho completo).
- Estados de pago automáticos según método de pago.
- Recibos X internos.
- Imputación de recibos a una o varias facturas.
- Pago parcial.
- Pago a cuenta.
- Notas de Crédito en modo prueba.
- Notas de Débito en modo prueba.
- Separación de estado de pago y estado fiscal.
- PDF de factura.
- PDF de recibo.
- Libro IVA mensual en modo prueba.
- Dashboard administrativo, con rankings por monto.

Corresponde a las fases 4, 5 y 6.

### 31.3 Sprint 3 — Integración ARCA + comprobantes oficiales

Duración estimada: **2 semanas**.

Incluye:

- Facturas reales con ARCA.
- Notas de Crédito reales con ARCA.
- Notas de Débito reales con ARCA.
- CAE.
- QR fiscal.
- PDF fiscal definitivo.
- Manejo de errores y reintentos.
- Libro IVA mensual con comprobantes reales.
- Configuración fiscal / ARCA.
- Homologación e integración con Arca SDK.

Corresponde a las fases 7 y 8.

---

## 32. Fases de desarrollo

### Fase 1 — Base visual y estructura

Incluye:

- Agregar Inicio / Dashboard al SideNav.
- Crear estructura de sección Facturación.
- Crear rutas internas.
- Preparar layout base.
- Crear permisos básicos de administrador.

Entregable:

- Estructura navegable lista.

---

### Fase 2 — Clientes

Incluye:

- CRUD de clientes.
- Formulario con datos generales.
- Selector CUIT / DNI / Nada.
- Validación de CUIT.
- Unicidad de CUIT y DNI.
- Provincia como dropdown de provincias argentinas.
- Condición de IVA dinámica.
- Código automático de cliente.
- Listado.
- Buscador.
- Filtros.
- Estado Al día / Adeuda.
- Historial de facturas por cliente preparado.

Entregable:

- Clientes funcionales para ser usados por facturación.

---

### Fase 3 — Rubros

Incluye:

- CRUD de rubros.
- Código.
- Nombre.
- Descripción.
- Listado.
- Buscador.
- Ordenamiento.
- Filtros por fecha.
- Estadísticas básicas.
- Gráficos de rubros.

Entregable:

- Rubros funcionales para ser usados en facturas.

---

### Fase 4 — Facturación en modo prueba

Incluye:

- Crear factura desde cliente + rubros.
- Agregar nuevo cliente desde el selector de Nueva factura.
- Layout de una sola columna e ítems en una sola fila.
- Determinar tipo A/B automáticamente.
- Mostrar mensaje de tipo de factura.
- Validar límite de cliente genérico.
- Validar cantidad máxima 99 y precio unitario máximo 99.999.999.
- Aplicar IVA y descuento según cálculo de precio con IVA incluido.
- Cargar método de pago (Contado, Tarjeta, Transferencia, Otros, Cuenta corriente).
- Informar estado de pago automático (no editable).
- Generar factura en modo prueba.
- Guardar historial.
- Calcular saldo pendiente a partir de movimientos.

Entregable:

- Flujo completo de creación de factura sin ARCA.

---

### Fase 5 — PDF, impresión, movimientos y Libro IVA

Incluye:

- PDF personalizado de factura.
- Marca de agua modo prueba.
- Descarga.
- Impresión.
- Compartir por WhatsApp/email.
- Recibos X internos, pagos a cuenta e imputaciones.
- Botón Emitir recibo desde facturas con saldo pendiente.
- PDF de Recibo X.
- Notas de Crédito internas sobre cualquier factura.
- Notas de Débito internas solo sobre cuenta corriente con saldo pendiente.
- Cálculo de saldo de factura y cuenta corriente.
- Separación de estado de pago y estado fiscal.
- Libro IVA mensual en PDF A4 horizontal, separado por Facturas A y Facturas B, generado desde la sección Facturas.

Entregable:

- Operación interna completa de facturación, movimientos y Libro IVA.

---

### Fase 6 — Dashboard

Incluye:

- Último catálogo.
- Última lista de precios.
- Resumen mensual de facturación.
- Top clientes, ordenados por monto acumulado.
- Top rubros, ordenados por monto acumulado.
- Facturas impagas.
- Accesos rápidos.

Entregable:

- Pantalla de inicio administrativa.

---

### Fase 7 — Preparación ARCA

Incluye:

- Configuración fiscal.
- Punto de venta 0007.
- Ambiente homologación.
- Preparación de backend con Arca SDK.
- Estructura para certificado y clave privada.
- Estados fiscales.
- Registro de intentos.

Entregable:

- Sistema preparado para pruebas de integración ARCA.

---

### Fase 8 — Integración ARCA

Incluye:

- Conexión con ARCA en homologación.
- Solicitud de CAE para facturas, Notas de Crédito y Notas de Débito.
- Manejo de respuestas.
- Manejo de errores.
- QR fiscal.
- PDF fiscal definitivo.
- Pruebas de emisión.
- Preparación para producción.

Entregable:

- Flujo fiscal completo validado en homologación.

---

## 33. Criterios de aceptación

### Clientes

- Se puede crear cliente con CUIT, DNI o Nada.
- El CUIT se valida correctamente.
- No se puede crear un cliente con CUIT repetido.
- No se puede crear un cliente con DNI repetido.
- Provincia se selecciona desde un dropdown de provincias argentinas.
- Si elige DNI o Nada, solo se permite C.F.
- Si elige CUIT, se permiten todas las condiciones.
- El cliente recibe código automático.
- Se puede buscar y filtrar clientes.
- Se puede ver historial por cliente.
- El detalle de cliente muestra totales por período (monto, cantidad, pendiente, pagado).

### Rubros

- Se pueden crear rubros.
- Se pueden editar rubros.
- Se puede buscar por código o nombre.
- Se puede usar la descripción en una factura.
- Se puede sobrescribir descripción solo para una factura.
- El ranking de rubros más vendidos se ordena por monto acumulado.

### Facturas / Nueva factura

- El selector de clientes permite agregar nuevo cliente desde el dropdown.
- La pantalla Nueva factura usa layout de una sola columna.
- Cada ítem de factura se muestra en una sola fila.
- Cantidad máxima por ítem: 99.
- Precio unitario máximo: 99.999.999.
- El sistema determina automáticamente A o B.
- Se muestra el mensaje “Se generará una Factura tipo X”.
- Se bloquea cliente genérico si supera el límite.
- Se calcula subtotal, descuento, subtotal neto, IVA y total.
- Si no hay descuento, no se muestra DTO 0%.
- Factura A discrimina IVA.
- Factura B muestra precio final.
- No existe método “Contado efectivo”.
- Cuenta corriente aparece como botón de ancho completo.
- Estado de pago se calcula automáticamente según método de pago.
- Se guarda snapshot del cliente.
- La factura queda en historial.
- Se puede descargar PDF.
- Se puede imprimir PDF.
- Se puede compartir si el cliente tiene email o WhatsApp.

### Recibos

- Se puede emitir Recibo X desde una factura impaga o parcialmente pagada.
- El Recibo X puede pagar una o varias facturas.
- El Recibo X puede dejar facturas parcialmente pagadas.
- El Recibo X puede quedar como pago a cuenta.
- La única forma de pagar facturas de cuenta corriente es mediante Recibo X.
- Los recibos no aparecen en Libro IVA.

### Notas de Crédito

- Se puede crear Nota de Crédito sobre cualquier factura.
- La Nota de Crédito no puede superar el importe disponible de la factura.
- La Nota de Crédito reduce el saldo.
- La Nota de Crédito puede anular total o parcialmente una factura.
- La Nota de Crédito aparece en Libro IVA con signo negativo.

### Notas de Débito

- Se puede crear Nota de Débito solo sobre facturas de cuenta corriente con saldo pendiente.
- No se puede crear Nota de Débito sobre facturas pagas.
- La Nota de Débito aumenta el saldo.
- La Nota de Débito aparece en Libro IVA con signo positivo.

### Estados

- El sistema diferencia estado de pago y estado fiscal.
- Una factura puede estar parcialmente pagada.
- Una factura puede estar anulada por Nota de Crédito total.
- Una factura puede estar ajustada por Nota de Crédito o Nota de Débito.

### Libro IVA

- El Libro IVA se genera desde la sección **Facturas**, no desde Movimientos.
- Se puede generar Libro IVA mensual en PDF A4 horizontal.
- El Libro IVA separa Facturas A y Facturas B.
- El Libro IVA incluye Facturas, Notas de Crédito y Notas de Débito.
- El Libro IVA no incluye Recibos X.

### Dashboard

- Es el primer ítem del SideNav.
- Solo lo ve el administrador.
- Muestra resumen de facturación, catálogos, listas, deudas, clientes y rubros.
- Los rankings de clientes y rubros se ordenan por monto acumulado, no por cantidad.

### Modo prueba

- No envía datos a ARCA.
- No genera CAE real.
- No genera QR fiscal real.
- El PDF indica claramente que no tiene validez fiscal.

### ARCA futuro

- La conexión se realiza desde backend.
- Se usa punto de venta 0007 para facturas, Notas de Crédito y Notas de Débito.
- Se guarda CAE cuando corresponda.
- Se guarda vencimiento de CAE.
- Se registra respuesta de ARCA.
- Se manejan errores y reintentos.
- Las Notas de Crédito y Notas de Débito se informan a ARCA en modo real.
- Los Recibos X no se informan a ARCA.

---

## 34. Riesgos

### 34.1 Riesgo fiscal

Las reglas fiscales deben ser validadas por Pablo y su contadora antes de activar producción.

### 34.2 Riesgo de redondeo

Si el total visual no coincide con el total fiscal, puede generar inconsistencias. Antes de producción, se debe definir el tratamiento final del redondeo.

### 34.3 Riesgo de cliente genérico

El límite de $400.000 debe ser configurable y validado antes de producción.

### 34.4 Riesgo ARCA

ARCA puede rechazar comprobantes por datos incorrectos, problemas de punto de venta, errores de certificado o inconsistencias de importes.

### 34.5 Riesgo de alcance

El módulo es una nueva etapa completa. No debe mezclarse con pedidos adicionales como stock, integración bancaria, impresora fiscal o WhatsApp Business API sin nuevo presupuesto.

---

## 35. Notas técnicas sobre ARCA

La emisión real deberá realizarse por backend usando webservices de ARCA.

ARCA documenta que la solicitud por webservice debe realizarse por un punto de venta específico y distinto al usado para controlador fiscal u otros sistemas de facturación. Para este proyecto, Pablo y su contadora gestionarán el punto de venta **0007**.

WSFEv1 contempla emisión de comprobantes electrónicos A, B, C y M con CAE/CAEA, incluyendo facturas, notas de crédito y notas de débito.

Arca SDK se tomará como herramienta principal sugerida porque permite integrar servicios de ARCA desde Node.js/TypeScript, incluyendo Facturación Electrónica mediante `electronicBillingService`.

La SDK gestiona autenticación WSAA y tickets de acceso. Para despliegues cloud/serverless, será necesario usar una estrategia de almacenamiento persistente de tickets, como base de datos o storage dedicado, y no depender únicamente del filesystem local.

---

## 36. Conclusión

El módulo de Facturación Web para Rothamel Repuestos queda definido como una nueva etapa del sistema, con presupuesto aprobado de **$2.800.000 ARS**.

La estrategia correcta será avanzar primero con la base operativa:

```txt
Clientes → Rubros → Facturación en modo prueba → PDF / movimientos / Libro IVA / dashboard
```

Y recién después avanzar con:

```txt
Configuración fiscal → Homologación ARCA → Producción ARCA
```

Esto permite validar el flujo completo sin emitir comprobantes reales, evita errores fiscales innecesarios y prepara el sistema para una transición ordenada desde la operatoria actual con impresora fiscal hacia una facturación web moderna con PDF, CAE y QR fiscal.