# Reporte de Definición — P-ERP MVP 1.0

**Gestión inteligente de proyectos y operación**

| Campo | Detalle |
|---|---|
| Documento | Reporte de definición del primer MVP |
| Producto | P-ERP MVP 1.0 (nombre provisional) |
| Fecha | 27 de julio de 2026 |
| Estado | Definición funcional cerrada — pendiente de validación técnica |
| Usuario piloto | Administrador general (1 usuario) |
| Duración estimada del piloto | ~2 meses de uso real |
| Herramientas a reemplazar | Notion (gestión de proyectos) y parte de Zoho Connect (comunicación operativa) |

---

## 1. Resumen ejecutivo

P-ERP MVP 1.0 es una aplicación web que centraliza la administración de clientes, proyectos, subproyectos, hitos, tareas, responsables, registro de horas y comunicación operativa, con una capa de inteligencia artificial para consultar, resumir y analizar la información.

El propósito del MVP **no es construir un ERP completo**, sino validar el núcleo de datos y flujos sobre el cual se construirán después los módulos de ventas, facturación, recursos humanos y soporte.

El criterio de decisión del piloto es simple: **si al final del periodo la empresa puede dejar de usar Notion para gestionar proyectos y puede obtener las horas facturables por cliente sin trabajo manual, el MVP se considera exitoso.**

**Los tres pilares del alcance son:**

1. **Estructura operativa propia** — jerarquía Cliente → Proyecto → Subproyecto → Hito → Tarea, sin los workarounds que hoy exige Notion.
2. **Tiempo y facturabilidad** — registro de horas como unidad central de medición, con clasificación facturable / no facturable y consolidación automática hacia arriba.
3. **Contexto de trabajo unificado** — comentarios, actividad y publicaciones siempre ligados a un elemento del sistema, no a un canal aislado.

---

## 2. Contexto y problema

La información de proyectos y la comunicación operativa están hoy repartidas entre herramientas que no fueron diseñadas para esta operación:

| Herramienta | Función actual | Limitación identificada |
|---|---|---|
| Notion | Organización de proyectos e información | Requiere workarounds para representar la estructura y los procesos reales de la empresa |
| Zoho Connect | Comunicación operativa | Las conversaciones no quedan conectadas con proyectos, hitos y tareas |

**Información que hoy es difícil o costosa de obtener:**

- Horas trabajadas por proyecto en cada semana.
- Horas facturables por cliente.
- Avance real de proyectos y subproyectos.
- Carga de trabajo basada en fechas y horas estimadas.
- Actividades pendientes o retrasadas.
- Resúmenes ejecutivos del estado de los proyectos.

---

## 3. Objetivo e hipótesis

### Objetivo

Construir una aplicación web que permita administrar desde un solo lugar: clientes, proyectos, subproyectos, hitos, tareas, responsables, horas trabajadas, horas facturables, comunicación relacionada con el trabajo e información operativa generada con IA.

### Hipótesis a validar

> Si la empresa puede administrar proyectos, subproyectos, hitos, tareas, responsables, comunicación y horas facturables desde una sola plataforma, se reducirá la dispersión de información y será posible obtener mayor claridad sobre la operación sin depender de workarounds en Notion.

**Condición asociada:** la inteligencia artificial debe facilitar la consulta y comprensión de la información, pero **no sustituye** el funcionamiento básico del sistema. Si la IA se apaga, el producto debe seguir siendo utilizable.

---

## 4. Modelo operativo

### 4.1 Jerarquía

```
Cliente
  └── Proyecto
        └── Subproyecto  (opcional — 0, 1 o varios)
              └── Hito
                    └── Tarea  (1 o varios responsables)
                          └── Registro de horas
```

| Nivel | Representa |
|---|---|
| **Cliente** | Empresa o persona para quien se realiza el trabajo |
| **Proyecto** | Iniciativa, servicio, implementación o desarrollo contratado |
| **Subproyecto** | Componente, área, producto, etapa o frente de trabajo (opcional) |
| **Hito** | Resultado importante, entrega o punto de control |
| **Tarea** | Actividad concreta necesaria para completar un hito |

Un proyecto pequeño puede contener hitos y tareas directamente, sin subproyectos.

### 4.2 Modelo de tiempo

La **tarea es la unidad principal de registro de tiempo**; los totales se consolidan automáticamente hacia hito, subproyecto y proyecto.

