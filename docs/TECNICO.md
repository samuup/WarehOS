# Documentación Técnica — WarehOS

Documentación dirigida a desarrolladores y mantenedores del proyecto. Describe la arquitectura, el stack, el modelo de datos, los comandos y las decisiones de diseño.

---

## 1. Resumen técnico

| Aspecto | Detalle |
|---|---|
| **Tipo de app** | Aplicación de escritorio multiplataforma |
| **Framework escritorio** | Electron 31 |
| **Frontend** | React 18 + TypeScript + Tailwind CSS |
| **Build** | Vite 5 (renderer) + tsc (main process) |
| **Base de datos** | SQLite vía **sql.js** (WASM, sin compilación nativa) |
| **State management** | Zustand |
| **Enrutamiento** | React Router (HashRouter) |
| **Reportes PDF** | jsPDF + jspdf-autotable |
| **Empaquetado** | electron-builder (NSIS para Windows) |
| **Testing** | Vitest |
| **Linting/Formato** | ESLint + Prettier |

---

## 2. Estructura del proyecto

```
warehos/
├── package.json              # Scripts, dependencias, config de build
├── vite.config.ts            # Config de Vite (renderer)
├── vitest.config.ts          # Config de tests
├── tsconfig.json             # TypeScript (renderer + shared)
├── tsconfig.electron.json    # TypeScript (main process → dist-electron)
├── tailwind.config.js
├── SPEC.md                   # Especificación inicial
├── docs/                     # Documentación (instalación, manual, técnica)
├── tasks/                    # Plan e implementación
├── src/
│   ├── main/                 # Proceso principal de Electron
│   │   ├── index.ts          # Entry point, creación de ventana
│   │   ├── database.ts       # Conexión SQLite (sql.js), migraciones, helpers
│   │   ├── ipc-handlers.ts   # Handlers de IPC (toda la lógica de negocio)
│   │   └── preload.ts        # Bridge seguro expuesto al renderer
│   ├── renderer/             # Aplicación React
│   │   ├── App.tsx           # Rutas y protección
│   │   ├── pages/            # Login, Dashboard, Productos, Inventario, Reportes, Configuración
│   │   ├── components/       # Layout, Sidebar, DataTable, Modal, etc.
│   │   ├── store/            # Stores Zustand (auth, products, inventory, settings)
│   │   └── lib/              # api (bridge), formatters
│   ├── shared/               # Código compartido main↔renderer
│   │   ├── types.ts          # Interfaces de datos (User, Product, Movement...)
│   │   └── stockLogic.ts     # Lógica pura de cálculo de stock (testeable)
│   │   └── lotLogic.ts       # Lógica pura de lotes/FEFO (testeable)
│   │   └── chartLogic.ts     # Lógica pura de series para gráficos (testeable)
│   └── test/
│       └── unit/             # Tests unitarios (Vitest)
```

---

## 3. Arquitectura de comunicación (IPC)

El diseño sigue buenas prácticas de seguridad en Electron:

1. **Context isolation** habilitado y `nodeIntegration` desactivado.
2. El renderer **nunca** accede a la base de datos ni a Node directamente.
3. El **preload** (`src/main/preload.ts`) expone un objeto `window.api` tipado mediante `contextBridge`.
4. El renderer se comunica con el main process vía `ipcRenderer.invoke(channel, ...)`.
5. El main process maneja cada canal en `ipc-handlers.ts`.

```
Renderer                        Main Process
   │  window.api.products.list()  │
   ├──────────────────────────────►  ipcMain.handle('products:list')
   │  ApiResult<Product[]>        │
   ◄──────────────────────────────┤  → consulta sql.js
```

Los canales se agrupan por dominio: `auth:*` (login, **me**, register, changePassword, setSecurityQuestion, getSecurityQuestion, resetPassword), `categories:*`, `products:*` (incluido `products:import` para importación masiva desde Excel/CSV mediante `dialog.showOpenDialog` + `xlsx`, `products:getByBarcode` para búsqueda exacta por código de barras y búsqueda por `barcode` en `products:list`), `movements:*`, `lots:*` (`lots:list`, `lots:expiring`), `dashboard:*`, `reports:*`, `company:*`, `settings:*` (umbral de vencimiento y preferencias de notificación en `app_state`), `backup:*` (`backup:export`/`backup:import` con firma `(path, password, userId)`; el backup se cifra con la contraseña aportada y la restauración re-aplica migraciones), `warehouses:*`, `license:*` (getStatus, activate), `audit:*` (`audit:list` para consultar el log, gated por `audit.view`), `notifications:*` (`notifications:test` y `notifications:check`, gated por `settings.manage`, llaman al módulo `src/main/notifications.ts`).

**Manejo uniforme de errores:** todos los handlers se registran con `safeHandle(channel, fn)` (definido en `src/main/ipc-handlers.ts`), que captura excepciones, las registra con `logError` y devuelve `{ success:false, error }` normalizado con `getErrorMessage(err)` — el renderer nunca recibe una promesa rechazada por un handler roto.

**Logs en disco:** `src/main/logger.ts` escribe a `userData/logs/app.log` (rotación simple: superado `MAX_LOG_BYTES` se renombra a `.old`). `initGlobalErrorLogging()` en `src/main/index.ts` conecta `uncaughtException` (loguea y cierra la app) y `unhandledRejection` (loguea) del proceso principal, para que errores crasheantes dejen evidencia útil en el soporte.

---

## 4. Persistencia de datos (sql.js)

Se eligió **sql.js** (SQLite compilado a WebAssembly) en lugar de `better-sqlite3` porque **no requiere compilar binsarios nativos en C++** (ni Visual Studio Build Tools), lo que facilita la instalación en cualquier máquina.

### Cómo funciona
- La base de datos vive **en memoria** (`SQL.Database`).
- Tras cada escritura, se llama a `persist()` que exporta la BD a bytes (`db.export()`) y los escribe al archivo en disco. El archivo actual se escribe primero a `<db>.tmp` y luego se hace `rename` (escritura **atómica**: un corte de luz a mitad de la escritura no deja el `.db` corrupto).
- Las escrituras que implican varios pasos se envuelven en `transaction()` para garantizar atomicidad.
- **Instancia única**: `src/main/index.ts` usa `app.requestSingleInstanceLock()`; si ya hay otra instancia de la app con los mismos datos de usuario, la segunda se cierra y se enfoca la ventana ya abierta (evita que dos procesos corrompan el archivo). Nota para el E2E: el lock depende de `userData`, y cada spec usa un directorio temporal propio, por lo que no interfiere con Playwright.

### Archivo de datos
```
C:\Users\<usuario>\AppData\Roaming\warehos\inventario.db
```
La ruta se obtiene con `app.getPath('userData')` de Electron.

### Módulo `src/main/database.ts`
Expone los helpers de acceso:

| Función | Descripción |
|---|---|
| `initDatabase()` | Carga sql.js, abre/crea la BD, aplica migraciones |
| `persist(handle?)` | Escribe el estado en memoria al disco de forma atómica (tmp + rename); acepta un handle opcional (p. ej. al restaurar) |
| `all<T>(sql, params)` | Consulta y devuelve array de filas |
| `get<T>(sql, params)` | Consulta y devuelve una fila |
| `run(sql, params)` | Ejecuta INSERT/UPDATE, devuelve `lastInsertRowid` y cambios. Usa `SELECT last_insert_rowid()` sobre el mismo handle (sql.js `db.run()` no expone el rowid; envolverlo con `Number(...)` producía `NaN` y rompía inserciones con FK) |
| `transaction(fn)` | Envuelve varias ops en una transacción |
| `seedDefaultAdmin()` | Crea el administrador por defecto si no existe |
| `saveBackupFile / reloadFromFile` | Backup cifrado con contraseña / restauración |
| `lastInsertRowid(handle)` | Helper puro (testeado con sql.js real) que lee el último rowid insertado |

> **Derivar el rowid de inserciones:** `db.run(sql, params)` de sql.js devuelve un objeto interno, **no** el `lastInsertRowid`. El helper `run()` lo obtiene con `SELECT last_insert_rowid()` sobre el mismo handle; sin esto, cualquier flujo que inserte un producto/categoría/movimiento y luego enlace filas por FK (p. ej. `products:create` → `product_warehouse_stock`) fallaba con `NOT NULL constraint failed`. Cubierto por `src/test/unit/database.test.ts`.

