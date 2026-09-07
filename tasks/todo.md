# Todo List: WarehOS

## Phase 1: Foundation
- [x] Task 1: Scaffold del proyecto Electron + React + TypeScript + Vite
- [x] Task 2: Configuración de Tailwind, ESLint, Prettier, tsconfig
- [x] Task 3: Capa de base de datos SQLite con migraciones y conexión
- [x] Task 4: Bridge IPC con preload script tipado y shared types

## Checkpoint: Foundation
- [x] La app Electron inicia y muestra un renderer básico
- [x] La BD SQLite se crea con las tablas iniciales al primer arranque
- [x] IPC funciona entre renderer y main process

## Phase 2: Auth
- [x] Task 5: Registro de usuario y hashing de contraseñas (bcrypt)
- [x] Task 6: Login, logout, sesión persistente y roles
- [x] Task 7: Página de Login y protección de rutas en el frontend

## Checkpoint: Auth
- [x] Puedo registrar un usuario desde la UI
- [x] Puedo iniciar sesión con credenciales válidas
- [x] Las rutas protegidas redirigen al login si no hay sesión

## Phase 3: Productos
- [x] Task 8: CRUD de categorías
- [x] Task 9: CRUD de productos (crear, listar, editar, eliminar)
- [x] Task 10: Página de productos con búsqueda, filtros y paginación

## Checkpoint: Productos
- [x] Puedo crear, editar y eliminar categorías
- [x] Puedo crear, editar y eliminar productos
- [x] La tabla de productos muestra los datos con búsqueda y paginación

## Phase 4: Inventario
- [x] Task 11: Registro de movimientos (entradas, salidas, ajustes)
- [x] Task 12: Actualización automática de stock tras cada movimiento
- [x] Task 13: Dashboard con stock bajo, resumen y estadísticas

## Checkpoint: Inventario
- [x] Un movimiento de entrada incrementa el stock
- [x] Un movimiento de salida decrementa el stock
- [x] Un ajuste corrige el stock al valor indicado
- [x] El dashboard muestra productos con stock bajo alertando al usuario

## Phase 5: Reportes
- [x] Task 14: Reporte de inventario actual y valorización
- [x] Task 15: Reporte de movimientos (historial filtrable por fechas/tipo)
- [x] Task 16: Exportación a PDF (jsPDF) y CSV

## Checkpoint: Reportes
- [x] Puedo ver inventario actual con valorización monetaria
- [x] Puedo filtrar movimientos por fechas y tipo
- [x] Puedo exportar reportes a PDF y CSV

## Phase 6: Configuración y polish
- [x] Task 17: Configuración de datos de empresa
- [x] Task 18: Backup y restore de la BD
- [x] Task 19: Empaquetado con electron-builder (.exe para Windows)

## Checkpoint: Configuración y polish
- [x] Puedo guardar datos de empresa
- [x] Backup genera un archivo restaurable
- [x] Se genera un instalador .exe funcional

## Checkpoint: Complete
- [x] Todos los criterios de éxito del spec cumplidos
- [x] Unit tests pasan (11 tests)
- [x] App empaquetada y funcional en Windows

## Pendientes adicionales completados (post-build)
- [x] Exportación de reportes a PDF (jsPDF + autotable)
- [x] Verificación de backup/restauración (reloadFromFile + recarga automática)
- [x] Usuario administrador por defecto (seed) al primer arranque
- [x] Refactor de lógica de stock a módulo compartido testable
- [x] Tests unitarios (stockLogic + formatters)
- [x] Documentación: INSTALACION.md, MANUAL_USUARIO.md, TECNICO.md, README.md
- [x] Cambio de contraseña (auth:changePassword + sección Configuración + docs + re-empaquetado)
- [x] Recuperación de contraseña por pregunta de seguridad (setSecurityQuestion, getSecurityQuestion, resetPassword + flujo login + docs + re-empaquetado)
- [x] Permisos granulares por rol (shared/permissions.ts + enforce backend + UI + tests + docs + re-empaquetado)
- [x] Pantalla de gestión de usuarios (listUsers protegido, create con rol, delete; Users.tsx + store + ruta + sidebar + tests + docs)
- [x] Moneda configurable por empresa (columna currency + formatters + Settings + páginas)
- [x] Exportación del historial de movimientos a PDF y CSV (Inventory.tsx)
- [x] Importación masiva de productos desde Excel/CSV (xlsx + products:import + UI + plantilla de columnas)

## Fase II — Robustez y completitud (informe senior, tareas 11–16)
- [x] T11 cifrado de la BD en disco (AES-256-GCM + safeStorage, `WHENC01`) y bloqueo de login tras 5 fallos
- [x] T12 más monedas (16) e i18n (es/en/pt)
- [x] T13 notificaciones del sistema (stock bajo)
- [x] T14 onboarding (empresa + moneda) y checklist primeros pasos
- [x] T15 control de lotes y vencimientos (FEFO), múltiples almacenes/transferencias, barcode + lector USB + etiquetas, licenciamiento Pro RSA, auditoría, auto-actualización
- [x] T16 paginación DataTable (20/página) en Auditoría/Productos/Reportes/Usuarios
- [x] `auth:me` + flag `mustChangePassword` (banner al usar la contraseña seed) y reconciliación de sesión
- [x] `auth:deleteUser` protegido (admin, propia cuenta y usuario con movimientos)
- [x] `safeHandle` normalizado (errores tipados) + logs a `userData/logs/app.log` (rotación) + manejadores globales
- [x] Corrección de archivos huérfanos del bundle
- [x] E2E: 78 tests en verde (nuevos `lots`, `audit`, `warehouses`, `password-nudge`, `license-ui`; `users` con protecciones; helper de descargas con sufijo; `launchApp({ forcePro: false })` para probar trial)
- [x] Docs al día (README credencial `admin`, TECNICO §3/§9/§10/§11/§13, plan/todo)
- [x] D13: UI de licencia/updates verificada con `license-ui.spec` (Pro, trial y tarjeta Actualizaciones)
- [ ] Firma digital del instalador (sin certificado: no factible por coste; se mantiene el aviso SmartScreen)
- [ ] Refactor del monolito `ipc-handlers.ts` (deuda técnica documentada en TECNICO §13)