| Tipo de hora | Definición | Uso principal |
|---|---|---|
| Estimadas | Esfuerzo previsto para completar el trabajo | Planeación y carga de trabajo |
| Registradas | Tiempo real invertido por los usuarios | Medición de esfuerzo |
| Facturables | Horas cobrables al cliente | Preparación de cobro |
| No facturables | Tiempo interno, administrativo o no cobrable | Costo interno |

Estas métricas permiten comparar planeado vs. ejecutado, medir desviaciones, calcular carga de trabajo, generar reportes semanales y determinar la facturación por cliente y proyecto.

---

## 5. Alcance funcional

### 5.1 Módulos incluidos

| # | Módulo | Contenido esencial | Exclusión explícita |
|---|---|---|---|
| 7.1 | **Clientes** | Nombre comercial, razón social (opc.), contacto, correo, teléfono, estado, notas, proyectos, horas trabajadas y facturables, actividad reciente | Sin CRM ni seguimiento de oportunidades |
| 7.2 | **Proyectos** | Cliente, descripción, responsable, participantes, estado, prioridad, fechas, horas presupuestadas, tarifa, horas trabajadas y facturables, progreso, salud, subproyectos, hitos, tareas, actividad | — |
| 7.3 | **Subproyectos** | Proyecto padre, descripción, responsable, participantes, estado, fechas, horas estimadas y registradas, progreso, hitos y tareas relacionadas | Opcionales por diseño |
| 7.4 | **Hitos** | Proyecto, subproyecto (cuando aplique), responsable, participantes, fecha objetivo, estado, orden, horas, % de avance, tareas, comentarios | — |
| 7.5 | **Tareas** | Proyecto/subproyecto/hito, uno o varios responsables, estado, prioridad, fechas, horas estimadas/registradas/restantes, facturabilidad, comentarios, archivos, historial | — |
| 7.6 | **Registro de horas** | Usuario, cliente, proyecto, subproyecto, hito (opc.), tarea, fecha, horas, descripción, facturabilidad, estado de aprobación | Aprobación configurable como opcional |
| 7.7 | **Facturación por horas** | Consultas de horas facturables por cliente/proyecto/semana, importes estimados, exceso sobre presupuesto | **Sin CFDI ni integración contable** |
| 7.8 | **Reporte semanal** | Totales, desglose por cliente/proyecto/subproyecto/tarea/responsable, comparativos, filtros, exportación CSV/Excel | — |
| 7.9 | **Carga de trabajo** | Capacidad, horas comprometidas, % ocupación, trabajo vencido, semanas con sobrecarga, trabajo sin estimación | — |
| 8 | **Comunicación operativa** | Comentarios en todos los niveles, respuestas, menciones, adjuntos, historial, notificaciones internas, feed interno | Sin mensajería privada, videollamadas ni sustitución total de Slack |
| 9 | **Inteligencia artificial** | Resumen de proyecto, resumen semanal, consulta en lenguaje natural, asistencia para crear tareas | Respuestas solo con datos del sistema |
| 10 | **Personalización** | Estados, etiquetas, prioridades, tipos de proyecto, categorías de horas, campos personalizados, vistas y filtros guardados | Sin constructor libre de módulos y relaciones |
| 11 | **Dashboard** | Proyectos activos/en riesgo/retrasados, hitos próximos, tareas atrasadas y bloqueadas, horas de la semana, comparativos, carga, actividad, alertas de IA | — |

### 5.2 Catálogos de estados definidos

| Entidad | Estados iniciales |
|---|---|
| Proyecto | Borrador · Planeación · Activo · En pausa · En riesgo · Completado · Cancelado |
| Salud del proyecto | En tiempo · Requiere atención · En riesgo · Retrasado |
| Hito | Pendiente · En progreso · Bloqueado · En revisión · Completado · Cancelado |
| Tarea | Pendiente · En progreso · En revisión · Bloqueada · Completada · Cancelada |
| Aprobación de horas | Borrador · Enviado · Aprobado · Rechazado |
| Facturación del registro | No facturable · Pendiente de facturar · Incluido en corte · Facturado |
| Carga de trabajo | Disponible · Carga adecuada · Cerca del límite · Sobrecargado · Sin información suficiente |

### 5.3 Vistas mínimas de tareas

