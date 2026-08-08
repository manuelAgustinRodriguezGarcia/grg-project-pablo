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
- Recibos de pago.
- Estados de pago.
- Comprobantes de pago adjuntos.
- Filtros y reportes.
- Preparación para integración posterior con ARCA.

La primera instancia del módulo funcionará en **modo prueba**, sin enviar datos reales a ARCA, para poder validar la creación de facturas, el diseño del PDF, la impresión, el historial, los filtros, los estados de pago y el comportamiento general del sistema sin generar comprobantes fiscales reales.

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
- Registrar pagos y emitir recibos para cualquier método de pago.
- Adjuntar comprobantes de pago.
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
- Subsección **Comprobantes**.
- Subsección **Pagos / Recibos**.
- Subsección **Configuración fiscal / ARCA**.
- Modo prueba interno sin envío a ARCA.
- Validación de CUIT.
- Determinación automática de letra de factura.
- Límite configurable para facturación a cliente genérico.
- IVA editable solo por administrador con confirm modal.
- PDF personalizado.
- Descarga e impresión de PDF.
- Historial de facturas.
- Estados de pago.
- Comprobante de pago en imagen o PDF.
- Edición única del comprobante de pago.
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
├── Comprobantes
├── Pagos / Recibos
└── Configuración fiscal / ARCA
```

### 5.1 Inicio / Dashboard

El dashboard no pertenece internamente a Facturación.

Será el primer ítem del SideNav y estará ubicado por encima de Catálogos. Será la pantalla inicial que verá el usuario administrador luego del login.

### 5.2 Facturación

Facturación será una sección operativa que agrupe todas las herramientas necesarias para crear clientes, cargar rubros, emitir comprobantes, consultar facturas, registrar pagos y configurar la integración fiscal futura.

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
- Marcar facturas como pagas.
- Adjuntar comprobantes de pago.
- Editar una única vez el comprobante de pago.
- Crear recibos de pago.
- Descargar facturas.
- Imprimir facturas.
- Compartir facturas por WhatsApp o email.
- Ver métricas y gráficos.
- Acceder a configuración fiscal.

### 6.3 Reglas de permisos

- Solo el administrador podrá editar datos de clientes.
- Solo el administrador podrá editar IVA.
- Solo el administrador podrá editar el límite para facturación genérica.
- Solo el administrador podrá cambiar manualmente el estado de pago.
- Solo el administrador podrá modificar comprobantes de pago ya cargados, y únicamente una vez.
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

### 7.5 Reglas

- El dashboard debe tomar información real de facturas, clientes, rubros, catálogos y listas.
- Las métricas de facturación deben permitir discriminar Factura A y Factura B.
- Las facturas impagas deben tener prioridad visual.
- El lenguaje para clientes deudores debe ser respetuoso, evitando términos agresivos.

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
- Los datos serán editables únicamente por el administrador.

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
- Tener un componente incremental para evitar duplicados.

Ejemplo sugerido:

```txt
ROTH-0001
JUAN-0002
GOMEZ-0003
```

La estructura final del código puede definirse durante diseño técnico.

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
- Método de pago.
- Comprobante de pago si existe.

### 8.16 Filtros del historial

El historial deberá permitir filtro por rango de fechas:

```txt
Desde: DD/MM/AAAA
Hasta: DD/MM/AAAA
```

---

### 8.17 Comprobante de pago desde historial

Sobre cada factura impaga deberá mostrarse un dropzone con el título:

```txt
COMPROBANTE DE PAGO
```

Si la factura ya está paga:

- Se debe mostrar el comprobante cargado.
- No debe mostrarse el dropzone.
- Si el administrador presiona editar, se podrá reemplazar el comprobante una única vez.

### 8.18 Formatos permitidos

El comprobante de pago podrá ser:

- Imagen.
- PDF.

Solo se permitirá cargar un archivo por comprobante.

---

### 8.19 Gráficos de clientes

La sección Clientes deberá incluir gráficos con Recharts:

- Top 10 clientes con más compras.
- Lista o gráfico de clientes con mayor deuda.

Regla de comunicación:

- Evitar textos agresivos.
- Usar términos como “clientes con saldo pendiente” o “clientes con deuda”, no etiquetas despectivas.

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

La sección Rubros deberá mostrar estadísticas por rango de fechas:

- Cantidad de facturas asociadas al rubro.
- Monto total vendido asociado al rubro.
- Rubros más vendidos.
- Gráfico de rubros más vendidos con Recharts.

La métrica de monto vendido deberá considerar lo facturado, independientemente de si la factura está paga o impaga.

---

## 10. Módulo Facturación

### 10.1 Objetivo

Permitir crear facturas A o B a partir de clientes y rubros ya cargados.

La sección Facturación consumirá los datos de:

- Clientes.
- Rubros.
- Configuración fiscal.
- Parámetros del sistema.

---

### 10.2 Orden de desarrollo

No se debe comenzar por integración ARCA.

El orden correcto será:

```txt
1. Clientes
2. Rubros
3. Facturación en modo prueba
4. PDFs, impresión, historial y pagos
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
1. Seleccionar cliente.
2. El sistema determina tipo de factura A/B.
3. Mostrar mensaje: “Se generará una Factura tipo X”.
4. Seleccionar rubro.
5. Cargar o sobrescribir detalle.
6. Cargar cantidad.
7. Cargar precio unitario.
8. Calcular precio total.
9. Aplicar descuento si corresponde.
10. Calcular subtotal, IVA y total.
11. Elegir método de pago.
12. Confirmar factura.
13. Generar factura en modo prueba o emitir con ARCA, según ambiente activo.
14. Generar PDF.
15. Guardar en historial.
```

---

### 13.2 Selector de cliente

El selector deberá:

- Permitir escribir para buscar.
- Buscar por nombre, código, CUIT o DNI.
- Mostrar datos básicos del cliente.
- Al seleccionar, traer condición fiscal e identificación.
- Determinar automáticamente si corresponde Factura A o B.

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

Cada ítem deberá contener:

- Código.
- Detalle.
- Cantidad.
- Precio unitario.
- Precio total.

### 13.5 Múltiples ítems

El sistema deberá contemplar que una factura pueda tener uno o varios rubros.

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
- El sistema deberá permitir cargar precio con IVA incluido.
- El sistema deberá calcular el neto dividiendo por 1.21 o por la alícuota vigente.
- Se deberá mostrar:
  - Subtotal/neto.
  - IVA.
  - Total.

Ejemplo con 21%:

```txt
Precio cargado: $1.210
Neto: $1.000
IVA: $210
Total: $1.210
```

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
- El descuento se aplica sobre el subtotal.
- Si no hay descuento, no debe mostrarse una línea vacía en el resumen.
- No debe mostrarse “DTO % 0”.

---

### 14.6 Resumen de cálculo

El resumen deberá mostrar:

```txt
SUBTOTAL
DESCUENTO %, solo si existe
IVA %, según corresponda
TOTAL
```

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

La factura deberá permitir elegir:

- Contado efectivo.
- Contado.
- Tarjeta.
- Transferencia.
- Otros.
- Cuenta corriente.

---

### 16.2 Estado de pago

Una factura estará impaga si:

- No tiene comprobante de pago adjunto.
- O no fue marcada manualmente como paga.

Una factura estará paga si:

- El administrador la marca como paga.
- O se carga comprobante de pago y se confirma el estado correspondiente.

### 16.3 Edición del estado

El estado de pago solo podrá ser editado por el administrador.

---

## 17. Recibos de pago

### 17.1 Objetivo

Permitir generar recibos de pago para todos los métodos de pago, no solo para cuenta corriente.

### 17.2 Alcance

El sistema deberá permitir generar recibos para:

- Contado efectivo.
- Contado.
- Tarjeta.
- Transferencia.
- Otros.
- Cuenta corriente.

### 17.3 Tipo de recibo

En esta etapa, el recibo se considera un documento interno del sistema, salvo que Pablo y su contadora indiquen que debe tener tratamiento fiscal específico.

### 17.4 Datos del recibo

Cada recibo deberá incluir:

- Número interno de recibo.
- Fecha.
- Cliente.
- Factura asociada.
- Método de pago.
- Monto.
- Observaciones.
- Comprobante de pago adjunto si corresponde.
- Usuario que lo generó.

### 17.5 PDF de recibo

El recibo deberá poder descargarse como PDF.

---

## 18. Comprobantes de pago

### 18.1 Objetivo

Permitir adjuntar comprobantes de pago a facturas.

### 18.2 Formatos aceptados

El comprobante podrá ser:

- Imagen.
- PDF.

Solo se permitirá cargar un archivo.

### 18.3 Edición única

Si ya existe un comprobante de pago:

- Se mostrará el archivo.
- No se mostrará el dropzone.
- El administrador podrá presionar editar.
- El sistema permitirá reemplazar el archivo una única vez.
- Luego de esa edición, no podrá volver a reemplazarse.

### 18.4 Auditoría

Debe registrarse:

- Fecha de carga.
- Fecha de edición.
- Usuario que cargó.
- Usuario que editó.
- Cantidad de ediciones realizadas.

---

## 19. Comprobantes / Lista de facturas

### 19.1 Objetivo

Consultar y administrar facturas creadas.

La sección no será solo para crear facturas, sino también para ver, filtrar, descargar, imprimir y compartir comprobantes.

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
- Estado fiscal.
- Botón descargar.
- Botón imprimir.
- Botón compartir.
- Botón ver detalle.

---

### 19.3 Filtros

La sección Comprobantes deberá permitir filtrar por:

- Rango de fechas.
- Tipo de factura A/B.
- Facturas pagas.
- Facturas impagas.
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
- Registrar pagos.
- Adjuntar comprobantes.
- Crear recibos.
- Ver dashboard.

### 24.3 No incluye

- Envío a ARCA.
- CAE real.
- QR fiscal real.
- Factura fiscal válida.
- Impacto tributario real.

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
Modo prueba activo. Las facturas creadas no se envían a ARCA y no tienen validez fiscal.
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

El formato esperado de factura será:

```txt
0007-XXXXXXXXX
```

o:

```txt
0007-XXXXXXXXXX
```

La cantidad final de dígitos se ajustará al formato fiscal usado por ARCA.

---

## 26. Flujo ARCA futuro

### 26.1 Flujo esperado

```txt
1. Usuario crea factura.
2. Sistema valida cliente, condición IVA, tipo A/B, importes y límite.
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
   - La factura queda inalterable.
