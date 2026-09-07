import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  RefreshCw,
  Warehouse,
  BarChart3,
  Users,
  ScrollText,
  Settings,
  Sun,
  Moon,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useLicenseStore } from '../store/licenseStore';
import { useThemeStore } from '../store/settingsStore';
import { can } from '@shared/permissions';
import { useI18n } from '../lib/i18n';

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isPro = useLicenseStore((s) => s.isPro);
  const isExpired = useLicenseStore((s) => s.isExpired);
  const trialDaysLeft = useLicenseStore((s) => s.status?.trialDaysLeft ?? 0);
  const { t } = useI18n();
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const navItems = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard },
    { to: '/products', label: t('nav.products'), icon: Package },
    { to: '/inventory', label: t('nav.inventory'), icon: RefreshCw },
    ...(can(user?.role, 'settings.manage') ? [{ to: '/warehouses', label: t('nav.warehouses'), icon: Warehouse }] : []),
    { to: '/reports', label: t('nav.reports'), icon: BarChart3 },
    ...(can(user?.role, 'users.manage') ? [{ to: '/users', label: t('nav.users'), icon: Users }] : []),
    ...(can(user?.role, 'audit.view') ? [{ to: '/audit', label: t('nav.audit'), icon: ScrollText }] : []),
    { to: '/settings', label: t('nav.settings'), icon: Settings },
  ];

  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col overflow-hidden">
      <div className="p-6 border-b border-gray-700 shrink-0">
        <h1 className="text-xl font-bold text-primary-400">WarehOS</h1>
        <p className="text-xs text-gray-400 mt-1">Gestión de Inventario</p>
      </div>

      <nav className="sidebar-nav flex-1 min-h-0 overflow-y-auto p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5 shrink-0" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-700 shrink-0">
        <div className={`mb-3 rounded-lg px-3 py-2 text-xs font-semibold ${
          isPro
            ? 'bg-green-900 text-green-300'
            : isExpired
              ? 'bg-red-900 text-red-300'
              : 'bg-amber-900 text-amber-300'
        }`}>
          {isPro ? 'Versión Pro' : isExpired ? 'Prueba finalizada' : `Prueba · ${trialDaysLeft} días`}
        </div>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-bold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-gray-400">{t(`role.${user?.role}`)}</p>
          </div>
        </div>
        <button
          onClick={() => setTheme(nextTheme)}
          title={`Cambiar a modo ${nextTheme === 'dark' ? 'oscuro' : 'claro'}`}
          aria-label="Cambiar tema"
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors mb-2"
        >
          {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
          {resolvedTheme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>
        <button
          onClick={logout}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}