Lista · Kanban · Mis tareas · Tareas por proyecto · Tareas por responsable · Tareas próximas a vencer · Tareas atrasadas.

### 5.4 Campos personalizados soportados

Texto · Número · Fecha · Selección · Selección múltiple · Casilla de verificación · Usuario · Enlace.

---

## 6. Capa de inteligencia artificial

La IA se incorpora como **capa de asistencia sobre los datos del sistema**, con cuatro funciones:

| Función | Entrada | Salida esperada |
|---|---|---|
| **Resumen de proyecto** | Datos del proyecto y su árbol | Estado actual, trabajo completado y pendiente, próximos hitos, tareas retrasadas, bloqueos, horas trabajadas, riesgos detectados |
| **Resumen semanal** | Actividad, tareas completadas, comentarios, horas, hitos próximos | Reporte semanal con problemas y retrasos |
| **Consulta en lenguaje natural** | Pregunta del usuario | Respuesta basada únicamente en datos del sistema, indicando cuando no haya información suficiente |
| **Asistencia para crear tareas** | Descripción libre del trabajo | Propuesta de subproyectos, hitos, tareas, fechas, horas estimadas, riesgos y criterios de aceptación — **con confirmación obligatoria del usuario** |

**Preguntas de referencia para la consulta en lenguaje natural:** horas trabajadas en la semana por proyecto, tareas retrasadas, proyectos con sobreconsumo de horas, principales bloqueos, prioridades de la semana, horas facturables por cliente.

---

## 7. Fuera de alcance del primer MVP

| Categoría | Excluido |
|---|---|
| Comercial | CRM y pipeline, prospectos, cotizaciones, firma de contratos |
| Financiero | Facturación fiscal (CFDI), contabilidad, nómina |
| Operativo | Inventarios, compras y proveedores, sistema completo de tickets |
| Colaboración | Chat en tiempo real, videollamadas, correo interno, editor de documentos tipo Notion |
| Producto | Portal de clientes, apps móviles nativas |
| Avanzado | Automatizaciones visuales, integraciones masivas, Gantt avanzado, dependencias complejas, gestión de código |
| Personas | RH, evaluaciones de desempeño |

Se permitirán **enlaces** hacia Google Drive, documentos, repositorios y otras herramientas externas.

---

## 8. Flujo principal validado

1. Registrar cliente → 2. Crear proyecto → 3. Definir subproyectos → 4. Crear hitos → 5. Dividir en tareas → 6. Asignar responsables → 7. Definir fechas y horas estimadas → 8. Registrar avances y comentarios → 9. Registrar horas trabajadas → 10. Clasificar facturabilidad → 11. Aprobar horas (o aprobación automática) → 12. Consultar reporte semanal → 13. Revisar carga, atrasos y desviaciones → 14. Generar resumen con IA → 15. Cerrar hitos, subproyectos y proyectos.

---

## 9. Priorización del desarrollo

| Prioridad | Bloque | Alcance | Comentario |
|---|---|---|---|
| **P1** | Núcleo obligatorio | Autenticación, organización, clientes, proyectos, subproyectos, hitos, tareas, varios responsables, estados y prioridades, registro de horas, horas facturables, reporte semanal, dashboard básico | Sin esto no hay producto utilizable |
| **P2** | Operación y colaboración | Comentarios, actividad, menciones, notificaciones, archivos y enlaces, aprobación opcional de horas, carga de trabajo, exportación | Mayoritariamente **no validable** con un solo usuario |
| **P3** | Inteligencia artificial | Resumen de proyecto, resumen semanal, preguntas en lenguaje natural, detección de riesgos, propuesta de hitos y tareas | Depende de que P1 ya genere datos reales |
| **P4** | Personalización | Estados y campos personalizados, vistas guardadas, filtros, configuración de categorías | **Ver observación crítica en §12.1** |

---

## 10. Criterios de aceptación funcional

El MVP se considera funcionalmente completo cuando sea posible ejecutar los 17 puntos siguientes:

