# Implementation Plan: WarehOS

> **Nota de estado:** plan original de arranque. El progreso real se sigue en `tasks/todo.md` y la arquitectura vigente (incluido el cambio de `better-sqlite3` a **sql.js/WASM**, refrendado abajo) está documentada en `docs/TECNICO.md`.

## Overview
Aplicación de escritorio universal de gestión de inventario construida con Electron + React + TypeScript + SQLite. Se implementa en módulos verticales: primero la base de datos, luego autenticación, productos, inventario, reportes y configuración.

## Architecture Decisions
1. **Electron + React + TypeScript + SQLite** — stack elegido por el usuario (Tauri no viable sin Rust). Electron maduro y multiplataforma.
2. **sql.js (SQLite/WASM) en el main process** — se descartó `better-sqlite3` porque exige compilar binarios nativos (VS Build Tools); `sql.js` se instala sin toolchain y cumple igual en app de escritorio de un solo proceso (ver `docs/TECNICO.md` §4). Acceso a BD solo desde el main process de Electron; el renderer se comunica vía IPC con la API expuesta por preload.
3. **Comunicación IPC tipada** — uso de `ipcMain.handle` + `contextBridge.exposeInMainWorld` para un bridge seguro y tipado. Nunca expongo la BD directamente al renderer.
4. **Zustand para estado** — stores pequeños y enfocados (auth, products, inventory, settings).
5. **SQLite local, 100% offline** — sin servidor ni nube. Los datos viven en un archivo en el directorio de datos del usuario.
6. **Migraciones SQL versionadas** — tabla `schema_migrations` que registra versiones aplicadas.

## Data Model (esquema SQLite)
- `users` — id, name, email, password_hash, role, created_at
- `categories` — id, name, description
- `products` — id, name, sku, description, category_id, unit, stock_min, current_stock, cost_price, sale_price, created_at, updated_at
- `stock_movements` — id, product_id, type (IN/OUT/ADJUSTMENT), quantity, note, user_id, created_at
- `companies` — id, name, address, phone, email, tax_id (settings de la empresa)
- `schema_migrations` — version, applied_at

## Task List

### Phase 1: Foundation
- [ ] Task 1: Scaffold del proyecto Electron + React + TypeScript + Vite
- [ ] Task 2: Configuración de Tailwind, ESLint, Prettier, tsconfig
- [ ] Task 3: Capa de base de datos SQLite con migraciones y conexión
- [ ] Task 4: Bridge IPC con preload script tipado y shared types

### Checkpoint: Foundation
- [ ] La app Electron inicia y muestra un renderer básico
- [ ] La BD SQLite se crea con las tablas iniciales al primer arranque
- [ ] IPC funciona entre renderer y main process

### Phase 2: Auth
- [ ] Task 5: Registro de usuario y hashing de contraseñas (bcrypt)
- [ ] Task 6: Login, logout, sesión persistente y roles
- [ ] Task 7: Página de Login y protección de rutas en el frontend

### Checkpoint: Auth
- [ ] Puedo registrar un usuario desde la UI
- [ ] Puedo iniciar sesión con credenciales válidas
- [ ] Las rutas protegidas redirigen al login si no hay sesión

### Phase 3: Productos
- [ ] Task 8: CRUD de categorías
- [ ] Task 9: CRUD de productos (crear, listar, editar, eliminar)
- [ ] Task 10: Página de productos con búsqueda, filtros y paginación

### Checkpoint: Productos
- [ ] Puedo crear, editar y eliminar categorías
- [ ] Puedo crear, editar y eliminar productos
- [ ] La tabla de productos muestra los datos con búsqueda y paginación

### Phase 4: Inventario
- [ ] Task 11: Registro de movimientos (entradas, salidas, ajustes)
- [ ] Task 12: Actualización automática de stock tras cada movimiento
- [ ] Task 13: Dashboard con stock bajo, resumen y estadísticas

### Checkpoint: Inventario
- [ ] Un movimiento de entrada incrementa el stock
- [ ] Un movimiento de salida decrementa el stock
- [ ] Un ajuste corrige el stock al valor indicado
- [ ] El dashboard muestra productos con stock bajo alertando al usuario

### Phase 5: Reportes
- [ ] Task 14: Reporte de inventario actual y valorización
- [ ] Task 15: Reporte de movimientos (historial filtrable por fechas/tipo)
- [ ] Task 16: Exportación a PDF (jsPDF) y CSV

### Checkpoint: Reportes
- [ ] Puedo ver inventario actual con valorización monetaria
- [ ] Puedo filtrar movimientos por fechas y tipo
- [ ] Puedo exportar reportes a PDF y CSV

### Phase 6: Configuración y polish
- [ ] Task 17: Configuración de datos de empresa
- [ ] Task 18: Backup y restore de la BD
- [ ] Task 19: Empaquetado con electron-builder (.exe para Windows)

### Checkpoint: Configuración y polish
- [ ] Puedo guardar datos de empresa
- [ ] Backup genera un archivo restaurable
- [ ] Se genera un instalador .exe funcional

### Checkpoint: Complete
- [ ] Todos los criterios de éxito del spec cumplidos
- [ ] Unit tests pasan
- [ ] App empaquetada y funcional en Windows

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Compilación native de better-sqlite3 en Electron | Med | Resuelto: se usa sql.js (WASM), sin compilación nativa |
| Complejidad de tamaños de build/bundling | Med | Vite per renderer, electron-builder para empaquetado |
| Election + Vite config inicial | Med | Static at vite config, usar plantilla verificada |
| Seguridad de IPC (XSS en renderer) | Alto | Context isolation + nodeIntegration false + preload sanitizado |
| Multi-usuario offline (conflictos) | Bajo | App single-instance, un solo acceso local a la BD |

## Open Questions
- Ninguna. Spec aprobado.