> **Nota sobre el WASM:** `initDatabase` localiza `sql-wasm.wasm` con `require.resolve('sql.js')`, lo que obliga a que `sql.js` esté incluido como dependencia de producción en el empaquetado (electron-builder lo incluye automáticamente).

> **Backups cifrados con contraseña (portables):** `saveBackupFile` exporta la BD descifrada en memoria pero la **cifra** con una contraseña elegida por el usuario (`crypto.scryptSync` + AES-256-GCM, formato con cabecera `WHBAK01` + sal + nonce + tag, ver `src/main/dbEncryption.ts`). Al estar derivada de la contraseña, el backup **no está atado a la máquina** (a diferencia del cifrado en reposo del `.db`, que usa `safeStorage`). La contraseña se valida en `shared/validation.ts` (`isValidBackupPassword`, mínimo 8) y en `validation.test.ts`.

> **Restauración con migraciones:** `reloadFromFile(source, password?)` detecta la cabecera `WHBAK01` (y descifra con la contraseña, o deja pasar los **backups antiguos en texto plano**), carga la BD en un handle temporal y **re-aplica el pipeline de migraciones** (`applyMigrations` + `finalizeUserUsernames`) — igual que una instalación nueva —, re-habilitando `PRAGMA foreign_keys = ON`. Luego intercambia el handle y persiste re-cifrado. Restaurar un backup de una versión anterior ya no rompe el esquema ni desactiva las FK en ese arranque.

---

## 5. Modelo de datos