| # | Criterio | Módulo asociado |
|---|---|---|
| 1 | Crear un cliente | 7.1 |
| 2 | Crear un proyecto relacionado con el cliente | 7.2 |
| 3 | Crear subproyectos | 7.3 |
| 4 | Crear hitos dentro del proyecto o subproyecto | 7.4 |
| 5 | Crear tareas con varios responsables | 7.5 |
| 6 | Asignar fechas y horas estimadas | 7.2–7.5 |
| 7 | Registrar horas contra una tarea | 7.6 |
| 8 | Clasificar las horas como facturables | 7.6 / 7.7 |
| 9 | Consultar las horas de un proyecto por semana | 7.8 |
| 10 | Comparar horas estimadas contra reales | 7.8 |
| 11 | Consultar la carga de trabajo | 7.9 |
| 12 | Publicar comentarios y actualizaciones | 8 |
| 13 | Consultar el historial de actividad | 8 |
| 14 | Generar un resumen mediante IA | 9.1 |
| 15 | Realizar preguntas sobre la información registrada | 9.3 |
| 16 | Filtrar y exportar los registros de horas | 7.8 |
| 17 | Personalizar estados, categorías y algunos campos | 10 |

---

## 11. Criterios de éxito del piloto

### 11.1 Criterios definidos

Tras aproximadamente dos meses, el MVP será exitoso si: permite administrar los proyectos que antes se gestionaban en Notion; elimina los principales workarounds; la jerarquía representa correctamente la operación; permite obtener las horas semanales por proyecto y las horas cobrables por cliente; centraliza comentarios y actualizaciones; los reportes se obtienen sin preparación manual; la IA genera resúmenes útiles basados en datos reales; el sistema se usa diariamente sin regresar a Notion; y la arquitectura permite agregar usuarios sin reconstruir el producto.

### 11.2 Métricas propuestas para hacerlos medibles

Los criterios anteriores son cualitativos. Se propone acompañarlos de indicadores verificables:

| Criterio | Métrica propuesta | Umbral sugerido |
|---|---|---|
| Sustitución de Notion | % de proyectos activos gestionados exclusivamente en P-ERP | ≥ 90 % al cierre del piloto |
| Uso diario | Días con al menos un registro de horas | ≥ 80 % de días hábiles |
| Eliminación de trabajo manual | Tiempo para producir el reporte semanal de horas | < 5 min (vs. baseline actual) |
| Cobertura de estimación | % de tareas con horas estimadas | ≥ 80 % |
| Calidad de datos de facturación | % de registros de horas con facturabilidad clasificada | 100 % |
| Utilidad de la IA | % de resúmenes aceptados sin corrección mayor | ≥ 70 % |
| Precisión de la IA | Respuestas con datos incorrectos o inventados | 0 tolerancia; medir y registrar |

**Nota:** conviene capturar la línea base actual (tiempo de armado de reportes en Notion, horas facturables identificadas por mes) **antes** de iniciar el piloto; de lo contrario no habrá contra qué comparar.

---

## 12. Observaciones, riesgos y puntos a resolver

Esta sección no forma parte de la definición original; recoge inconsistencias y vacíos detectados al revisarla.

### 12.1 Contradicción de prioridad en personalización

La sección 10 establece que el MVP **debe incluir personalización desde el inicio**, precisamente porque los workarounds de Notion son una de las razones del proyecto. Sin embargo, la priorización coloca la personalización en **P4**, el último bloque.

**Riesgo:** si el piloto arranca sin estados ni campos personalizados, el usuario reproducirá los mismos workarounds que motivaron el cambio, y uno de los criterios de éxito quedará invalidado desde el día uno.

**Recomendación:** subir a P1 el mínimo indispensable — **estados personalizados por entidad y 2–3 campos personalizados básicos** — y dejar en P4 las vistas guardadas, filtros avanzados y el resto de los tipos de campo.

### 12.2 Entidad "Organización" no definida

"Organización" aparece en P1 pero no está descrita en ningún módulo del alcance funcional. **Debe definirse antes de modelar la base de datos**, ya que determina si el sistema será multi-tenant desde el inicio o de instancia única. Cambiarlo después es costoso.

### 12.3 Regla de consolidación de horas no especificada

Proyecto, subproyecto, hito y tarea tienen todos "horas estimadas", pero no se define si el valor superior es la **suma de los hijos** o un valor **fijado independientemente** (presupuesto contra el cual se compara).

**Recomendación:** manejar ambos campos de forma explícita — `horas presupuestadas` (capturadas manualmente en proyecto) vs. `horas estimadas consolidadas` (suma calculada) — y mostrar la diferencia como indicador de desviación de planeación.