9. Si rechaza:
   - Se guarda el error.
   - No se marca como emitida.
   - Se permite revisar o reintentar según caso.
10. Si hay error técnico:
   - Se guarda intento.
   - Se informa al administrador.
   - Se permite reintento controlado.
```

### 26.2 Estados fiscales

Estados posibles:

- Modo prueba.
- Borrador.
- Pendiente de emisión.
- Enviando a ARCA.
- Autorizada.
- Rechazada.
- Error técnico.
- Cancelada internamente, solo si aún no fue autorizada.

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
- Recibos.
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
- payment_receipts
- payment_proofs
- fiscal_settings
- arca_emission_attempts
- dashboard_metrics opcional
- audit_logs

### 28.4 Storage

Se deberá almacenar:

- PDFs de facturas.
- PDFs de recibos.
- Imágenes de comprobantes de pago.
- PDFs de comprobantes de pago.
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
- cuit
- dni
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
- cantidad
- precio_unitario
- precio_total

### 29.5 Recibo de pago

Campos mínimos:

- id
- factura_id
- cliente_id
- numero_recibo
- fecha
- metodo_pago
- monto
- observaciones
- pdf_url
- created_at

### 29.6 Comprobante de pago

Campos mínimos:

- id
- factura_id
- archivo_url
- tipo_archivo
- edit_count
- uploaded_at
- updated_at

---

## 30. Auditoría interna

### 30.1 Eventos auditables

El sistema deberá registrar:

- Creación de cliente.
- Edición de cliente.
- Creación de rubro.
- Edición de rubro.
- Creación de factura.
- Cambio de IVA.
- Cambio de límite de cliente genérico.
- Cambio de estado de pago.
- Carga de comprobante de pago.
- Edición de comprobante de pago.
- Generación de recibo.
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
| Sprint 2 | Facturación modo prueba + PDF + recibos | 2 semanas |
| Sprint 3 | Integración ARCA + CAE + QR | 2 semanas |

**Total estimado:** 5 a 6 semanas.

### 31.1 Sprint 1 — Clientes y Rubros

Duración estimada: **1 semana y media**.

Incluye:

- Base visual y estructura de navegación (Inicio / Dashboard + sección Facturación).
- Módulo Clientes completo.
- Módulo Rubros completo.

Corresponde a las fases 1, 2 y 3.

### 31.2 Sprint 2 — Facturación modo prueba + PDF + recibos

Duración estimada: **2 semanas**.

Incluye:

- Facturación en modo prueba (A/B, IVA, descuento, límite genérico, historial, estados de pago).
- PDF personalizado, descarga, impresión y compartir.
- Comprobantes de pago y recibos.
- Dashboard administrativo.

Corresponde a las fases 4, 5 y 6.

### 31.3 Sprint 3 — Integración ARCA + CAE + QR

Duración estimada: **2 semanas**.

Incluye:

- Configuración fiscal / ARCA.
- Homologación e integración con Arca SDK.
- Solicitud de CAE, QR fiscal y PDF fiscal definitivo.
- Preparación para producción.

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
- Determinar tipo A/B automáticamente.
- Mostrar mensaje de tipo de factura.
- Validar límite de cliente genérico.
- Aplicar IVA.
- Aplicar descuento.
- Cargar método de pago.
- Generar factura en modo prueba.
- Guardar historial.
- Estados de pago.

Entregable:

- Flujo completo de creación de factura sin ARCA.

---

### Fase 5 — PDF, impresión, comprobantes y recibos

Incluye:

- PDF personalizado de factura.
- Marca de agua modo prueba.
- Descarga.
- Impresión.
- Compartir por WhatsApp/email.
- Carga de comprobante de pago.
- Edición única de comprobante.
- Recibos de pago para todos los métodos.
- PDF de recibo.

Entregable:

- Operación interna completa de facturación y pagos.

---

### Fase 6 — Dashboard

Incluye:

- Último catálogo.
- Última lista de precios.
- Resumen mensual de facturación.
- Top clientes.
- Top rubros.
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
- Solicitud de CAE.
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
- Si elige DNI o Nada, solo se permite C.F.
- Si elige CUIT, se permiten todas las condiciones.
- El cliente recibe código automático.
- Se puede buscar y filtrar clientes.
- Se puede ver historial por cliente.

### Rubros

- Se pueden crear rubros.
- Se pueden editar rubros.
- Se puede buscar por código o nombre.
- Se puede usar la descripción en una factura.
- Se puede sobrescribir descripción solo para una factura.

### Facturas

- El sistema determina automáticamente A o B.
- Se muestra el mensaje “Se generará una Factura tipo X”.
- Se bloquea cliente genérico si supera el límite.
- Se calcula subtotal, IVA, descuento y total.
- Factura A discrimina IVA.
- Factura B muestra precio final.
- Se guarda snapshot del cliente.
- La factura queda en historial.
- Se puede descargar PDF.
- Se puede imprimir PDF.
- Se puede compartir si el cliente tiene email o WhatsApp.

### Pagos

- Se puede marcar factura como paga.
- Se puede adjuntar comprobante en imagen o PDF.
- Se puede editar el comprobante una sola vez.
- Se puede generar recibo de pago para cualquier método.

### Dashboard

- Es el primer ítem del SideNav.
- Solo lo ve el administrador.
- Muestra resumen de facturación, catálogos, listas, deudas, clientes y rubros.

### Modo prueba

- No envía datos a ARCA.
- No genera CAE real.
- No genera QR fiscal real.
- El PDF indica claramente que no tiene validez fiscal.

### ARCA futuro

- La conexión se realiza desde backend.
- Se usa punto de venta 0007.
- Se guarda CAE cuando corresponda.
- Se guarda vencimiento de CAE.
- Se registra respuesta de ARCA.
- Se manejan errores y reintentos.

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

WSFEv1 contempla emisión de comprobantes electrónicos A, B, C y M con CAE/CAEA.

Arca SDK se tomará como herramienta principal sugerida porque permite integrar servicios de ARCA desde Node.js/TypeScript, incluyendo Facturación Electrónica mediante `electronicBillingService`.

La SDK gestiona autenticación WSAA y tickets de acceso. Para despliegues cloud/serverless, será necesario usar una estrategia de almacenamiento persistente de tickets, como base de datos o storage dedicado, y no depender únicamente del filesystem local.

---

## 36. Conclusión

El módulo de Facturación Web para Rothamel Repuestos queda definido como una nueva etapa del sistema, con presupuesto aprobado de **$2.800.000 ARS**.

La estrategia correcta será avanzar primero con la base operativa:

```txt
Clientes → Rubros → Facturación en modo prueba → PDF / pagos / dashboard
```

Y recién después avanzar con:

```txt
Configuración fiscal → Homologación ARCA → Producción ARCA
```

Esto permite validar el flujo completo sin emitir comprobantes reales, evita errores fiscales innecesarios y prepara el sistema para una transición ordenada desde la operatoria actual con impresora fiscal hacia una facturación web moderna con PDF, CAE y QR fiscal.