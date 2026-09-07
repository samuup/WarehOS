# 📦 WarehOS

Sistema de **gestión de inventarios** para empresas de cualquier rubro. Aplicación de escritorio multiplataforma, **100% offline**, que te permite controlar tus productos, movimientos de stock y reportes sin depender de internet.

---

## ✨ Funcionalidades

- 🔐 **Autenticación** con **roles y permisos granulares** (admin, operador, visor) — login, registro, sesión persistente, **cambio de contraseña** y **recuperación por pregunta de seguridad**. Los permisos se verifican también en el backend.
- 📦 **Catálogo de productos** — CRUD completo, categorías, unidades de medida, SKU, **código de barras (EAN-13/UPC/Code128)**, precios y stock mínimo. **Importación masiva desde Excel/CSV** e **impresión de etiquetas** de código de barras (PDF).
- 🔄 **Movimientos de inventario** — entradas, salidas, ajustes y **transferencias entre almacenes** con actualización automática del stock y alerta de stock insuficiente. **Escaneo con lector USB de códigos de barras** para búsqueda y registro rápido. Historial exportable a **PDF** y **CSV**.
- ⏳ **Lotes y fechas de vencimiento** — control por lotes activable por producto, entradas con lote y fecha de vencimiento, salidas FEFO (descuentan del lote que vence primero), detalle por lote por almacén y alertas de vencimiento con umbral configurable.
- 📊 **Dashboard con gráficos** — tendencia de stock (30 días), top productos por salidas y distribución de stock por categoría (Recharts).
- 📋 **Auditoría** — log de quién hizo qué y cuándo (inicios de sesión, cambios, movimientos, configuraciones) visible solo para administradores, con filtros por acción, entidad y fechas.
- 🏬 **Múltiples almacenes** — stock desglosado por sucursal/ubicación y vista global agregada; gestión de almacenes (Área admin) y transferencias de stock entre ellos.
- 📊 **Dashboard** — métricas de inventario, valor total, productos con stock bajo y movimientos recientes.
- 📈 **Reportes** — inventario actual con valorización, exportable a **PDF** y **CSV**.
- 🏢 **Configuración** — datos de la empresa (incluida **moneda configurable** con 16 monedas), **idioma de la interfaz** (Español/English/Português), **notificaciones del sistema** para stock bajo, gestión de usuarios y **copias de seguridad** (backup/restauración) **cifradas con contraseña y portables a cualquier computadora**.
- 🎓 **Onboarding** — asistente de primera configuración (empresa + moneda) al primer inicio y guía de **primeros pasos** en el Dashboard hasta completar las tareas recomendadas.
- 🔑 **Licenciamiento** — periodo de prueba de 30 días y activación **Pro** por máquina con clave firmada (RSA, 100% offline). La versión Pro desbloquea importación masiva, exportación de reportes (PDF/CSV), etiquetas de código de barras y copias de seguridad.
- ⬆️ **Auto-actualización** (`electron-updater`) — comprobación manual o automática al iniciar, descarga con progreso y aplicación al reinicio, vía **GitHub Releases** (o un servidor propio configurable).
- 💾 **Base de datos local** (SQLite) — tus datos son privados y seguros en tu propia máquina. Base cifrada en disco (AES-256-GCM con protección vía `safeStorage`), **bloqueo de login y de recuperación de contraseña** tras 5 intentos fallidos (5 minutos), **instancia única** (evita corrupción del archivo abriendo la app dos veces) y **auditoría** de cambios.
- 🔔 **Notificaciones del sistema** — alertas de **stock bajo** revisadas automáticamente (intervalo configurable) y notificación de prueba desde Configuración.

---

## 🚀 Primeros pasos

### Usuario administrador por defecto

La primera vez que abras la app, inicia sesión con:

| Usuario | Contraseña |
|---|---|
| `admin` | `admin123` |

> ⚠️ Cambia la contraseña por defecto lo antes posible desde **Configuración → Cambiar contraseña** y configura una **pregunta de seguridad** (Configuración → Pregunta de seguridad) para poder recuperar la contraseña si la olvidas.

---

## ⚙️ Instalación

### Usuario final
1. **Windows**: ejecuta `WarehOS Setup 0.1.0.exe` (en la carpeta `release/`).
2. **macOS**: abre `WarehOS-0.1.0.dmg` y arrastra la app a Aplicaciones.
3. **Linux**: usa el `.AppImage` (portable) o instala el `.deb` con `sudo apt install ./warehos_0.1.0_amd64.deb`.
4. Sigue los pasos del asistente de instalación e inicia sesión con las credenciales por defecto.

> Guía detallada: [`docs/INSTALACION.md`](docs/INSTALACION.md)

### Desarrolladores
```bash
npm install          # instalar dependencias
npm run dev          # ejecutar en modo desarrollo
npm run build        # compilar para producción
npm run build:win    # instalador de Windows (.exe)
npm run build:linux  # instalador de Linux (AppImage/.deb; mejor en Linux o CI)
npm run build:mac    # instalador de macOS (.dmg; requiere macOS)
npm test             # tests unitarios
npm run test:coverage    # tests con cobertura (src/shared ≥ 70 %)
npm run test:e2e         # tests E2E (Playwright sobre el build)
```

> Manual completo: [`docs/MANUAL_USUARIO.md`](docs/MANUAL_USUARIO.md)

---

## 📚 Documentación

| Documento | Descripción |
|---|---|
| [`docs/INSTALACION.md`](docs/INSTALACION.md) | Guía de instalación paso a paso |
| [`docs/MANUAL_USUARIO.md`](docs/MANUAL_USUARIO.md) | Manual de usuario completo |
| [`docs/TECNICO.md`](docs/TECNICO.md) | Documentación técnica para desarrolladores |
| [`SPEC.md`](SPEC.md) | Especificación inicial del proyecto |

---

## 🛠️ Stack tecnológico

- **Electron 31** — framework de escritorio multiplataforma
- **React 18 + TypeScript** — interfaz de usuario
- **Tailwind CSS** — estilos
- **SQLite (sql.js / WASM)** — base de datos local sin compilación nativa
- **Zustand** — manejo de estado
- **Vite** — build y desarrollo
- **jsPDF** — exportación de reportes a PDF
- **Vitest** — pruebas unitarias (cobertura sobre `src/shared`, umbral ≥ 70 %)
- **Playwright** — pruebas E2E sobre Electron (login → onboarding → alta de producto)

---

## 📂 Estructura del proyecto

```
warehos/
├── src/
│   ├── main/        # Proceso principal de Electron (BD, IPC, ventana)
│   ├── renderer/    # Aplicación React (páginas, componentes, stores)
│   ├── shared/      # Código compartido (tipos, lógica de stock)
│   └── test/        # Tests unitarios (vitest) y E2E (playwright: dist/)
├── docs/            # Documentación
├── release/         # App empaquetada (instalador + portable)
└── package.json
```

---

## 🔒 Privacidad

Tus datos se almacenan **exclusivamente en tu computadora** en:

```
C:\Users\<tu_usuario>\AppData\Roaming\warehos\inventario.db
```

No se envían a ningún servidor ni a la nube. Haz copias de seguridad periódicas desde **Configuración → Backup**.

---

## 📄 Licencia

MIT License

---

*Documentación: leer en `docs/`.*
