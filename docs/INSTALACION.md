# Guía de Instalación — WarehOS

Esta guía explica cómo instalar y poner en marcha **WarehOS**, el sistema de gestión de inventarios para tu empresa, sin importar el rubro al que se dedique.

---

## 1. Requisitos del sistema

| Requisito | Mínimo recomendado |
|---|---|
| **Sistema operativo** | Windows 10/11 (64 bits), macOS, o Linux (x64) |
| **Procesador** | Cualquier procesador moderno (x64) |
| **Memoria RAM** | 2 GB o más |
| **Disco duro** | 300 MB de espacio libre |
| **Conexión a internet** | **No es necesaria** — la app funciona 100% offline |

La aplicación se compila para las tres plataformas desde el mismo código. Para generar los instaladores de cada sistema operativo ver `docs/TECNICO.md` (sección 8) — desde este proyecto se generan directamente el instalador de **Windows** (`build:win`, sección 2) y, con la configuración apropiada, los de **Linux** y **macOS**.

---

## 2. Instalación paso a paso (usuario final)

### Windows

**Paso 1: Localizar el instalador**

El instalador se llama:

```
WarehOS Setup 1.0.2.exe
```

Se encuentra en la carpeta `release/` del proyecto (o donde te hayan entregado la aplicación).

**Paso 2: Ejecutar el instalador**

1. Haz doble clic en `WarehOS Setup 1.0.2.exe`.
2. Si Windows muestra una advertencia azul de **"Windows protegió su PC"** (SmartScreen):
   - Haz clic en **"Más información"**.
   - Haz clic en **"Ejecutar de todas formas"**.
   - *Nota:* esta advertencia aparece porque la app aún no está firmada con un certificado digital de pago. Es normal y seguro.

### Paso 3: Elegir el directorio de instalación

El instalador te preguntará dónde instalar la aplicación:
- Puedes aceptar la **ubicación predeterminada** (recomendado) o elegir "Opciones" para cambiarla.

### Paso 4: Completar la instalación

1. Haz clic en **"Instalar"**.
2. Espera a que termine (suele tardar menos de un minuto).
3. Haz clic en **"Finalizar"**.
4. La aplicación se abrirá automáticamente, o podrás abrirla desde el **Menú Inicio → WarehOS** o el **acceso directo del escritorio**.

### Paso 5: Iniciar sesión por primera vez

La primera vez que abras la app verás la pantalla de **Iniciar sesión**.

La aplicación crea automáticamente un **usuario administrador** por defecto:

| Campo | Valor |
|---|---|
| **Usuario** | `admin` |
| **Contraseña** | `admin123` |

> **IMPORTANTE:** Por seguridad, cambia la contraseña del administrador lo antes posible. Ve a **Configuración → Cambiar contraseña**, introduce la contraseña actual (`admin123`) y establece una nueva (mínimo 6 caracteres).

### macOS

1. Ejecuta `WarehOS-1.0.2.dmg` (se genera en `release/` con `npm run build:mac`, **desde un equipo macOS**).
2. Arrastra **WarehOS** a la carpeta **Aplicaciones**.
3. La primera vez, macOS puede bloquear la app por no estar firmada:
   - Haz clic derecho (o **Ctrl** + clic) sobre **WarehOS** en el Finder → **Abrir**.
   - Confirma con **"Abrir"** en el diálogo de seguridad.
4. Abre WarehOS y continúa con el **Paso 5** de instalación (usuario y contraseña por defecto).

### Linux

Hay dos formatos disponibles (se generan en `release/` con `npm run build:linux`, normalmente desde Linux o CI):

- **AppImage** — portable, sin instalación:
  1. Marca el archivo como ejecutable: `chmod +x WareHOS-1.0.2.AppImage`.
  2. Haz doble clic para ejecutarlo.
- **Debian/Ubuntu (deb)** — instalación del sistema:
  ```
  sudo apt install ./warehos_1.0.2_amd64.deb
  ```
  3. Abre WarehOS desde el lanzador de aplicaciones y continúa con el **Paso 5** de instalación.

---

## 3. Instalación desde el código fuente (desarrolladores)

Si eres desarrollador y quieres ejecutar o compilar la app desde el código:

### Requisitos previos
- **Node.js** versión 18 o superior (con npm).
- **npm** incluido con Node.js.

### Pasos

```bash
# 1. Clonar o copiar el proyecto, luego instalar dependencias
npm install

# 2. Ejecutar en modo desarrollo (ventana con recarga en caliente)
npm run dev

# 3. Compilar para producción
npm run build

# 4. Empaquetar instaladores
npm run build:win      # Windows (.exe NSIS)   — se puede ejecutar en Windows
npm run build:linux    # Linux (AppImage, .deb) — preferible en Linux o CI
npm run build:mac      # macOS (.dmg, .zip)    — requiere macOS
```

> **Nota de plataformas:** el empaquetado de **Windows** puede ejecutarse en cualquier equipo; el de **macOS** debe ejecutarse en macOS (por las herramientas de firma y formato `.dmg`). Para **Linux**, lo habitual es ejecutarlo en una distribución Linux o en CI; desde Windows se genera la carpeta `linux-unpacked` sin problema, pero los formatos AppImage/deb requieren privilegios de symlink (modo administrador/Developer Mode) y la herramienta `fpm`.

---

## 4. Verificación de la instalación

Después de instalar, confirma que todo funciona:

1. Abre **WarehOS** desde el acceso directo.
2. Inicia sesión con `admin` / `admin123`.
3. Deberías ver el **Dashboard** con la bienvenida y métricas en cero (sin productos aún).
4. Ve a **Configuración → Pregunta de seguridad** y configura una (importante para recuperar la contraseña si la olvidas).
5. Ve a la sección **Productos** y crea un producto de prueba.

Si todo funciona, ¡la instalación fue exitosa!

---

## 5. ¿Dónde se guardan los datos?

Todos los datos (productos, movimientos, usuarios, configuraciones) se guardan **localmente** en un archivo de base de datos SQLite dentro de tu perfil de usuario:

| Sistema operativo | Ruta de datos |
|---|---|
| **Windows** | `C:\Users\<TU_USUARIO>\AppData\Roaming\warehos\inventario.db` |
| **macOS** | `~/Library/Application Support/warehos/inventario.db` |
| **Linux** | `~/.config/warehos/inventario.db` |

- Los datos **no** se suben a ningún servidor.
- Tu información es **privada y local**.
- Haz copias de seguridad periódicas desde **Configuración → Backup** (ver `docs/MANUAL_USUARIO.md`).

---

## 6. Solución de problemas

| Problema | Solución |
|---|---|
| SmartScreen bloquea la instalación | Haz clic en "Más información" → "Ejecutar de todas formas" |
| No recuerdo la contraseña | La app no permite recuperar contraseñas aún. Si olvidaste la del admin, contacta al soporte técnico |
| Los datos no aparecen | Revisa la carpeta de datos (sección 5) y verifica que exista `inventario.db` |
| SmartScreen de nuevo al abrir | Es el mismo aviso de app sin firmar; acepta el cuadro de aviso |
| Error "no se puede registrar" | El nombre de usuario ya está en uso; usa otro (min. 3 caracteres) o inicia sesión con el existente |