### 12.4 Modelo de tarifa sin definir

El campo "Tarifa o método de cobro" existe a nivel proyecto, pero no se especifica si la tarifa es por proyecto, por persona, por rol o por tipo de tarea. Esto impacta directamente el cálculo de "importe estimado" del módulo 7.7.

**Recomendación mínima para el MVP:** una tarifa única por proyecto, con posibilidad de sobrescribirla a nivel cliente. Tarifas por persona/rol quedan para la siguiente iteración.

### 12.5 Interacción entre estado de aprobación y estado de facturación

Se definen dos máquinas de estado independientes sobre el mismo registro de horas. Falta la regla que las conecta.

**Recomendación:** un registro solo puede pasar a "Pendiente de facturar" si su estado de aprobación es "Aprobado" (o si la aprobación está desactivada).

### 12.6 Migración desde Notion no contemplada

Uno de los criterios de éxito es dejar de usar Notion, pero **no hay alcance ni esfuerzo asignado a migrar los proyectos existentes**. Debe decidirse explícitamente: importación (CSV/API), captura manual, o arranque solo con proyectos nuevos.

### 12.7 Requerimientos no funcionales ausentes

La definición es puramente funcional. Antes de desarrollar conviene fijar, al menos: modelo de autenticación, política de respaldos, bitácora de auditoría, tiempos de respuesta aceptables en reportes, y manejo de datos de clientes.

### 12.8 P2 y P3 dependen de condiciones que el piloto no reproduce

Menciones, notificaciones, aprobación de horas y distribución de carga entre personas **no son validables con un solo usuario** — la propia definición lo reconoce en la sección 16. Construirlos a fondo en la primera etapa es inversión con retorno diferido.

**Recomendación:** implementarlos en su versión más simple posible y priorizar la **segunda etapa del piloto con 3–5 usuarios internos**, que es donde realmente se validan.

### 12.9 Riesgo de alcance en la IA

La consulta en lenguaje natural sobre datos propios es la función de mayor riesgo técnico del MVP: exige una capa de acceso a datos confiable y controles contra respuestas inventadas. La regla ya definida —responder solo con información del sistema e indicar cuando no haya datos suficientes— **debe tratarse como criterio de aceptación bloqueante**, no como aspiración.

---

## 13. Limitaciones reconocidas del piloto individual

| Sí valida | No valida |
|---|---|
| Estructura de datos | Colaboración entre usuarios |
| Creación y administración de proyectos | Menciones y notificaciones |
| Registro de horas | Asignación real de varios responsables |
| Reportes | Aprobación de horas |
| Personalización | Distribución de carga entre colaboradores |
| Flujos principales | Adopción por parte del equipo |
| Funciones de IA | Sustitución real de Zoho Connect |

Por esta razón, se recomienda una **segunda etapa del piloto con un grupo pequeño de usuarios internos** antes de dar por validado el producto.

---

## 14. Próximos pasos sugeridos

| # | Acción | Responsable | Momento |
|---|---|---|---|
| 1 | Resolver los puntos abiertos de §12.1 a §12.5 (personalización, organización, consolidación de horas, tarifa, estados) | Producto | Antes de modelar datos |
| 2 | Definir requerimientos no funcionales mínimos (§12.7) | Técnico | Antes de desarrollo |
| 3 | Capturar la línea base de métricas actuales en Notion (§11.2) | Administrador | Antes del piloto |
| 4 | Decidir estrategia de migración desde Notion (§12.6) | Producto | Antes del piloto |
| 5 | Definir modelo de datos y stack técnico | Técnico | Iteración 0 |
| 6 | Construir y liberar P1 | Desarrollo | Iteración 1 |
| 7 | Iniciar piloto individual y medir contra §11.2 | Administrador | ~2 meses |
| 8 | Planear segunda etapa del piloto con 3–5 usuarios | Producto | Al cierre de la etapa 1 |

---

## 15. Definición resumida

> **P-ERP MVP 1.0** será una aplicación web para administrar clientes, proyectos, subproyectos, hitos, tareas, responsables, comunicación y horas facturables. Permitirá reemplazar la gestión de proyectos realizada en Notion, centralizar parte de la comunicación operativa de Zoho Connect y utilizar inteligencia artificial para consultar, resumir y analizar la información del trabajo.