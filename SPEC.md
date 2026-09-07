# Spec: WarehOS — Sistema de Gestión de Inventario Universal

## Objective
Aplicación de escritorio multiplataforma para gestionar inventarios de empresas de cualquier rubro. Permite registrar productos, controlar movimientos de stock (entradas, salidas, ajustes), recibir alertas de stock bajo, y generar reportes. Diseñada para ser usable por negocios pequeños, medianos y grandes sin importar su industria.

### Usuario objetivo
- Empresarios, gerentes de almacén, operadores de inventario
- Personas sin conocimiento técnico avanzado
- Necesitan controlar qué productos tienen, cuántos, dónde están, y qué se movió

### Criterios de éxito
- Un usuario puede registrar un producto en < 30 segundos
- Un usuario puede registrar una entrada o salida de stock en < 15 segundos
- Las alertas de stock bajo se muestran al abrir la app
- Los reportes se generan en < 5 segundos para catálogos de hasta 10,000 productos
- La app funciona sin conexión a internet (100% offline con SQLite local)

## Tech Stack
- **Frontend:** React 18 + TypeScript
- **UI:** Tailwind CSS + componentes propios (sin librería UI externa pesada)
- **Desktop:** Electron 28+
- **Base de datos:** SQLite (via better-sqlite3)
- **Build:** Vite (para el renderer), electron-builder (para empaquetado)
- **State management:** Zustand (ligero, simple)
- **Charts:** Recharts (para reportes)
- **Exportación:** jsPDF + csv-writer (PDF y CSV)
- **Testing:** Vitest (unit), Playwright (e2e)
- **Linting:** ESLint + Prettier

## Commands
```bash
# Instalación
npm install

# Desarrollo
npm run dev          # Inicia Electron + Vite en desarrollo

# Build
npm run build        # Build completo (renderer + main process)
npm run build:win    # Empaquetar para Windows (.exe installer)

# Test
npm run test         # Unit tests con Vitest
npm run test:e2e     # E2E tests con Playwright

# Lint
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run format       # Prettier format
```

## Project Structure
```
warehos/
├── SPEC.md                    # Este archivo
├── package.json
├── vite.config.ts             # Config de Vite para el renderer
├── electron-builder.yml       # Config de empaquetado
├── tailwind.config.js
├── tsconfig.json
├── tasks/
│   ├── plan.md                # Plan de implementación
│   └── todo.md                # Lista de tareas
├── src/
│   ├── main/                  # Process principal de Electron
│   │   ├── index.ts           # Entry point del main process
│   │   ├── database.ts        # Conexión y migraciones SQLite
│   │   ├── ipc-handlers.ts    # Handlers de IPC (comunicación main↔renderer)
│   │   └── preload.ts         # Script preload para exposición segura
│   ├── renderer/              # Process del renderer (React app)
│   │   ├── index.html
│   │   ├── main.tsx           # Entry point React
│   │   ├── App.tsx            # Router principal
│   │   ├── store/             # Zustand stores
│   │   │   ├── authStore.ts
│   │   │   ├── productStore.ts
│   │   │   ├── inventoryStore.ts
│   │   │   └── settingsStore.ts
│   │   ├── pages/             # Páginas/rutas
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Products.tsx
│   │   │   ├── ProductForm.tsx
│   │   │   ├── Inventory.tsx
│   │   │   ├── Reports.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/        # Componentes reutilizables
│   │   │   ├── Layout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── DataTable.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── AlertBadge.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   └── StatCard.tsx
│   │   ├── lib/               # Utilidades
│   │   │   ├── api.ts         # Wrapper del bridge IPC
│   │   │   └── formatters.ts  # Formateo de fechas, monedas, etc.
│   │   └── styles/
│   │       └── globals.css    # Estilos Tailwind base
│   ├── shared/                # Código compartido entre main y renderer
│   │   └── types.ts           # Tipos TypeScript compartidos
│   └── test/
│       ├── setup.ts
│       └── unit/
│           └── database.test.ts
├── e2e/
│   └── inventory.spec.ts
└── build/
    └── icon.ico               # Icono de la app
```

## Code Style
```typescript
// Convención: funciones en camelCase, componentes en PascalCase
// Archivos de componentes: PascalCase.tsx
// Archivos de utilidades: camelCase.ts
// Interfaces/tipos: PascalCase, prefijo con I si es interface

// Ejemplo de componente:
interface ProductFormProps {
  onSubmit: (product: ProductInput) => void;
  initialData?: Product;
}

export function ProductForm({ onSubmit, initialData }: ProductFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name }); }}>
      <input value={name} onChange={(e) => setName(e.target.value)} />
    </form>
  );
}

// Ejemplo de store Zustand:
interface AuthStore {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  login: async (email, password) => { /* ... */ },
  logout: () => set({ user: null }),
}));
```

### Convenciones clave:
- Funciones nombradas (no arrow functions para componentes)
- Tailwind para todo el estilos (no CSS modules, no styled-components)
- Imports: `@/` alias para `src/`
- Sin comentarios en el código (el código debe ser autoexplicativo)
- Manejo de errores con try/catch, nunca silenciar errores

## Testing Strategy
- **Unit tests:** Vitest para lógica de stores, utilidades, y handlers IPC
  - Cobertura mínima: 70% en lógica de negocio
  - Ubicación: `src/test/unit/`
- **E2E tests:** Playwright para flujos principales (58 specs en verde)
  - Flujos: login y roles, productos, movimientos, categorías, importación, dashboard, reportes, exportación CSV/PDF, configuración de empresa/moneda, contraseña, recuperación por pregunta de seguridad, usuarios, auditoría de permisos, backup y Pro
  - Ubicación: `src/test/e2e/`
- **Smoke test:** Al build, verificar que la app inicia sin errores

## Boundaries
- **Always:** Ejecutar tests antes de commits, validar inputs del usuario, usar tipos TypeScript estrictos
- **Ask first:** Cambiar esquema de BD, agregar dependencias nuevas, cambiar configuración de build
- **Never:** Commitear secrets/credenciales, usar `any` en TypeScript, silenciar errores con catch vacío, hardcodear valores de configuración

## Success Criteria
1. La app inicia y muestra el dashboard con productos con stock bajo
2. Un usuario puede autenticarse (admin por defecto)
3. CRUD completo de productos con categorías y unidades
4. Registro de entradas, salidas y ajustes de inventario
5. El stock actual se actualiza en tiempo real después de cada movimiento
6. Alertas visuales cuando un producto alcanza su stock mínimo
7. Reportes de inventario actual, valorización y historial de movimientos
8. Exportación de reportes a PDF y CSV
9. Configuración de datos de empresa y backup/restore de la BD
10. Build funcional para Windows (.exe)

## Open Questions
- Ninguna — todos los requisitos están definidos en este spec.
