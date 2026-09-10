# Manual de Usuario — WarehOS

Bienvenido a **WarehOS**, el sistema de gestión de inventarios para tu empresa. Con esta aplicación podrás registrar productos, controlar las entradas y salidas de stock, recibir alertas cuando un producto esté por agotarse y generar reportes.

---

## Tabla de contenidos

1. [Primeros pasos](#1-primeros-pasos)
2. [Iniciar y cerrar sesión](#2-iniciar-y-cerrar-sesión)
3. [Dashboard (panel principal)](#3-dashboard-panel-principal)
4. [Gestionar categorías](#4-gestionar-categorías)
5. [Gestionar productos](#5-gestionar-productos)
6. [Registrar movimientos de inventario](#6-registrar-movimientos-de-inventario)
7. [Generar reportes](#7-generar-reportes)
8. [Configuración de la empresa](#8-configuración-de-la-empresa)
9. [Licencia y activación](#9-licencia-y-activación)
10. [Cambiar contraseña](#10-cambiar-contraseña)
11. [Pregunta de seguridad (recuperación de contraseña)](#11-pregunta-de-seguridad-recuperación-de-contraseña)
12. [Copias de seguridad (backup)](#12-copias-de-seguridad-backup)
13. [Roles de usuario](#13-roles-de-usuario)
14. [Gestionar usuarios](#14-gestionar-usuarios)
15. [Auditoría](#15-auditoría)
16. [Actualizaciones de la aplicación](#16-actualizaciones-de-la-aplicación)
17. [Preguntas frecuentes](#17-preguntas-frecuentes)

---

## 1. Primeros pasos

Al abrir la aplicación, verás la pantalla de **Inicio de sesión**.

- **Si es tu primera vez**, ya existe un usuario administrador:
  - **Usuario:** `admin`
  - **Contraseña:** `admin123`
- **Si quieres crear otro usuario**, haz clic en **"¿No tienes cuenta? Regístrate"** y completa el formulario.

> 🔒 **Recomendación:** Cambia la contraseña por defecto del administrador lo antes posible desde **Configuración → Cambiar contraseña** (ver [sección 9](#9-cambiar-contraseña)).

> 💡 **Recomendación:** El administrador es quien gestiona los productos y movimientos. El staff con rol de *operador* puede hacer operaciones; el rol *visor* solo consulta.

### Asistente de configuración (primera vez)

Si la aplicación aún no tiene los datos de tu empresa, al iniciar sesión como administrador verás el asistente **"Bienvenido a WarehOS"**:

1. Pulsa **Continuar**.
2. Completa el **nombre de tu empresa** (obligatorio), RUC, teléfono, email, dirección y elige tu **moneda** (bolívares, dólares o euros).
3. Pulsa **Guardar y empezar**.

Puedes pulsar **Omitir** si quieres hacerlo después; también puedes editar todo en **Configuración → Datos de la empresa**.

### Guía de primeros pasos (Dashboard)

En el Dashboard verás la tarjeta **"Primeros pasos"** con las 4 tareas recomendadas para dejar listo tu inventario:

1. **Completar los datos de tu empresa** — Configuración → Datos de la empresa.
2. **Crear una categoría** — Productos → **+ Categorías**.
3. **Registrar tu primer producto** — Productos → **+ Nuevo producto**.
4. **Registrar un movimiento de inventario** — Inventario → **Nuevo movimiento**.

Cada meta se marca automáticamente al completarla. Puedes ocultar la tarjeta con la **×** (vuelve a aparecer si quedan tareas pendientes en un equipo nuevo).

---

## 2. Iniciar y cerrar sesión

### Iniciar sesión
1. Escribe tu **usuario** y **contraseña**.
2. Haz clic en **"Ingresar"**.
3. Serás llevado al Dashboard.

### Cerrar sesión
1. En la barra lateral (izquierda), en la parte inferior, está tu nombre y rol.
2. Haz clic en **"Cerrar sesión"**.

---

## 3. Dashboard (panel principal)

El Dashboard es tu pantalla de resumen al iniciar sesión. Muestra:

- **Productos registrados** — cuántos productos tienes.
- **Valor total del inventario** — la suma del costo de todo tu stock.
- **Productos con stock bajo** — cuántos productos están por debajo de su mínimo.
- **Lista de alertas** — productos que necesitan reabastecerse (se muestran en rojo).
- **Lotes por vencer** — si tienes productos con control de lotes, se listan los lotes **vencidos** (rojo) y los que vencen dentro del umbral configurado (ámbar).
- **Gráficos**:
  - **Tendencia de stock (30 días)** — evolución del total de unidades en los últimos 30 días.
  - **Top productos (salidas · 30 días)** — los productos con más salidas en el último mes.
  - **Distribución de stock por categoría** — cómo se reparte el stock actual entre tus categorías.
- **Movimientos recientes** — las últimas entradas y salidas registradas.

Usa esta pantalla para saber de un vistazo cómo está tu inventario.

---

## 4. Gestionar categorías

Las categorías sirven para agrupar tus productos (ej: "Electrónica", "Alimentos", "Ropa", "Repuestos", etc.).

### Crear una categoría
1. Ve a la pestaña **Productos**.
2. Haz clic en el botón **"+ Categorías"**.
3. Escribe el **nombre** (obligatorio) y una **descripción** (opcional).
4. Haz clic en **"Guardar"**.

> Una categoría que tenga productos asignados **no se puede eliminar**. Primero debes quitar o mover sus productos.

---

## 5. Gestionar productos

### Crear un nuevo producto
1. Ve a la pestaña **Productos**.
2. Haz clic en **"+ Nuevo producto"**.
3. Completa los campos:
   - **Nombre** (obligatorio): el nombre del producto.
   - **SKU** (obligatorio): un código único que identifica al producto (ej: `ELEC-001`). No pueden repetirse.
   - **Código de barras** (opcional): el código EAN-13, UPC o Code128 que aparece en la etiqueta del producto (ej: `7501000112345`). No pueden repetirse. Se guarda automáticamente en mayúsculas.
   - **Descripción** (opcional).
   - **Categoría** (obligatorio): selecciona una de las categorías creadas.
   - **Unidad de medida**: cómo se mide (unidades, kg, litros, cajas, etc.).
   - **Stock mínimo**: la cantidad mínima que quieres tener. Si el stock baja de este número, la app te alertará.
   - **Precio costo**: cuánto te cuesta adquirir el producto.
   - **Precio venta**: el precio al que lo vendes.
   - **Control por lotes y fechas de vencimiento** (opcional): actívalo si necesitas rastrear **lotes y fechas de vencimiento** (ej: alimentos, medicamentos, cosméticos). Ver "Lotes y fechas de vencimiento" en la sección 6.
4. Haz clic en **"Crear producto"**.

### Ver y buscar productos
En la pestaña **Productos** se listan todos los productos en una tabla.
- Usa la **barra de búsqueda** para filtrar por nombre, SKU o código de barras.
- Si tienes un **lector USB de códigos de barras**, simplemente apúntalo a un producto y dispara con la barra de búsqueda enfocada (o sin enfocar): el código se escribirá y la lista filtrará ese producto automáticamente.
- Usa el **desplegable de categorías** para ver solo los de una categoría.
- Haz clic en una fila para **editar** el producto.

### Editar un producto
1. Haz clic en el botón **"Editar"** del producto (o en la fila).
2. Modifica los campos que necesites.
3. Haz clic en **"Guardar cambios"**.

### Eliminar un producto
1. Haz clic en el botón **"Eliminar"** del producto.
2. Confirma la operación.

> ⚠️ **Importante:** Un producto que ya tenga **movimientos registrados** (entradas/salidas) **no se puede eliminar**. Esto protege el historial de tu inventario.

### Imprimir etiquetas de código de barras
Puedes generar etiquetas adhesivas (o de estante) para cualquier producto desde la lista de **Productos**:

1. Haz clic en el botón **"Etiqueta"** en la fila del producto.
2. En la ventana que se abre verás una **vista previa** del código de barras (usa el código de barras del producto, o su SKU si no tiene).
3. Elige el **tamaño de etiqueta**: 50 × 30 mm, 60 × 40 mm o 80 × 50 mm (los tamaños estándar de etiquetas adhesivas).
4. Indica el número de **copias** por hoja A4.
5. Pulsa **"Generar etiqueta PDF"**. El PDF se descarga y, al abrirlo, se lanza automáticamente el diálogo de impresión de tu sistema.

> 💡 El código se genera automáticamente como **EAN-13** (13 dígitos), **UPC-A** (12 dígitos) o **Code128** (texto alfanumérico) según el dato. Las etiquetas incluyen nombre del producto, SKU, stock y precio.

### Importar productos desde Excel o CSV
Si tienes un catálogo en una hoja de cálculo, puedes cargarlo de una sola vez en lugar de crear cada producto a mano.

1. Ve a **Productos** y haz clic en **"Importar"**.
2. Selecciona un archivo **CSV**, **Excel (.xlsx)** o **.xls**.
3. La app leerá la hoja y creará los productos (y las categorías que no existen) automáticamente.
4. Verás un resumen: cuántos productos se importaron y cuáles se omitieron (por SKU duplicado o datos faltantes).

**Columnas reconocidas** (el encabezado puede estar en español o inglés):

| Columna (español) | Columna (inglés) | Descripción |
|---|---|---|
| `nombre` | `name` | Nombre del producto (obligatorio) |
| `sku` | `sku` | Código único (obligatorio, sin repetir) |
| `codigo_barras` | `barcode` | Código de barras EAN-13/UPC/Code128 (opcional, sin repetir) |
| `descripcion` | `description` | Descripción (opcional) |
| `categoria` | `category` | Categoría (se crea si no existe) |
| `unidad` | `unit` | Unidad de medida (ej: uds, kg) |
| `stock_min` | `stock_min` | Stock mínimo (opcional) |
| `stock_inicial` | `stock` / `current_stock` | Stock inicial (opcional) |
| `costo` | `cost` / `cost_price` | Precio de costo |
| `precio_venta` | `price` / `sale_price` | Precio de venta |

> **Formatos de archivo aceptados:** separados por coma, punto y coma o tabulador (Excel en español exporta con `;`); con o sin BOM; en UTF-8, UTF-16 o Latin-1 (acentos como `ñ`/`á` se leen bien). Los precios aceptan coma o punto decimal (`1,50` o `1.50`) y separador de miles (`1.234,56`).

> Los productos con **SKU duplicado** o **código de barras duplicado** se omiten para no dañar el catálogo. Primera fila = encabezados. Los encabezados pueden llevar espacios, mayúsculas o acentos (`Precio de Venta`, `Código de barras`).

---

## 6. Registrar movimientos de inventario

Una vez que tienes productos, debes registrar los movimientos que afectan su stock.

### Tipos de movimiento
| Tipo | Qué hace | Ejemplo |
|---|---|---|
| **Entrada** | Aumenta el stock | Llegada de mercadería, compra a proveedor |
| **Salida** | Disminuye el stock | Venta, uso interno, merma |
| **Ajuste** | Fija el stock a un valor exacto | Corrección de conteo físico o sobrante |
| **Transferencia** | **Mueve** stock entre almacenes (no cambia el total) | Envío de una sucursal a otra |

### Almacenes

Tu inventario puede estar repartido en varios **almacenes** (sucursales/ubicaciones). Cada producto tiene su propio stock en cada almacén, y el total mostrado en Productos/Dashboard es la **suma de todos**.

- Al instalarse existe un **Almacén Principal**; los administradores pueden crear, editar y eliminar más almacenes desde la pestaña **Almacenes** (visible solo para admins). El almacén principal no se puede eliminar.
- En **Productos** hay un filtro por almacén: al elegir uno, la columna Stock muestra lo que hay en ese almacén; sin filtro, muestra el total y, si tienes varios almacenes, el desglose por almacén.

### Cómo registrar un movimiento
1. Ve a la pestaña **Inventario**.
2. Haz clic en **"+ Registrar movimiento"**.
3. Completa el formulario:
   - **Código de barras (lector USB)**: campo principal. Escanea el código del producto y este se seleccionará automáticamente (el cursor pasa a la cantidad).
   - **Producto**: selecciona de la lista (muestra el stock en el almacén elegido). Si escaneaste, ya estará seleccionado.
   - **Almacén**: dónde entra/sale o se ajusta el stock. En una **transferencia** se piden **origen** y **destino**.
   - **Tipo de movimiento**: Entrada, Salida, Ajuste o Transferencia.
   - **Cantidad**: la cantidad del movimiento.
     - En *entrada* o *salida*, debe ser mayor a 0.
     - En *ajuste*, indica el **nuevo stock total** (puede ser 0).
     - En *transferencia*, la cantidad que se mueve (debe existir en el origen).
   - **Nota** (opcional): una referencia del porqué (ej: "Factura #123", "Venta de mostrador").
4. Haz clic en **"Registrar"**.

   Si el producto **controla lotes** (tiene activada la casilla "Control por lotes y fechas de vencimiento"):
   - En una **entrada** se piden el **número de lote** (obligatorio, por ejemplo `L-2026-001`) y la **fecha de vencimiento** (opcional).
   - En una **salida**, **transferencia** o **ajuste** verás un aviso: las salidas y transferencias descuentan **del lote que vence primero (FEFO)**, y el ajuste reasigna el stock entre los lotes conservando los que vencen primero.

### Lotes y fechas de vencimiento

Para productos con control por lotes activado:

- **Desglose**: en **Productos**, la columna *Lotes / Vencimiento* muestra el próximo vencimiento y un botón **"Ver lotes"** con el detalle por lote (lote, vencimiento, almacén, cantidad y estado: *Vigente / Por vencer / Vencido*). Los lotes **sin fecha de vencimiento** se muestran al final.
- **Alertas**: el **Dashboard** muestra la tarjeta *Lotes por vencer* con los lotes que ya vencieron (rojo) o que vencen dentro del umbral configurado (ámbar). El umbral por defecto es **30 días** y lo ajustan los administradores en **Configuración → Alertas de vencimiento**.
- **Entradas con lote**: si un producto controla lotes, cada entrada debe indicar su lote (podría ser el mismo lote al llegar más mercadería). El stock de un mismo lote se acumula.
- **Desactivar el control**: al quitarlo en el producto se descartan los lotes registrados; al activarlo con stock existente, el stock actual se agrupa en un lote llamado **"Inicial"**.

> 🔍 **Escaneo rápido:** puedes disparar el lector desde cualquier lugar de la pantalla **Inventario** (sin necesidad de clic): la app abrirá el formulario con el producto cargado. Cuando registras un movimiento **escaneado**, la ventana permanece abierta y el cursor vuelve al campo de código para que puedas registrar el siguiente producto sin interrupciones. Si seleccionas el producto a mano, la ventana se cierra al registrar.

### Ver el historial de movimientos
En la pestaña **Inventario** verás la tabla de movimientos con:
- **Fecha** y hora del movimiento.
- **Tipo** (Entrada/Salida/Ajuste/**Transferencia**).
- Producto, cantidad y stock resultante.
- **Almacén** (en transferencias: `origen → destino`).
- Nota y usuario que lo registró.

Puedes **filtrar** la lista por tipo de movimiento, por **almacén** y por rango de fechas (desde / hasta).

> ⚠️ Si intentas una **salida mayor al stock disponible**, la app te lo impedirá mostrando un mensaje de error.

### Exportar el historial de movimientos
En la pestaña **Inventario** tienes dos botones para guardar los movimientos (aplican los filtros activos):

| Formato | Para qué usarlo |
|---|---|
| **Exportar PDF** | Informe formal con datos de tu empresa, filtros aplicados y totales por tipo |
| **Exportar CSV** | Para abrir en Excel o procesar datos |

El archivo se descarga con el nombre `movimientos_FECHA`.

---

## 7. Generar reportes

La pestaña **Reportes** te permite ver el estado actual de tu inventario y exportarlo.

### Reporte de inventario actual
- Muestra cada producto con su categoría, stock, costo unitario y el **valor total** de su stock.
- En la parte superior se resumen: número de productos, unidades totales y el **valor total del inventario**.

### Exportar un reporte
Puedes guardar el reporte en dos formatos:

| Formato | Para qué usarlo |
|---|---|
| **PDF** | Para imprimir o compartir formalmente |
| **CSV** | Para abrir en Excel o procesar datos |

1. Haz clic en **"Exportar PDF"** o **"Exportar CSV"**.
2. El archivo se descargará a tu carpeta de descargas con el nombre `inventario_actual_FECHA`.

> Los reportes incluyen los datos de tu empresa (nombre, dirección, RUC) configurados en la sección de Configuración.

---

## 8. Configuración de la empresa

En **Configuración** puedes guardar los datos de tu empresa. Estos datos aparecen en los reportes PDF.

Campos:
- **Nombre de la empresa**
- **Dirección**
- **Teléfono**
- **Email**
- **RUC / ID Fiscal**
- **Moneda**: la moneda en la que se muestran los precios y valores del inventario. Soporta 3 monedas: **Bolívares (VES), Dólares (USD) y Euros (EUR)**.

1. Completa los campos.
2. Elige la **moneda** que usas (los precios y reportes se mostrarán con ella).
3. Haz clic en **"Guardar empresa"**.

> 🌐 **Idioma de la interfaz:** en Configuración también puedes cambiar el idioma de la app (Español, English, Português). También aparece un selector de idioma en la pantalla de inicio de sesión.

### Alertas de vencimiento
En **Configuración** también se ajusta el umbral de las alertas por vencimiento de lotes (solo administradores):
- **Días de anticipación**: cuántos días antes de la fecha de vencimiento un lote se marca como *"por vencer"* en el Dashboard. El valor por defecto es **30** (entre 1 y 365).
- Cambia el número y pulsa **"Guardar"**. Aplica también a las próximas alertas del Dashboard.

### Notificaciones del sistema
En **Configuración → Notificaciones** puedes controlar las alertas que el sistema operativo muestra (solo administradores):
- **Activar stock bajo**: marca "Activar alertas de stock bajo" para avisar cuando un producto quede en o por debajo de su mínimo.
- **Activar lotes por vencer**: marca "Activar alertas de lotes por vencer" para avisar cuando los lotes se acerquen a su fecha de vencimiento (según el umbral de "Alertas de vencimiento").
- **Cada cuánto revisar**: número de minutos entre revisiones (mínimo 5). Es el ritmo al que la app detecta productos por debajo de su mínimo y lotes próximos a vencer.
- **Probar notificación**: pulsa **"Probar notificación"** para ver cómo se verán las alertas en tu sistema.

> 💡 Las notificaciones dependen de los **permisos de notificaciones** de tu sistema operativo; si no ves alertas, revísalos en la configuración de Windows/macOS.

### Apariencia (tema claro/oscuro)
WarehOS incluye un **tema oscuro** para trabajar cómodamente con poca luz:
- Ve a **Configuración → Apariencia** y elige entre **Claro**, **Oscuro** o **Sistema** (sigue el tema de Windows/macOS).
- También puedes cambiar el tema rápidamente con el **ícono de sol/luna** en la barra lateral (parte inferior, junto a tu perfil).
- La preferencia se guarda automáticamente y se aplica al volver a abrir la app.

---

## 9. Licencia y activación

WarehOS funciona con un **periodo de prueba de 15 días**. Mientras la licencia de prueba está activa puedes usar todas las funciones; al vencer, la aplicación pasa a **modo solo lectura** (puedes consultar datos pero no modificarlos).

### Funciones de la versión Pro
La **versión Pro** desbloquea funciones adicionales:
- **Importación masiva** de productos desde Excel/CSV.
- **Exportación** de reportes e historial de movimientos a PDF y CSV.
- **Etiquetas** de código de barras.
- **Copias de seguridad** (backup/restauración).

### Cómo saber en qué versión estás
- En el menú lateral (de color verde/ámbar/rojo) se muestra **Versión Pro**, **Prueba · N días** o **Prueba finalizada**.
- En la parte superior de cada pantalla hay un aviso con los días restantes de prueba.

### Activar tu licencia Pro
1. Ve a **Configuración** → sección **"Licencia"**.
2. El **código de máquina** se usa para generar tu clave: cópialo y envíalo a tu vendedor (con tu nombre y, si aplica, los años/días deseados).
3. El vendedor te entregará una **clave de licencia** y una **vigencia** (o licencia perpetua).
4. Pega la clave en el campo **"Clave de licencia"** y haz clic en **"Activar licencia"**.
5. Verás la confirmación "Versión Pro activada" junto con tu nombre y vigencia.

> ⚠️ Cada clave está ligada al **código de máquina** de un equipo concreto. Si cambias de equipo, solicita una nueva clave para la nueva máquina.
>
> La activación es inmediata y **no requiere internet**.

---

## 10. Cambiar contraseña

Puedes cambiar tu contraseña en cualquier momento desde la pantalla de **Configuración**.

1. Ve a **Configuración**.
2. En la sección **"Cambiar contraseña"**, escribe tu **contraseña actual**.
3. Escribe y confirma la **nueva contraseña** (mínimo 6 caracteres).
4. Haz clic en **"Cambiar contraseña"**.

> Al cambiar tu contraseña, la próxima vez que inicies sesión deberás usar la nueva.

---

## 11. Pregunta de seguridad (recuperación de contraseña)

Configura una pregunta de seguridad para poder recuperar tu contraseña si la olvidas. Esto es esencial: si no la configuras y olvidas tu contraseña, no hay forma de recuperarla (la app es 100% offline).

### Configurar tu pregunta (desde Configuración)
1. Ve a **Configuración → Pregunta de seguridad**.
2. Escribe una pregunta que solo tú puedas responder (ej: "¿Cuál es el nombre de mi primera mascota?").
3. Escribe la respuesta (se guardará de forma segura).
4. Haz clic en **"Guardar pregunta"**.

### Recuperar tu contraseña (desde el login)
1. En la pantalla de inicio de sesión, haz clic en **"¿Olvidaste tu contraseña?"**.
2. Ingresa tu usuario y haz clic en "Continuar".
3. Se mostrará tu pregunta de seguridad.
4. Ingresa la respuesta correcta y haz clic en "Validar respuesta".
5. Establece tu nueva contraseña (mínimo 6 caracteres).

> ⚠️ Si la respuesta es incorrecta, no se permite restablecer. Si no configuraste una pregunta de seguridad, deberás contactar al administrador del sistema.

---

## 12. Copias de seguridad (backup)

Las copias de seguridad te protegen contra la pérdida de datos. Se recomienda hacerlas **periódicamente** (por ejemplo, cada semana).

> 🛡️ Esta función está disponible en la **versión Pro** (ver [Licencia y activación](#9-licencia-y-activación)).

### Exportar una copia de seguridad
1. Ve a **Configuración**.
2. En la sección **"Backup y restauración"**, haz clic en **"Exportar copia de seguridad"**.
3. Escribe la ruta y nombre del archivo (por ejemplo, `C:\backups\inventario_2026-09.db`).
4. Escribe una **contraseña** para cifrar el backup (mínimo 8 caracteres).
5. Se confirmará que el backup se exportó correctamente.

> 🔐 Los backups se cifran con la **contraseña que tú eliges** y son **portables** a cualquier computadora (no están atados a la máquina). Guarda esa contraseña en un lugar seguro: **sin ella no podrás restaurar el backup**.

### Restaurar una copia de seguridad
1. Ve a **Configuración** → **Backup y restauración**.
2. Haz clic en **"Restaurar desde backup"**.
3. Escribe la ruta del archivo de backup a restaurar.
4. Escribe la contraseña del backup (déjala vacía si es un backup antiguo creado sin cifrar).
5. La app cargará los datos restaurados y guardará los datos actuales sobre ellos.

> ⚠️ Restaurar **sobrescribirá** los datos actuales con los del backup.

> ℹ️ Si escribes una contraseña incorrecta la restauración falla y tus datos actuales no se modifican. Los backups antiguos sin cifrar se siguen pudiendo restaurar.

---

## 13. Roles de usuario

La aplicación soporta tres roles con permisos granulares. Los permisos se aplican **tanto en la interfaz** (los botones/acciones se ocultan) **como en el backend** (las operaciones se verifican del lado del servidor), por lo que no se pueden evitar manipulando la interfaz.

| Capacidad | Admin | Operador | Visor |
|---|---|---|---|
| Ver dashboard y productos | ✅ | ✅ | ✅ |
| Ver reportes | ✅ | ✅ | ✅ |
| Crear/editar/eliminar productos | ✅ | ✅ | ❌ |
| Crear/editar categorías | ✅ | ✅ | ❌ |
| Registrar movimientos de stock | ✅ | ✅ | ❌ |
| Cambiar su propia contraseña / pregunta de seguridad | ✅ | ✅ | ✅ |
| Gestionar usuarios (crear/eliminar con roles) | ✅ | ❌ | ❌ |
| Datos de empresa y copias de seguridad | ✅ | ❌ | ❌ |

> **Nota:** el rol **Visor** es de solo lectura para el inventario: puede consultar productos, stock, movimientos y reportes, pero no modificar nada. El **Operador** gestiona el día a día (productos, categorías y movimientos) pero no puede tocar la configuración de la empresa ni administrar usuarios, que son exclusivos del **Admin**.
>
> Cualquier persona puede **registrarse** desde la pantalla de login, pero siempre con rol **operador** (sin privilegios administrativos).

---

## 14. Gestionar usuarios

Desde el menú **Usuarios** (visible solo para el rol **Admin**) puedes crear y eliminar cuentas de usuario y asignarles un rol.

### Crear un usuario
1. Ve a **Usuarios** en el menú lateral.
2. Haz clic en **+ Nuevo usuario**.
3. Completa el formulario: **Nombre completo**, **Email** (único), **Contraseña** (mínimo 6 caracteres) y el **Rol** (Admin, Operador o Visor).
4. Pulsa **Crear usuario**. El nuevo usuario ya puede iniciar sesión con esas credenciales.

### Roles disponibles al crear
- **Admin**: acceso total, incluida la gestión de usuarios, datos de empresa y copias de seguridad.
- **Operador**: gestiona productos, categorías y movimientos.
- **Visor**: solo lectura (productos, stock y reportes).

> Solo un **Admin** puede crear cuentas y solo él puede asignar el rol **Admin**. Ningún otro rol puede acceder a esta pantalla.

### Eliminar un usuario
1. En la tabla de **Usuarios**, localiza al usuario y pulsa **Eliminar** en su fila.
2. Confirma la operación.
3. El usuario se elimina de inmediato y ya no podrá iniciar sesión.

> No puedes eliminar tu propia cuenta ni a otro **Admin**. Al menos siempre queda un administrador.

---

## 15. Auditoría

La pestaña **Auditoría** (visible solo para **administradores**) registra quién hizo qué y cuándo. Cada evento guarda la fecha/hora, el usuario, la acción y un detalle.

Se registran, entre otros:

- **Inicios de sesión** (exitosos y fallidos) y creación/eliminación de usuarios.
- Cambios de **contraseña** y de **pregunta de seguridad**.
- **Creación, edición y eliminación** de productos, categorías y almacenes.
- **Movimientos de inventario** (entradas, salidas, ajustes y transferencias, con cantidades y lotes).
- **Importaciones** de productos (creados/omitidos) y **exportaciones/respaldos**.
- Cambios de **configuración**: umbral de vencimiento, datos de empresa, feed de actualizaciones y **activación de la licencia**.

Cómo usarla:

- Usa los filtros de **Acción**, **Entidad** y rango de **fechas** (se aplican al instante).
- El botón **"Refrescar"** vuelve a leer los eventos más recientes.
- El registro vive en la misma base de datos: al restaurar una copia de seguridad se restaura junto con los datos.

---

## 16. Actualizaciones de la aplicación

WarehOS puede actualizarse automáticamente a una versión más reciente cuando el proveedor publica una nueva (nuevas funciones, mejoras o correcciones). La actualización se controla desde **Configuración → Actualizaciones**.

### Comprobar si hay una versión nueva

1. Ve a **Configuración → Actualizaciones**.
2. Pulsa **"Buscar actualizaciones"** (los administradores).
3. Si hay una versión nueva, se descargará automáticamente y verás el progreso.
4. Cuando termine la descarga, pulsa **"Reiniciar e instalar"**. La aplicación se reinicia con la versión nueva instalada.

> Solo un **Admin** puede buscar e instalar actualizaciones y modificar la configuración de actualizaciones.

### Configuración (administradores)

- **URL de un servidor propio de actualizaciones (opcional, avanzado):** dirección de un servidor (hosting) que el proveedor pueda tener. Normalmente **no hay que tocar nada**: por defecto la app usa **GitHub Releases**, donde el proveedor publica las versiones. Déjala vacía para usar ese valor predeterminado.
- **Buscar actualizaciones automáticamente al iniciar:** si está marcada, la app comprueba actualizaciones cada vez que se abre (sin interrumpir el trabajo: si hay una versión, se descarga en segundo plano).

### Notas

- La actualización ocurre **100% dentro de tu equipo**: se descarga de un servidor que el proveedor te indique, no se sube ningún dato de tu inventario.
- Las descargas se validan por integridad (resumen SHA-512) antes de instalarse.
- Si no ves la sección "Actualizaciones" disponible, es porque la aplicación se está ejecutando en modo desarrollo (solo afecta a los instaladores distribuidos).
- La comprobación automática al iniciar está desactivada de fábrica para no consumir datos en redes sin internet; actívala si quieres.

---

## 17. Preguntas frecuentes

**¿La app necesita internet?**
No. Funciona 100% offline. Todos los datos se guardan en tu computadora.

**¿Mis datos se suben a la nube?**
No. Tu inventario es privado y se almacena localmente.

**¿Puedo usar cualquier unidad de medida?**
Sí. La app incluye unidades comunes (uds, kg, g, litros, ml, metros, cajas, pzas, rollos, sacos, etc.). El stock siempre respeta la unidad del producto.

**¿Qué pasa si un producto llega a su stock mínimo?**
Aparecerá en la lista de "Productos con stock bajo" del Dashboard, en color rojo.

**¿Puedo eliminar un producto que ya tiene movimientos?**
No. Para proteger el historial, solo puedes eliminar productos sin movimientos.

**¿Cómo inicio sesión la primera vez?**
Usa `admin` / `admin123`, o regístrate con un nuevo usuario.

**¿Cómo cambio mi contraseña?**
Ve a **Configuración → Cambiar contraseña** y sigue los pasos de la sección [10](#10-cambiar-contraseña).

**¿Qué hago si olvido mi contraseña?**
En la pantalla de login, haz clic en **"¿Olvidaste tu contraseña?"** y sigue los pasos de la sección [11](#11-pregunta-de-seguridad-recuperación-de-contraseña). Si no configuraste una pregunta de seguridad, contacta al administrador.

**¿Cómo activo la versión Pro?**
Ve a **Configuración → Licencia** y sigue los pasos de la sección [9](#9-licencia-y-activación).

**¿Puedo reiniciar el periodo de prueba cambiando la fecha del equipo?**
No. El periodo de prueba está protegido: la aplicación registra la hora máxima del sistema y nunca cuenta hacia atrás, y guarda ese registro en dos lugares independientes. Cambiar el reloj no reinicia (ni alarga) la prueba; en todo caso adelantar demasiado la fecha **agota** los días más rápido. Si la app detecta manipulación del reloj, lo mostrará en **Configuración → Licencia**.

**¿Dónde se guardan mis datos?**
En `C:\Users\<tu_usuario>\AppData\Roaming\warehos\inventario.db`.

---

*Fin del manual. Para más detalles técnicos, consulta `docs/INSTALACION.md` y `docs/TECNICO.md`.*
