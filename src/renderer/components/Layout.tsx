import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { OnboardingWizard } from './OnboardingWizard';
import { useLicenseStore } from '../store/licenseStore';
import { useAuthStore } from '../store/authStore';

export function Layout() {
  const fetchStatus = useLicenseStore((s) => s.fetchStatus);
  const isPro = useLicenseStore((s) => s.isPro);
  const isExpired = useLicenseStore((s) => s.isExpired);
  const trialDaysLeft = useLicenseStore((s) => s.status?.trialDaysLeft ?? 0);
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  useEffect(() => {
    if (user) fetchStatus();
  }, [user, fetchStatus]);

  const userId = user?.id;

  useEffect(() => {
    if (userId) refreshUser(userId);
  }, [refreshUser, userId]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        {isExpired && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300">
            El periodo de prueba ha terminado. La aplicación está en modo de solo lectura. Activa una
            licencia en{' '}
            <a href="#/settings" className="font-semibold underline">
              Configuración
            </a>
            .
          </div>
        )}
        {!isPro && !isExpired && (
          <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
            Estás usando la <span className="font-semibold">versión de prueba</span>. Te quedan{' '}
            <span className="font-semibold">{trialDaysLeft} días</span>. Activa una licencia Pro para
            desbloquear todas las funciones.
          </div>
        )}
        {user?.mustChangePassword && (
          <div className="mb-4 rounded-lg bg-sky-50 border border-sky-200 px-4 py-3 text-sm text-sky-700 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-300">
            Estás usando la <span className="font-semibold">contraseña por defecto</span>. Te recomendamos
            cambiarla en{' '}
            <a href="#/settings" className="font-semibold underline">
              Configuración
            </a>
            .
          </div>
        )}
        <Outlet />
      </main>
      <OnboardingWizard />
    </div>
  );
}