| Tabla | Descripción |
|---|---|
| `users` | Usuarios (name, username, password_hash, role, security_question, security_answer_hash); `username` es único (`idx_users_username`) |
| `categories` | Categorías de productos |
| `products` | Productos (sku, **barcode**, categoría, unidad, stock, precios, **track_lots**). `barcode` tiene un **índice único parcial** (`idx_products_barcode`) que ignora NULL/vacíos |
| `warehouses` | Almacenes/sucursales; el `is_default` marca el **almacén principal** (no eliminable) |
| `product_warehouse_stock` | Stock por producto y almacén (PK compuesta `(product_id, warehouse_id)`) |
| `lots` | Stock por lote y almacén: PK compuesta `(product_id, warehouse_id, batch)`, `quantity` CHECK ≥ 0 y `expiry_date` opcional (CASCADE hacia productos/almacenes) |
| `stock_movements` | Historial de movimientos (IN/OUT/ADJUSTMENT/**TRANSFER**) con stock anterior/resultante y almacenes origen/destino |
| `audit_log` | Log de auditoría (user_id, user_name, action, entity, entity_id, detail, created_at) con índice por `created_at` |
| `companies` | Datos de la empresa (una sola fila, id=1) |
| `schema_migrations` | Registro de versiones de migración aplicadas |

`products.current_stock` es el **agregado global** (suma del stock de todos los almacenes), mantenido automáticamente por cada movimiento; el stock desglosado vive siempre en `product_warehouse_stock`.

### Migraciones
Las migraciones son un array de sentencias SQL en `database.ts`. Al arrancar, la app:
1. Crea la tabla `schema_migrations` si no existe.
2. Lee las versiones ya aplicadas.
3. Aplica las que falten y las registra.

Para **agregar una migración**: añade la sentencia SQL al final del array `MIGRATIONS` en `database.ts`. La app la aplicará automáticamente en el próximo arranque.

---

## 6. Lógica de negocio: cálculo de stock

La lógica de actualización de stock está aislada en `src/shared/stockLogic.ts` como función pura:

```ts
calculateNewStock(type, quantity, currentStock) → { newStock, error? }
```

Reglas:
- **IN**: `currentStock + quantity` (quantity > 0).
- **OUT**: `currentStock - quantity`, rechaza si `quantity > currentStock`.
- **ADJUSTMENT**: fija el stock al valor dado (puede ser 0); rechaza negativos.
- **TRANSFER**: resta al almacén de origen con las mismas reglas que OUT (rechaza stock insuficiente); el destino se incrementa en el `movements:create`.

El cálculo actúa **sobre el stock del almacén** que interviene en el movimiento (no sobre el agregado global): `movements:create` lee el stock de `product_warehouse_stock` para el almacén indicado, y tras actualizarlo recalcula `products.current_stock` como la suma de todos los almacenes (`refreshGlobalStock`).

Esta separación permite testear la lógica sin depender de Electron (ver tests).

---

## 6.1 Escaneo con lector de códigos de barras (USB)

La app soporta **lectores USB tipo teclado** (*keyboard-wedge*): cuando el usuario dispara el lector, este escribe el código en el campo enfocado y presiona `Enter`. No requiere drivers, librerías externas ni permisos.

- **Detección global** — `src/renderer/lib/useBarcodeScanner.ts` es un hook que escucha `keydown` en `window` y captura el código cuando **no** hay un campo de texto enfocado (se ignora si el evento viene de un `input`/`textarea`/`select`, para no interferir con la escritura manual). Detecta escritura rápida (gap entre teclas ≤ 60 ms) y termina en `Enter` con longitud mínima 3.
- **Campo dedicado** — `src/renderer/components/ScanInput.tsx` es un input con icono de código de barras que invoca `onScan` al presionar `Enter` e incluye un *flash* visual verde de confirmación. Al recibir el foco (ej. autofocus en el modal), el lector escribe directamente en él y el hook global lo ignora (evita doble disparo).
- **Búsqueda en productos** — en `Products.tsx` un escaneo rellena la barra de búsqueda (la lista filtra por nombre, SKU o `barcode`).
- **Movimientos** — en `Inventory.tsx`, el modal de movimiento abre un campo `ScanInput` (autofocus). Al escanear se busca con `products:getByBarcode` (búsqueda exacta, normaliza mayúsculas), se selecciona el producto y el foco pasa a la cantidad. Si se dispara el lector fuera del modal, este se abre con el producto cargado. Tras registrar un movimiento *escaneado*, la ventana permanece abierta y el cursor vuelve al campo de código para registrar el siguiente ítem (flujo continuo); si el producto se eligió manualmente, el modal se cierra como antes.
- **API** — `products:getByBarcode(code)` devuelve el producto (o error) por coincidencia exacta.

---

## 6.2 Impresión de etiquetas de código de barras

La generación de etiquetas vive en `src/renderer/lib/labelRenderer.ts` y el modal en `src/renderer/components/BarcodeLabelModal.tsx` (botón **"Etiqueta"** en `Products.tsx`).

- **Librería** — **jsbarcode** (nueva dependencia de producción) renderiza el código en `<canvas>`/SVG; el PDF se arma con **jsPDF** (ya disponible), en mm y hoja A4.
- **Simbiología automática** — `selectFormat(value)` elige **EAN-13** (13 dígitos), **UPC-A** (12 dígitos) o **Code128** (cualquier texto); ante códigos con checksum inválido se hace fallback a Code128 (try/catch).
- **Tamaños** — presets 50×30, 60×40 y 80×50 mm (`LABEL_SIZES`). Se rellenan en grilla sobre A4 (margen 8 mm) las copias solicitadas.
- **Flujo** — `buildLabelsPdf(fields, sizeKey, copies)` genera el PDF y `doc.autoPrint()` muestra el diálogo de impresión al abrirlo; `doc.save()` descarga el archivo (mismo mecanismo que los reportes).
- **Contenido de la etiqueta** — nombre, línea secundaria (SKU · stock · precio) y el código de barras con su número legible.
- **Nuevas dependencias:** `jsbarcode` + `@types/jsbarcode`.

---

## 6.3 Licenciamiento y activación

La app funciona **100% offline** con un esquema de licenciamiento firmado: el vendedor genera claves con una **clave privada RSA** y la app solo embebe la **clave pública**, verificando la firma localmente.

- **Estados de licencia** — `LicenseStatus` (`src/shared/types.ts`): `pro` (licencia válida activada), `trial` (prueba inicial de 30 días) y `trial_expired` (prueba vencida → modo solo lectura).
- **Módulo** — `src/main/license.ts`:
  - `getMachineHash()`: huella de la máquina = SHA-256 de `hostname|platform|release|MAC` (repelente a duplicación de clave entre equipos).
  - `verifyLicenseKey()`: parsea `payload(sigB64)`, verifica firma **RSA-SHA256** con la clave pública embebida, valida que el `machine` coincida con la huella y que `expiresAt` no haya pasado.
  - `getLicenseStatus()`: consolida el estado del trial y calcula días restantes con la lógica pura `computeTrialStatus` (`src/shared/trialLogic.ts`, testeada).
  - `activateLicense()`: guarda la clave con `INSERT ... ON CONFLICT DO UPDATE`.
- **Hardening del trial** — manipular el reloj no extiende la prueba:
  - **Marca de agua de tiempo** (`max_clock`): el tiempo "efectivo" del trial es `max(reloj, max_clock_observado)` y **nunca retrocede**. Aunque el reloj se atrase, el conteo sigue avanzando de forma monótona; adelantar la fecha y volver atrás **quema el trial** irreversiblemente (la marca queda sobre la línea de vencimiento).
  - **Almacenamiento dual + checksum**: el estado del trial se guarda en la BD (`app_state`: `first_run`, `max_clock`, `trial_tampered`) **y** en un archivo espejo `userData/trial.json` con checksum SHA-256. Al leer se **fusionan** (queda el `first_run` más antiguo y el `max_clock` más alto) y se reparan ambas fuentes. Borrar o editar una sola copia **no** reinicia el trial; para "reiniciarlo" habría que borrarlo todo y perder el catálogo.
  - **Detección de retroceso** (umbral 48 h, tolerante a DST y a batería CMOS): si `reloj < max_clock - 48 h` se marca `tampered` y se muestra un aviso en Configuración (no bloquea, pero el usuario queda identificado).
  - El watermark se refresca al arrancar (`refreshTrialWatermark()` en `src/main/index.ts`) y en cada consulta de estado.
- **Formato de clave** — `base64(payloadJson).base64(firma)` con payload `{ machine, edition, customer, issuedAt, expiresAt }` (`expiresAt: null` = perpetua).
- **Generar claves y licencias** — comando de desarrollo:
  ```bash
  node scripts/generate-license.js <machineHash> <cliente> [dias]   # sin [dias] = perpetua
  ```
  Requiere `keys/license-private-key.pem` (generado con RSA 2048 PKCS#1). **La clave privada NO debe distribuirse ni empaquetarse** (está gitignoreada); solo la pública vive en el código (`PUBLIC_KEY_PEM`).
- **Enforcement** — en `src/main/ipc-handlers.ts`:
  - `requireLicenseActive()`: bloquea mutaciones (productos, categorías, movimientos, empresa, eliminar usuarios) cuando el trial está vencido.
  - `requirePro()`: bloquea **importación masiva** (`products:import`) y **backup export/import** (el backup pide contraseña de mínimo 8 caracteres, validada también en el backend).
  - En el renderer, el gating Pro cubre además exportaciones PDF/CSV (Reportes e Inventario) y **etiquetas** (todo ejecutado del lado del renderer con jsPDF/jsbarcode).
- **UI** — tarjeta **Licencia** en `Configuración` (estado, código de máquina con botón "Copiar", campo de activación para admin), badge de estado en el `Sidebar`, banner de trial/trial vencido en `Layout` (`src/renderer/store/licenseStore.ts` expone `isPro`/`isTrial`/`isExpired`).
- **Datos** — nueva tabla `app_state (key TEXT PRIMARY KEY, value TEXT)` vía migración automática.

---

## 6.4 Múltiples almacenes / sucursales

La app modela **almacenes** (sucursales/ubicaciones) con stock desglosado por producto y almacén, manteniendo a la vez una vista global.

### Modelo

- **`warehouses`** — nombre, dirección y `is_default` (el **Almacén Principal** se siembra automáticamente en la migración; no se puede eliminar y siempre hay al menos uno).
- **`product_warehouse_stock`** — fila por `(product_id, warehouse_id)` con el stock de ese producto en ese almacén.
- **`stock_movements`** — se reconstruye en una migración (table rebuild) para ampliar el `CHECK` de tipos a **TRANSFER** y añadir `warehouse_id` (origen o almacén único) y `destination_warehouse_id` (solo transferencias). Los movimientos históricos se conservan con almacén `NULL`.
- **Backfill** — en la migración, el stock actual de cada producto se copia al almacén principal (`INSERT OR IGNORE ... SELECT p.id, w.id, p.current_stock`).
- **`products.current_stock`** — agregado global = suma de `product_warehouse_stock`, mantenido en cada movimiento. Dashboard y reportes siguen usando esta vista.

### Movimientos por almacén

`movements:create` (`src/main/ipc-handlers.ts`) recibe `warehouse_id` (y `destination_warehouse_id` si `type === 'TRANSFER'`):

- **IN / OUT / ADJUSTMENT** — aplicados al almacén indicado (o al principal si no se envía); se upserta el stock en `product_warehouse_stock` y se recalcula el agregado.
- **TRANSFER** — un solo movimiento con origen `warehouse_id` y destino `destination_warehouse_id` (distintos, con stock suficiente en origen). Resta al origen, suma al destino y el agregado global no cambia. El `new_stock` registrado corresponde al almacén de origen.

### API / permisos

| Handler | Descripción | Permiso |
|---|---|---|
| `warehouses:list` | Lista almacenes (principal primero) | autenticado |
| `warehouses:create/update` | Crear/editar almacén | `settings.manage` |
| `warehouses:delete` | Eliminar (no el principal; bloquea si tiene stock o movimientos) | `settings.manage` |
| `movements:create` | Registra con almacén y soporta TRANSFER | `inventory.manage` |
| `movements:list` | Filtro `warehouse_id` (origen **o** destino) y nombres de almacén en la respuesta | autenticado |
| `products:list` | `warehouse_id` opcional (muestra stock de ese almacén) y mapa `stocks` `{warehouseId: stock}` | autenticado |

### UI

- **Almacenes** (`/warehouses`, sidebar visible solo con `settings.manage`): tabla CRUD con badge "Principal" y protección del almacén principal.
- **Inventario** — el modal de movimiento pide almacén (o **origen + destino** en transferencia), muestra el stock del producto en el almacén seleccionado (mapa `stocks`), el historial añade la columna "Almacén" (`origen → destino` para transferencias) y hay filtro por almacén. Exportaciones PDF/CSV incluyen almacén y totales de transferencias.
- **Productos** — filtro por almacén; la columna Stock muestra el agregado global (o el del almacén filtrado) con un desglose `Almacén: stock` cuando hay más de un almacén con stock.

La creación e importación de productos siembran el stock inicial (0 o `stock_inicial`) en el almacén principal.

---

## 6.5 Control de lotes y fechas de vencimiento

El control de lotes es **activable por producto** (columna `products.track_lots`), se desactiva por defecto y es independiente de los almacenes.

### Modelo

- **`products.track_lots`** — entero 0/1 que activa el control por lotes para ese producto.
- **`lots`** — stock desglosado por `(product_id, warehouse_id, batch)` con `quantity` (CHECK ≥ 0), `expiry_date` (formato `YYYY-MM-DD`, opcional, NULL = sin fecha) y FK con `ON DELETE CASCADE` hacia productos y almacenes. Las filas con cantidad 0 se eliminan.
- **`products.min_expiry`** no existe como columna: en los resultados (`toProduct`) se calcula el **mínimo de fechas de vencimiento** de los lotes del producto (los que tienen fecha) para mostrarlo en la lista de productos.

### Lógica pura (`src/shared/lotLogic.ts`)

| Función | Descripción |
|---|---|
| `sortFefo` | Ordena lotes por vencimiento ascendente (los que vencen primero), sin fecha siempre al final |
| `fefoAllocate` | Dada una cantidad y los lotes de un almacén, devuelve las asignaciones por lote en orden FEFO o error si el total es insuficiente |
| `redistributeLots` | Reasigna un nuevo total entre los lotes preservando los que vencen primero: reduce desde el que vence más tarde, suma el excedente al que vence más tarde y descarta vacíos |
| `lotListTotal` | Suma las cantidades de los lotes |

### Movimientos con lotes (`movements:create`)

- **IN** — para productos con `track_lots` es **obligatorio** el número de lote (`batch`, se recorta con trim); `expiry_date` es opcional pero si se envía debe cumplir `YYYY-MM-DD`. El stock del almacén y el de los lotes se incrementan juntos en la misma transacción.
- **OUT** — descuenta del lote que vence primero (FEFO) dentro del almacén. Valida el stock por almacén y además el total de lotes antes de asignar.
- **ADJUSTMENT** — reasigna el nuevo total sobre los lotes existentes (`redistributeLots`). Si no hay lotes y el nuevo total es mayor que 0 → error: *"No hay lotes para reasignar. Usa una entrada con lote para agregar stock."*
- **TRANSFER** — asigna por FEFO desde el origen y crea/incrementa el **mismo lote** en el destino (un solo movimiento; se conserva `batch` y `expiry_date`).

`stock_movements` **no** almacena `lot_id`: el desglose por lotes vive en la tabla `lots` y el historial de movimientos sigue siendo la vista agregada por movimiento.

> Los movimientos históricos previos a esta función mantienen integridad porque los lotes solo se crean con entradas posteriores y los OUT/ADJUSTMENT operan sobre los lotes existentes.

### Activación / desactivación en productos

- `products:update` — si se **activa** `track_lots` en un producto con stock, se hace backfill: por cada almacén con stock se crea un lote `'Inicial'` (sin fecha de vencimiento) con la cantidad actual. Si se **desactiva**, se borran todos los lotes del producto (los check de integridad garantizan stock 0 al no existir otro desglose).
- `products:create` — permite crear productos ya con `track_lots` (comienzan sin lotes, con stock 0).
- `products:delete` — elimina también sus lotes (CASCADE).

### Alertas de expiración

- Configuración persistida en `app_state` bajo la clave `expiry_threshold_days` (**default 30**, entero 1–365), gestionada por `settings:get` / `settings:update` (requiere `settings.manage`).
- `lots:list(productId)` — desglose de un producto ordenado por vencimiento (sin fecha al final).
- `lots:expiring()` — lotes con estado **`expired`** (vencimientos pasados) o **`near`** (dentro del umbral), junto a `days_left`.
- `dashboard:summary` — incluye `expiring_lots` para la tarjeta "Lotes por vencer".

### UI

- **Productos** — columna "Lotes / Vencimiento": para productos con `track_lots` muestra el próximo vencimiento y un botón **"Ver lotes"** que abre el modal de desglose (lote, vencimiento, almacén, cantidad y estado).
- **Producto (alta/edición)** — checkbox "Control por lotes y fechas de vencimiento" con avisos explicativos al activar/desactivar sobre el stock existente.
- **Inventario** — en una entrada (IN) de un producto con lotes se piden **número de lote** (obligatorio) y **fecha de vencimiento** (opcional); en OUT/TRANSFER/ADJUSTMENT se muestran avisos FEFO.
- **Dashboard** — tarjeta "Lotes por vencer" (vencidos en rojo, próximos en ámbar). El umbral se edita en **Configuración → Alertas de vencimiento** (solo administradores).

**Limitación conocida:** los números de serie (`serial_numbers`) quedan **pendientes para una tarea futura**; el control de lotes actual no los contempla.

---

## 6.6 Gráficos del dashboard

El Dashboard renderiza gráficos con **Recharts** (dependencia ya presente), alimentados por `dashboard:summary` (sin handlers adicionales):

| Serie | Gráfico | Cómo se calcula |
|---|---|---|
| `stock_trend` (`StockTrendPoint[]`) | Área "Tendencia de stock (30 días)" | `computeStockTrend` en `src/shared/chartLogic.ts` (función pura, testeada): rehace la historia de movimientos en orden cronológico manteniendo un bucket de stock por almacén (origen `new_stock`; en TRANSFER el destino suma `quantity`; movimientos legacy sin almacén se tratan como bucket global) y produce un punto por día para los últimos 30 días. |
| `top_moved` (`TopMovedProduct[]`) | Barras horizontales "Top productos (salidas · 30 días)" | `SUM(quantity)` de `stock_movements` tipo **OUT** de los últimos 30 días, agrupado por producto, top 6. |
| `stock_by_category` (`StockByCategory[]`) | Dona "Distribución de stock por categoría" | `SUM(current_stock)` agrupado por `category_id` (LEFT JOIN a `categories`, "Sin categoría" cuando es NULL), solo categorías con stock > 0. |

Detalles:
- `dashboard:summary` se llama al montar el Dashboard; `stock_trend` re-fábrica la serie completa y se recorta a los últimos `days = 30` días (los días sin movimiento mantienen el último total conocido).
- Paleta de colores fija (`CATEGORY_COLORS`) para la dona; el gráfico de área usa un gradiente de primaria y las barras `#10b981`.
- `labelDate` (en `chartLogic.ts`) formatea las etiquetas `YYYY-MM-DD` a formato corto `es-PE`.

---

## 6.7 Log de auditoría

La tarea 10 introduce trazabilidad de **quién hizo qué y cuándo** mediante la tabla `audit_log` (migración 24, sin reconstrucción de datos).

### Modelo

| Columna | Descripción |
|---|---|
| `user_id` | Usuario que ejecutó la acción (`0` en eventos sin sesión, p. ej. login fallido) |
| `user_name` | Nombre capturado en el momento del evento |
| `action` | Acción en kebab-case: `login`, `register`, `delete_user`, `change_password`, `set_security_question`, `reset_password`, `create`, `update`, `delete`, `import`, `export`, `activate` |
| `entity` | Entidad afectada (`user`, `category`, `product`, `warehouse`, `movement`, `settings`, `company`, `license`, `backup`) |
| `entity_id` | Id de la entidad (permite `delete_user` con id del usuario borrado, etc.) |
| `detail` | Texto legible: nombres previos en borrados, cantidades en movimientos, "Creados: X, omitidos: Y" en importaciones |

### Escritura

- Helper `logAudit(userId, action, entity, entityId?, detail?)` en `src/main/ipc-handlers.ts`: hace `INSERT` y llama a `persist()`. Se invoca **fuera** del `transaction()` de la operación para que solo refleje acciones ya confirmadas.
- Se auditan acciones **exitosas** únicamente (los retornos tempranos por permiso/licencia no registran evento). En borrados se captura el nombre previo antes del `DELETE`.
- Ejemplos: `product:delete` registra la entidad y el nombre previo; `movements:create` guarda origen/destino y cantidades; `products:import` guarda "Creados: X, omitidos: Y"; `settings:update` y `company:update` guardan el valor nuevo del umbral/empresa.

### Lectura

- Handler `audit:list(callerUserId, query)` gated por la capacidad **`audit.view`** (solo `admin`). Filtros opcionales: `action`, `entity`, `from`/`to` (fechas `YYYY-MM-DD`), `user_id`; `LIMIT` por defecto 500 y orden `created_at DESC`.
- La pestaña **Auditoría** (`src/renderer/pages/Audit.tsx`) consume `api.audit.list` con `DataTable`, filtros de acción/entidad/fechas y etiquetas legibles (`ACTION_LABELS`/`ENTITY_LABELS`). El nav item aparece solo con `can(role, 'audit.view')`.
- `DataTable` (`src/renderer/components/DataTable.tsx`) paginan en el cliente (`pageSize` configurable, por defecto **20**): Auditoría, Products, Reports y Users. El índice de página se resetea al cambiar datos/búsqueda; muestra "X registros" y "Página X de Y" con Anterior/Siguiente.

---

## 6.8 Notificaciones del sistema

La tarea 13 añade alertas de **stock bajo** y, posteriormente, de **lotes por vencer**, mediante notificaciones nativas del sistema operativo (Electron `Notification`).

### Detección (lógica pura)

`src/shared/lowStockLogic.ts` aísla la lógica testeable:

| Función | Descripción |
|---|---|
| `findLowStock(products)` | Devuelve los productos cuyo `current_stock <= stock_min` con `stock_min > 0`, ordenados por gravedad (proporción `current_stock/stock_min` ascendente) |
| `buildLowStockMessage(low)` | Texto de la notificación: resume los 3 primeros productos (`"Nombre: actual/mínimo"`) y un resumen `"y N más..."` |

`src/shared/expiryLogic.ts` hace lo propio para vencimientos:

| Función | Descripción |
|---|---|
| `buildExpiryMessage(expiring)` | Texto de la notificación de vencimiento: resume los 3 primeros lotes (`"Nombre (lote): Nd"` o `"Nombre (lote): vencido"`) y un resumen `"y N más..."` |

### Ciclo de revisión

`src/main/notifications.ts`:

- `getNotifySettings()` lee de `app_state` las claves `notify_low_stock` (`'1'`/`'0'`), `notify_expiry` (`'1'`/`'0'`) y `notify_interval_min` (minutos, 5–1440).
- `checkLowStockAndNotify()` consulta productos por debajo del mínimo y, si las notificaciones están habilitadas y `Notification.isSupported()`, muestra una notificación con el mensaje de `buildLowStockMessage`.
- `checkExpiryAndNotify()` consulta lotes por vencer dentro del umbral `expiry_threshold_days` y, si `notify_expiry` está habilitada y `Notification.isSupported()`, muestra una notificación con el mensaje de `buildExpiryMessage`.
- `showTestNotification()` dispara una notificación de prueba (canal `notifications:test`, gated por `settings.manage`).
- `startLowStockWatcher()` arranca un `setInterval` cuando la app está lista (desde `src/main/index.ts`). El intervalo es el configurado (`notify_interval_min` minutos, mínimo 5; default 60), y se hace una primera revisión a los 15 s del arranque. En cada revisión comprueba tanto stock bajo como lotes por vencer.

### Configuración

- `SettingsInfo`/`SettingsInput` incluyen `notify_low_stock`, `notify_expiry` y `notify_interval_min` validados por `settings:update`.
- La tarjeta **Notificaciones** de Configuración (`Settings.tsx`) permite activar/desactivar ambas alertas, ajustar el intervalo y probar; `api.notifications.test(userId)` devuelve `{ shown: boolean }` y `api.notifications.check(userId)` devuelve `{ lowStock, expiring }`.

### Captura de errores del renderer

El build del renderer (`src/renderer/main.tsx`) registra listeners de `error` y `unhandledrejection` que reportan el fallo al canal `logger:error` del proceso principal, donde `logError()` (de `src/main/logger.ts`) lo persiste en el archivo `app.log` sin conspirar con la UI.

---

## 6.9 Onboarding y guía de primeros pasos

La tarea 14 introduce un asistente de primera configuración y una guía de primeros pasos en el Dashboard.

### Asistente (`OnboardingWizard`)

- Aparece dentro de `Layout` para el primer admin logueado **cuando la empresa aún no tiene nombre** y no fue omitido.
- Flujo en 2 pasos: bienvenida → datos de la empresa (nombre, RUC, teléfono, email, dirección) y **moneda** (desde `src/shared/currencies.ts`).
- Al guardar llama `company:update` (misma validación y vía de auditoría que Configuración). "Omitir" persiste `localStorage['onboarding_dismissed'] = '1'`.
- Desaparece automáticamente al existir `company.name`.

### Guía de primeros pasos (`FirstStepsChecklist`)

- Widget del Dashboard que verifica 4 metas en vivo: empresa configurada, `total_categories > 0`, `total_products > 0` y `total_movements > 0`.
- `dashboard:summary` expone ahora `total_categories` y `total_movements` (además de `total_products`, `total_stock_value`, etc.).
- Cada meta indica la ruta para resolverla (`title`); el widget se oculta solo si se cierra (`localStorage['guide_hidden']`) o cuando todo está completo.

> **Seam de E2E:** si `WAREHOS_USER_DATA` está definida al arrancar el main (`src/main/index.ts`), se sobreescribe `app.setPath('userData', ...)`. Permite lanzar el E2E contra una base limpia (usuario seed `admin` / `admin123`).

---

## 6.10 Monedas e internacionalización (i18n)

- **Catálogo de monedas** (`src/shared/currencies.ts`): 16 monedas con código ISO, nombre local y locale para formateo (`CURRENCIES`, `DEFAULT_CURRENCY = 'PEN'`, `isSupportedCurrency`, `currencyLocale`). `formatNumber(value, currency)` en `formatters.ts` formatea según el locale de la moneda (p. ej. `BRL` → `1.500,00`).
- **i18n liviano** (`src/renderer/lib/i18n.ts`): diccionarios `es`/`en`/`pt` (default `es`), hook `useI18n()` (basado en `useSyncExternalStore`) con `t(key)`/`setLang()`, persistencia en `localStorage['app_lang']` y `LANGUAGE_OPTIONS`. Sin dependencias externas (no i18next).
- **Superficie traducida**: Sidebar, Login (con selector de idioma), título del Dashboard y Configuración (card **Idioma**). El idioma aplica también a la notificación de stock bajo vía mensajes fijados.
- Tests: `src/test/unit/i18n.test.ts` y `formatters.test.ts` (BRL, JPY, GBP, CAD y formatos por locale).

---

## 7. Comandos del proyecto

```bash
# Instalación de dependencias
npm install

# Desarrollo (Electron + Vite con recarga en caliente)
npm run dev

# Compilar para producción
npm run build

# Compilar + empaquetar instalador de Windows
npm run build:win

# Ejecutar tests
npm run test

# Ejecutar tests en modo watch
npm run test:watch

# Tests con cobertura (shared ≥ 70%)
npm run test:coverage

# E2E (Playwright sobre el build, Electron)
npm run test:e2e

# Linting
npm run lint          # revisar
npm run lint:fix      # corregir

# Formato
npm run format
```

### Salidas de build
| Carpeta | Contenido |
|---|---|
| `dist/` | Renderer compilado (React/Vite) |
| `dist-electron/` | Main process y preload compilados (CommonJS) |
| `release/` | App empaquetada (`WarehOS Setup 1.0.2.exe` + `win-unpacked/`) |

---

## 8. Configuración de empaquetado (electron-builder)

La configuración está en `package.json` → `build`. Puntos clave:

### Multiplataforma

```jsonc
{
  "build": {
    "files": ["dist/**/*", "dist-electron/**/*", "package.json"],
    "win": {
      "target": ["nsis"],
      "icon": "build/icon.ico",
      "signAndEditExecutable": false   // evita necesidad de winCodeSign
    },
    "mac": {
      "target": ["dmg", "zip"],
      "icon": "build/icon.icns",
      "category": "public.app-category.business"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "icon": "build/icon.png",
      "category": "Office",
      "maintainer": "WarehOS"
    },
    "nsis": { "oneClick": false, "allowToChangeInstallationDirectory": true },
    "publish": {
      "provider": "github",
      "owner": "MI_USUARIO_GITHUB",
      "repo": "warehos",
      "releaseType": "draft"
    }
  }
}
```

| Comando | Plataforma de build | Formatos |
|---|---|---|
| `npm run build:win` | Windows (o cualquier SO) | `.exe` NSIS + `win-unpacked/` |
| `npm run build:linux` | Linux preferiblemente (o CI) | `.AppImage`, `.deb` |
| `npm run build:mac` | **Solo macOS** | `.dmg`, `.zip` |

- **macOS** solo puede empaquetar en macOS (herramientas de firma y formato `.dmg`).
- Los **iconos por plataforma** se generan desde `build/logo.png` con `node build/make-icon.cjs` (emite `icon.ico`, `icon.icns` y `icon.png`) — usa `sharp` (dev) y `png2icons` (puro JS).
- `build/after-pack.cjs` usa `rcedit` (solo Windows) para incrustar icono y metadatos en el `.exe`; si no existe `WarehOS.exe` se salta sin error, por lo que es seguro en macOS/Linux.

### Notas de plataforma

- **`signAndEditExecutable: false`** es esencial: **evita que electron-builder descargue `winCodeSign`**, cuyo descompresión requiere crear symlinks (privilegios de administrador) y falla en entornos sin ellos. Al desactivarlo, el empaquetado funciona sin firmar la app.
- **AppImage desde Windows**: el paso fuente requiere crear **symlinks**; falla con "El cliente no dispone de un privilegio requerido" a menos que se ejecute como Administrador o con Developer Mode activado.
- **`.deb` desde Windows**: electron-builder exige la herramienta `fpm` (gem de Ruby), normalmente no instalada; se recomienda generar el `.deb` en Linux o CI.
- La carpeta `linux-unpacked/` (app desplegada) sí se genera correctamente desde Windows; esto verifica que el empaquetado de la app para Linux funciona.

### Dependencias nativas

No hay **módulos nativos en producción** (100% multiplataforma, sin recompilar):

- `bcryptjs` — puro JS (contenedores de hash).
- `sql.js` — **WASM** (bundle de SQLite); funciona idéntico en los tres SO. La localización de `sql-wasm.wasm` se resuelve con `require.resolve('sql.js')` dentro de `node_modules` empaquetado (ver nota WASM en §4).
- `jsbarcode`, `jspdf`, `xlsx` — puro JS.
- `sharp` y `rcedit` son **devDependencies** (solo en tiempo de build: iconos y edición del `.exe`); no se incluyen en la app empaquetada.

---

## 9. Autenticación

- Contraseñas con **bcryptjs** (hash de 10 rondas).
- Canal `auth:login` compara el hash; nunca devuelve el hash.
- Canal `auth:changePassword` valida la contraseña actual (con `bcrypt.compareSync`), comprueba la longitud mínima (6 caracteres) y actualiza el hash.
- **Recuperación de contraseña (100% offline)** mediante pregunta de seguridad:
  - Columna `security_question` (texto) y `security_answer_hash` (hash bcrypt) en la tabla `users`.
  - `auth:setSecurityQuestion` guarda pregunta + hash de la respuesta.
  - `auth:getSecurityQuestion` devuelve **solo la pregunta** (nunca la respuesta ni su hash).
  - `auth:resetPassword` valida username + respuesta y establece la nueva contraseña.
- La sesión se persiste en el **localStorage** del renderer (el usuario autenticado se guarda como JSON).
- `auth:register` crea usuarios con rol `operator` por defecto.
- **Seed**: al primer arranque, si no hay admin, se crea `admin` / `admin123` (ver `seedDefaultAdmin`).
- `auth:me(callerUserId)` devuelve el usuario **fresco** (sin cachear) + `mustChangePassword`; lo usa el `Layout` para reconciliar la sesión cuando cambia de usuario y para mostrar el aviso de "cambia la contraseña por defecto".
- `auth:login` marca `mustChangePassword = bcrypt.compareSync('admin123', hash)` (el seed se usa solo si el admin **aún conserva su hash original**); el aviso desaparece al cambiar la contraseña. El renderer lo muestra como banner azul (`Layout.tsx`) hasta completar el cambio.
- `auth:deleteUser` **no** permite borrar: tu propia cuenta, a otro `admin`, ni a un usuario con movimientos registrados (`SELECT COUNT(*) FROM stock_movements WHERE user_id = ?` → error amigable).

---

## 10. Permisos por rol

La aplicación implementa **autorización granular basada en capacidades**, definida en `src/shared/permissions.ts`.

- Cada rol (`admin`, `operator`, `viewer`) tiene un conjunto de **capacidades** (`products.manage`, `categories.manage`, `inventory.manage`, `users.manage`, `users.create`, `settings.manage`, `reports.view`, `audit.view`, `auth.self`).
- El helper `can(role, capability)` decide si un rol puede realizar una acción.
- **Enforce en el backend (límite de seguridad real):** cada handler IPC mutante (`products:*` incluido `products:import`, `categories:*`, `movements:create`, `warehouses:*`, `company:update`, `backup:*`, `auth:register`, `auth:deleteUser`, `auth:listUsers`) recibe el `userId` del solicitante y llama `requireCapability(userId, capability)`, que busca el rol en la BD y devuelve un error si no tiene permiso. Esto impide que alguien con rol `viewer` manipule la interfaz para saltarse la restricción. `auth:listUsers` también exige `users.manage` para no filtrar el listado de usuarios a roles no administrativos. La gestión de almacenes (`warehouses:create/update/delete`) exige `settings.manage` (solo admin); `warehouses:list` está abierta porque la necesita la pantalla de movimientos.
- **En la interfaz:** los botones y acciones se ocultan o deshabilitan según `can(role, ...)` en `Products.tsx`, `Inventory.tsx`, `Settings.tsx`, `ProductForm.tsx`, `Users.tsx` y `Warehouses.tsx`.
- **Gestión de usuarios (`Users.tsx`):** pantalla exclusiva de admin (`users.manage`). Permite crear usuarios con rol (vía `auth:register` con `callerUserId`, solo admin puede asignar rol `admin`) y eliminarlos (`auth:deleteUser` nunca borra un `admin`, la propia cuenta ni a un usuario con movimientos registrados). El enrutado y el ítem del sidebar se filtran por `can(role, 'users.manage')`. Los almacenes (`/warehouses`) siguen el mismo patrón con `settings.manage`.

Mapa de permisos:

| Capacidad | admin | operator | viewer |
|---|---|---|---|
| `products.manage`, `categories.manage`, `inventory.manage` | ✅ | ✅ | ❌ |
| `settings.manage`, `users.manage`, `users.create`, `audit.view` | ✅ | ❌ | ❌ |
| `reports.view`, `auth.self` | ✅ | ✅ | ✅ |

> Nota de seguridad: `auth:register` sin `callerUserId` (auto-registro desde el login) crea **siempre** rol `operator`, ignorando cualquier rol solicitado.

---

## 11. Testing

- **Unitario/cobertura — Vitest.** Ubicación: `src/test/unit/`. Config: `vitest.config.ts` (aliases, patrón `src/test/unit/**`, cobertura v8). Comando: `npm run test` (o `npm run test:coverage`).
- **Cobertura:** solo sobre `src/shared/**` (excluido `types.ts`), con umbrales de **70%** en `lines/statements/functions/branches` (verificado con `npm run test:coverage`).
- **E2E — Playwright sobre Electron.** Ubicación: `src/test/e2e/`, config `playwright.config.ts` (worker único, `retries: 1`, trazas ante fallo). Comando: `npm run test:e2e` (hace build y lanza Playwright). **78 tests en verde.**
  - Usa `_electron.launch({ args: ['.'] })` con `WAREHOS_USER_DATA` apuntando a un directorio temporal (BD limpia), el seed `admin`/`admin123` y la variable `WAREHOS_FORCE_PRO=1` (seam de licencia en `src/main/license.ts`) para probar también las funciones Pro.
  - `app.spec.ts` cubre el flujo completo: login → onboarding (empresa + moneda) → crear categoría → crear producto → dashboard reflejando el checklist.
  - Notas prácticas para escribir specs (documentadas y verificadas durante la suite):
    - `getByLabel` **no funciona** en esta app: los `<label>` no usan `htmlFor` ni envuelven el input. Usa selectores por estructura (`input[type="text"]`/`[type="password"]`/... con `.nth(n)`, `autocomplete`, `select`) o `label.locator('..')`.
    - Seeding por IPC (helper `invokeApi` en `helpers/seed.ts`): al crear productos **hay que pasar siempre `category_id`**; si queda `undefined` el bind falla (`Wrong API use: tried to bind a value of an unknown type`).
    - Descargas/impresiones: el main no maneja `will-download`, así que el helper `saveDownloadsTo(app, dir)` de `helpers/downloads.ts` captura las descargas; como varios specs comparten carpeta, usa `waitForDownloadSince(dir, sinceMs)` (en `helpers/fixtures.ts`) para ignorar descargas previas. Incluir el sufijo esperado (`'.csv'`/`'.pdf'`) para no jugar contra archivos temporales (`*.crdownload`).
    - Para borrar/admin de la UI que usa `window.confirm`, hay que stubbear `window.confirm = () => true` (Electron lo rechaza por defecto).
    - `retries: 1`: tras un fallo Playwright **re-ejecuta `beforeAll`** (nuevo `handle`/ventana sobre BD limpia), así que los tests que dependen de datos sembrados en otros tests previos deben sembrar sus propios datos dentro del propio test (ver el test del dashboard vencido en `lots.spec.ts`).
    - Navegar al Dashboard con `freshNav(win, '/')` cuando ya se está en `/` no re-monta la página (hash router); para forzar un fetch fresco hay que ir a otra ruta (`navTo(win, '/products')`) y luego a `/`.
  - Los specs E2E cubren (además de `app.spec.ts`): `auth` (login, errores, registro/rol), `dashboard`, `categories`, `products` (CRUD, búsqueda, filtros, backend), `import` (CSV es/en y aviso sin archivo), `movements` (entrada, salida, ajuste, transferencia, stock insuficiente, filtros), `lots` (exigencia de lote con control, entrada con/sin vencimiento, lote por vencer en el dashboard), `export-movimientos` (CSV/PDF Pro), `reports` (resumen y exportación CSV/PDF), `settings-company` (datos de onboarding, persistencia, cambio de moneda), `password` (cambio, confirmación y longitud), `recovery` (pregunta de seguridad completa y sin pregunta), `users` (crear/eliminar operador, protecciones de admin y de operador con movimientos), `roles` (matriz operador/visor en UI y backend), `audit` (listado de eventos, registro de acciones, visor sin acceso), `warehouses` (crear/editar, principal no borrable, eliminar con confirmación), `password-nudge` (aviso de contraseña por defecto con y sin cambio previo), `license-ui` (tarjeta Licencia en estado Pro/trial, código de máquina, tarjeta Actualizaciones con el aviso de app instalada), `backup` (exportar/restaurar Pro, backup cifrado con magic `WHBAK01`, contraseña corta rechazada, restauración con contraseña correcta/incorrecta) y `faq` (unidad personalizada). `launchApp()` acepta `{ forcePro: false }` para lanzar en estado trial sin el seam Pro.
  - Bugs reales de la app corregidos gracias al E2E: la columna `Nota` de movimientos no definía `render` y crasheaba el renderer (`TypeError: se.render is not a function`) con cualquier historial, y `auth:register` con `callerUserId` rechazaba SIEMPRE al usuario por un `!requireCapability(...)` invertido (imposible crear usuarios desde la página Usuarios).
- Los tests actuales cubren:
  - `stockLogic.test.ts` — lógica de movimientos de stock (entradas, salidas, ajustes, **transferencias**, validaciones).
  - `lotLogic.test.ts` — lógica de lotes: orden FEFO, asignación FEFO (FIFO de vencimientos), reasignación de ajustes y totales.
  - `chartLogic.test.ts` — lógica de gráficos del dashboard: tendencia de stock (entradas, salidas, ajustes, transferencias entre almacenes, días sin movimientos, movimientos legacy).
  - `migrations.test.ts` — **migraciones de almacenes, lotes y auditoría** sobre una BD con datos previos y sobre BD nueva (rebuild de `stock_movements`, siembra del almacén principal, backfill de stock, soporte TRANSFER, columna `track_lots`, tabla `lots` y tabla `audit_log`).
  - `formatters.test.ts` — formateo de moneda y números (incluye monedas nuevas y `formatNumber` por locale).
  - `permissions.test.ts` — matriz de capacidades por rol y jerarquía (incluye `audit.view` solo admin).
  - `importParser.test.ts` — mapeo de filas de importación Excel/CSV.
  - `barcode.test.ts` — normalización de códigos de barras.
  - `updaterConfig.test.ts` — validación/normalización de la URL del feed de actualizaciones.
  - `trialLogic.test.ts` — lógica de modo trial (30 días).
  - `validation.test.ts` — normalización email/username/strings, passwords, contraseña de backup (mínimo 8), números no negativos, `clampInt`.
  - `i18n.test.ts` — diccionarios es/en/pt y persistencia de idioma.
  - `lowStockLogic.test.ts` — detección de stock bajo y mensaje de notificación.
  - `database.test.ts` — `lastInsertRowid` real con sql.js (regresión de `products:create`), `dbEncryption.test.ts` — cifrado AES-256-GCM de la BD (magic `WHENC01`) **y** de backups por contraseña (magic `WHBAK01`, scrypt + GCM, ronda redonda, contraseña incorrecta y detección de archivos plano heredados).

Para agregar tests unitarios: crea archivos `*.test.ts` en `src/test/unit/` y ejecuta `npm run test`. Para el E2E: crea `.spec.ts` en `src/test/e2e/`. **Vitest no ejecuta `src/test/e2e`** (solo Playwright).

---

## 12. Seguridad

- **Context isolation** activo, `nodeIntegration: false`, `sandbox: false` (necesario para el preload con IPC).
- **CSP** definida en `index.html` (`default-src 'self'`).
- El renderer no tiene acceso directo a Node ni a la base de datos.
- Las rutas protegidas redirigen al login si no hay sesión.
- Validaciones de entrada en el main process (stock insuficiente, SKU duplicado, **código de barras duplicado**, cantidades). El barcode se normaliza con `normalizeBarcode` (`src/shared/barcode.ts`): se recorta, pasa a mayúsculas y los vacíos se guardan como `NULL`.
- Autorización por rol en el **backend** (ver sección "Permisos por rol"): las operaciones mutantes verifican la capacidad del usuario antes de ejecutarse.
- **Licenciamiento firmado**: la verificación y el gateo se ejecutan en el main process (`src/main/license.ts`, sección 6.3). La clave pública está embebida; las claves se generan con la clave privada del vendedor. Gating Pro además en el renderer para exportaciones a PDF/CSV y etiquetas.
- **Instancia única**: `app.requestSingleInstanceLock()` evita ejecutar dos instancias sobre el mismo `userData` (riesgo de corrupción del archivo de BD).
- **Lockout por fuerza bruta**: el login bloquea 5 intentos fallidos durante 5 minutos (persistido en `app_state`), y la **recuperación por pregunta de seguridad** usa el mismo esquema (`recovery_failures`) sobre la respuesta; `auth:resetPassword` rechaza mientras el bloqueo esté activo.
- **Backups cifrados** con contraseña del usuario (scrypt + AES-256-GCM) y restauración que re-aplica migraciones sin desactivar `foreign_keys` (sección 4).
- **Actualización de software**: los handlers `updates:*` exigen `settings.manage`; la URL del feed se valida con `normalizeFeedUrl` y las descargas se integran con electron-updater verificando `sha512` contra `latest*.yml` (ver sección 14).

---

## 13. Limitaciones conocidas y próximos pasos

- **Recuperación de contraseña olvidada sin pregunta de seguridad**: no hay respaldo (debe existir una pregunta configurada; un admin sin pregunta puede quedar sin acceso).
- **Gestión avanzada de permisos por rol**: aplicada (ver sección "Permisos por rol"). El rol `viewer` es de solo lectura y `operator` no puede administrar usuarios ni configuración.
- **Escaneo por cámara web**: pendiente (el lector USB ya está soportado; la cámara requeriría `html5-qrcode`/`@zxing`).
- **Impresión directa sin diálogo del sistema**: pendiente (hoy el PDF se abre y lanza el diálogo de impresión nativo).
- **Robustez del conteo de prueba**: el trial (30 días) está blindado contra cambios de reloj con marca de agua + almacenamiento dual (ver sección 6.3). Límites que quedan en una app 100% offline: congelar el reloj desde el primer uso (batería CMOS muerta o usuario que lo congela deliberadamente) impide medir el tiempo transcurrido, y borrar **todo** el estado (BD + archivo espejo) equivale a reinstalar y perder el catálogo. Protegerlo del todo exigiría un servidor de licencias (rompe el "100% offline").
- **Firma digital del instalador**: la app no está firmada; Windows muestra aviso de SmartScreen (código candidato a integrarse en CI).
- **Refactor del trozo de IPC**: `ipc-handlers.ts` concentra toda la lógica de negocio (acceso directo a la BD); extraer repositorios/use-cases por dominio está documentado como deuda técnica (bajo riesgo, alto toque de archivos).
- **Números de serie** por unidad y **deshacer movimientos**: pendientes (ver reconocidos en 6.5).
- **D13 resuelto**: la UI de Licencia y Actualizaciones está en Configuración y se verifica con `license-ui.spec` (estado Pro/trial y aviso de actualizaciones fuera de app instalada).

**Ya implementado en esta versión:**
- **Gráficos en el Dashboard** (Recharts): tendencia de stock a 30 días (área), top productos por salidas (barras) y distribución de stock por categoría (dona), calculados en `dashboard:summary` (ver sección 6.6).
- Control de lotes y fechas de vencimiento por producto: tabla `lots`, salidas FEFO, reasignación de ajustes, avisos por lote (expired/near), umbral configurable y modal de desglose (ver sección 6.5). Los números de serie quedan pendientes.
- Múltiples almacenes/sucursales: tablas `warehouses` + `product_warehouse_stock`, transferencias entre almacenes (`TRANSFER`), stock desglosado por almacén y agregado global (ver sección 6.4).
- Importación masiva de productos desde Excel/CSV (`products:import` con `xlsx` + `dialog.showOpenDialog`).
- Exportación del historial de movimientos a PDF y CSV.
- Moneda configurable por empresa (columna `companies.currency`, 16 monedas soportadas, ver sección 6.10).
- Campo **código de barras** en productos (EAN-13/UPC/Code128): columna `products.barcode` con índice único parcial, búsqueda por barcode en `products:list` y exacta vía `products:getByBarcode`, soportado en la importación masiva.
- **Lector USB (keyboard-wedge)**: escaneo en búsqueda de productos y en registro de movimientos, sin dependencias nuevas (ver sección 6.1).
- **Etiquetas de código de barras**: generación de PDF imprimible (jsbarcode + jsPDF) con tamaños 50×30, 60×40 y 80×50 mm (ver sección 6.2).
- **Licenciamiento / activación**: trial de 30 días, activación Pro con clave firmada RSA por máquina, gating de funciones Pro (importación, exportaciones PDF/CSV, etiquetas y backup) y modo solo lectura cuando el trial expira (ver secciones 6.3 y 12).
- **Auto-actualización** (`electron-updater`): comprobación manual y opcional al iniciar, descarga con progreso y aplicación al reinicio; feed `generic` configurable en tiempo de ejecución desde **Configuración → Actualizaciones** (ver sección 14).
- **Log de auditoría** (tabla `audit_log`): registro de creaciones/ediciones/eliminaciones, movimientos, inicios de sesión (éxito/fallo) y cambios de configuración, con página **Auditoría** solo para admin y filtros por acción, entidad y fechas (ver sección 6.7).
- **Cifrado de la BD y bloqueo de login** (tarea 11): la base en disco se cifra con AES-256-GCM (clave guardada cifrada con `safeStorage` en `inventario.key`; la BD legacy se lee igual, ver sección 4); 5 intentos de login fallidos por usuario bloquean 5 minutos (claves `login_failures` en `app_state`).
- **Más monedas e i18n** (tarea 12): 16 monedas centralizadas en `src/shared/currencies.ts` y UI en español/inglés/portugués (`src/renderer/lib/i18n.ts`, selector de idioma en Login y Configuración; ver secciones 6.10).
- **Notificaciones del sistema** (tarea 13): alertas de stock bajo y de lotes por vencer con `Notification` nativo, revisión periódica desde el main y tarjetas de configuración/prueba (ver sección 6.8).
- **Onboarding y primeros pasos** (tarea 14): asistente de primera configuración (empresa + moneda) y checklist de guía en el Dashboard (ver sección 6.9).
- **Robustez de Fase II** (tarea 15+): paginación de `DataTable` (20/página), `auth:me` + banner de cambio de contraseña por defecto, protecciones de `deleteUser` (admin, self, movimientos), `safeHandle` con errores normalizados y logs en `userData/logs/app.log` (ver secciones 3 y 9).

---

## 14. Auto-actualización (electron-updater)

La actualización automática usa **`electron-updater`** sobre los targets ya configurados (Windows NSIS, macOS DMG, Linux AppImage/DEB).
Documentación de referencia: <https://www.electron.build/docs/features/auto-update/>, <https://www.electron.build/docs/publish/> y el README del paquete (`node_modules/electron-updater`).

### Cómo funciona

- electron-builder genera, al construir con `publish` configurado, el manifiesto interno `app-update.yml` (en `resources/` de la app instalada) y, en `release/`, los instaladores + sus `.blockmap` + los metadatos `latest.yml` / `latest-mac.yml` / `latest-linux.yml`.
- La app consulta el feed, compara versiones con semver, descarga el instalador nuevo (con progreso) y lo aplica al reiniciar (`autoUpdater.quitAndInstall()`).
- **Feed por defecto (empaquetado): GitHub Releases.** `build.publish → provider "github"` con `owner`/`repo` → electron-builder fija la URL de descarga a `https://github.com/<owner>/<repo>/releases/download/v<version>/...` y electron-updater lee `latest.yml` de los assets del Release. Los valores de `owner`/`repo` actuales son **placeholders** (`MI_USUARIO_GITHUB`/`warehos`) que el vendedor debe reemplazar por su cuenta y repositorio reales.
- **Feed alternativo en tiempo de ejecución:** en **Configuración → Actualizaciones** un admin puede fijar la URL de un **servidor propio** (`provider: generic`, para quien no quiera GitHub; útil también para una carpeta en su hosting). Se guarda en `app_state` (claves `update_feed`, `update_auto_check`). Si el feed está definido, el main llama `autoUpdater.setFeedURL({ provider: 'generic', url })`; si se limpia, se vuelve a usar GitHub Releases (el override solo se aplica al arranque, y se aplica en la misma sesión al guardarlo).

### Publicar una versión nueva (GitHub Releases)

La publicación **no es automática**: electron-builder solo genera los artefactos. Hay dos caminos:

**Opción A — manual (sin token):**
1. Sube la versión en `package.json` (p. ej. `1.1.0`).
2. Build normal: `npm run build:win` (o `build:mac`/`build:linux` según plataforma).
3. En GitHub: crea un **Release** con etiqueta `v1.1.0` en el repositorio público `owner/repo`.
4. Sube como assets del Release: el instalador **renombrado** al nombre exacto que aparece en `latest.yml` (el build genera `WarehOS Setup 1.1.0.exe`, pero `latest.yml` declara `WarehOS-Setup-1.1.0.exe` — con guiones —, y ese debe ser el nombre del asset), su `.blockmap` y el propio `latest.yml`. Si los nombres no coinciden, electron-updater no encontrará el archivo.
5. Publica el release (no lo dejes en draft).

**Opción B — con `GH_TOKEN` (sube todo solo):**
1. Token con permiso `repo` (o `GITHUB_TOKEN` en CI). La doc oficial recomienda publicar desde CI con `--publish always`.
2. `npx electron-builder --win --publish always` — con `releaseType: "draft"` crea un **draft release**; revísalo en GitHub y pulsa "Publish release" cuando lo apruebes (patrón recomendado por la doc oficial, ver "Draft Release Workflow").

> La API de GitHub tiene límite de 5000 peticiones/hora por usuario autenticado; una comprobación de update usa hasta 3.

### Comportamiento y límites

- **Descarga automática**: al detectar una versión nueva se descarga en segundo plano (`autoDownload = true`; eventos `download-progress`), y la UI muestra "Reiniciar e instalar" al terminar (`update-downloaded`). Un update ya descargado se aplica igualmente en el siguiente arranque aunque el usuario no lo reinicie.
- **Verificación de integridad**: electron-updater valida el `sha512` declarado en `latest*.yml` antes de instalar; en Windows/macOS verifica firma digital cuando existe. En Linux `allowUnverifiedLinuxPackages` es permisivo por defecto (electron-builder no firma paquetes Linux).
- **Repos públicos**: los clientes **no necesitan** token para descargar de un repo público. Los repos privados requieren `GH_TOKEN` + `private: true` en el cliente (caso poco habitual; ver doc oficial).
- **Solo en la app instalada**: en desarrollo (`app.isPackaged === false`) el módulo reporta "deshabilitado" para no fallar por ausencia de `app-update.yml`. Para probar en dev se necesita `dev-app-update.yml` + `autoUpdater.forceDevUpdateConfig = true`, o probar con la app empaquetada (ver doc oficial).
- **Sin firma digital**: el instalador Windows no está firmado; electron-updater puede instalarlo igualmente (valida SHA-512), se mantiene el aviso de SmartScreen.
- **Seguridad**: los handlers IPC `updates:*` exigen `settings.manage` (solo admin); la URL del feed propio se valida (`http/https`) con `normalizeFeedUrl` en `src/shared/updaterConfig.ts` (cubierto por tests).
- **Offline-first**: la comprobación automática al iniciar está **desactivada por defecto** (opt-in), para no forzar tráfico de red en entornos sin conexión.

---

## 15. Reproducción del entorno

- Node.js `v24.16.0` (verificado durante el desarrollo).
- SQLite vía `sql.js` `^1.10.3`.
- Electron `31.3.1`.

> **Instalación de Electron:** si tras `npm install` el binario de Electron no se descarga (problemas de red/symlinks), instala el binario manualmente:
> 1. Descarga `electron-v31.3.1-win32-x64.zip` a `%LOCALAPPDATA%\electron\Cache\<hash>\`.
> 2. Extrae el contenido en `node_modules\electron\dist\`.
> 3. Crea `node_modules\electron\path.txt` con el contenido `electron.exe`.
