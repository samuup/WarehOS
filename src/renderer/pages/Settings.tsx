import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useSettingsStore, useThemeStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { useLicenseStore } from '../store/licenseStore';
import { useUpdateStore } from '../store/updateStore';
import { AlertBadge } from '../components/AlertBadge';
import { api } from '../lib/api';
import { can } from '@shared/permissions';
import { CURRENCIES } from '@shared/currencies';
import { useI18n, LANGUAGE_OPTIONS } from '../lib/i18n';
import { isValidBackupPassword } from '@shared/validation';
import type { CompanyInput } from '@shared/types';

export function Settings() {
  const { t, lang, setLang } = useI18n();
  const { company, fetchCompany, updateCompany } = useSettingsStore();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const user = useAuthStore((s) => s.user);
  const canManageSettings = can(user?.role, 'settings.manage');
  const [form, setForm] = useState<CompanyInput>({
    name: '',
    address: '',
    phone: '',
    email: '',
    tax_id: '',
    currency: 'PEN',
  });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [sq, setSq] = useState({ question: '', answer: '' });
  const [sqStatus, setSqStatus] = useState<{ set: boolean; question: string }>({ set: false, question: '' });
  const [key, setKey] = useState('');
  const [keyStatus, setKeyStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expiryDays, setExpiryDays] = useState(30);
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyInterval, setNotifyInterval] = useState(60);

  const { status, fetchStatus, activate, isPro } = useLicenseStore();
  const {
    status: upd,
    subscribe: subscribeUpdates,
    check: checkUpdates,
    install: installUpdates,
    setConfig: setUpdateConfig,
  } = useUpdateStore();
  const [updateDraft, setUpdateDraft] = useState({ feedUrl: '', autoCheck: false });
  const [updateSynced, setUpdateSynced] = useState(false);

  useEffect(() => {
    subscribeUpdates();
  }, [subscribeUpdates]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  useEffect(() => {
    api.settings.get().then((res) => {
      if (res.success && res.data) {
        setExpiryDays(res.data.expiry_threshold_days ?? 30);
        setNotifyEnabled(res.data.notify_low_stock ?? false);
        setNotifyInterval(res.data.notify_interval_min ?? 60);
      }
    });
  }, []);

  const handleSaveExpiry = async () => {
    if (!user) return;
    setError(null);
    setSuccess(null);
    const res = await api.settings.update({ expiry_threshold_days: expiryDays }, user.id);
    if (res.success) {
      setSuccess('Umbral de vencimiento actualizado.');
    } else {
      setError(res.error || 'No se pudo actualizar el umbral.');
    }
  };

  const handleSaveNotify = async () => {
    if (!user) return;
    setError(null);
    setSuccess(null);
    const res = await api.settings.update(
      { notify_low_stock: notifyEnabled, notify_interval_min: notifyInterval },
      user.id,
    );
    if (res.success) {
      setSuccess('Preferencias de notificación guardadas.');
    } else {
      setError(res.error || 'No se pudieron guardar las preferencias de notificación.');
    }
  };

  const handleTestNotification = async () => {
    if (!user) return;
    setError(null);
    setSuccess(null);
    const res = await api.notifications.test(user.id);
    if (res.success && res.data?.shown) {
      setSuccess('Notificación de prueba enviada.');
    } else {
      setError('El sistema operativo no soporta notificaciones en este equipo.');
    }
  };

  useEffect(() => {
    if (user) {
      api.auth.getSecurityQuestion(user.username).then((res) => {
        if (res.success && res.data) setSqStatus(res.data);
      });
    }
  }, [user]);

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name,
        address: company.address,
        phone: company.phone,
        email: company.email,
        tax_id: company.tax_id,
        currency: company.currency || 'PEN',
      });
    }
  }, [company]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const err = await updateCompany(form);
    if (err) setError(err);
    else setSuccess('Datos guardados correctamente');
  };

  const handleBackup = async () => {
    const defaultName = `backup_inventario_${new Date().toISOString().slice(0, 10)}.db`;
    const path = prompt('Ruta de archivo de backup:', defaultName);
    if (!path || !user) return;
    const password = prompt('Contraseña para cifrar el backup (mínimo 8 caracteres):');
    if (password == null) return;
    if (!isValidBackupPassword(password)) {
      setError('La contraseña del backup debe tener al menos 8 caracteres');
      return;
    }
    const res = await api.backup.export(path, password, user.id);
    if (res.success) setSuccess('Backup exportado correctamente (cifrado con contraseña)');
    else setError(res.error || 'Error al exportar backup');
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setKeyStatus(null);
    if (!user) return;
    const err = await activate(key, user.id);
    if (err) setKeyStatus(err);
    else {
      setKey('');
      setSuccess('Licencia activada correctamente');
    }
  };

  const handleCopyHash = async () => {
    if (!status) return;
    await navigator.clipboard.writeText(status.machineHash);
    setSuccess('Código de máquina copiado al portapapeles');
  };

  const handleRestore = async () => {
    const path = prompt('Ruta del archivo de backup a restaurar:');
    if (!path || !user) return;
    const password = prompt('Contraseña del backup (déjala vacía si es un backup antiguo sin cifrar):') ?? '';
    const res = await api.backup.import(path, password, user.id);
    if (res.success) {
      setSuccess('Backup restaurado correctamente. Recargando datos...');
      setTimeout(() => window.location.reload(), 1200);
    } else {
      setError(res.error || 'Error al restaurar backup');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!user) return;
    if (pw.next !== pw.confirm) {
      setError('La confirmación de la nueva contraseña no coincide');
      return;
    }
    if (pw.next.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    const res = await api.auth.changePassword({
      userId: user.id,
      currentPassword: pw.current,
      newPassword: pw.next,
    });
    if (res.success) {
      setSuccess('Contraseña actualizada correctamente');
      setPw({ current: '', next: '', confirm: '' });
    } else {
      setError(res.error || 'Error al cambiar la contraseña');
    }
  };

  const handleSetSecurityQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!user) return;
    if (!sq.question.trim()) { setError('Ingresa una pregunta de seguridad'); return; }
    if (!sq.answer.trim()) { setError('Ingresa la respuesta de seguridad'); return; }
    const res = await api.auth.setSecurityQuestion({
      userId: user.id,
      question: sq.question.trim(),
      answer: sq.answer.trim(),
    });
    if (res.success) {
      setSuccess('Pregunta de seguridad guardada correctamente');
      setSqStatus({ set: true, question: sq.question.trim() });
      setSq({ question: '', answer: '' });
    } else {
      setError(res.error || 'Error al guardar la pregunta de seguridad');
    }
  };

  const update = <K extends keyof CompanyInput>(key: K, value: CompanyInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (!updateSynced && upd) {
      setUpdateDraft({ feedUrl: upd.feedUrl ?? '', autoCheck: upd.autoCheck });
      setUpdateSynced(true);
    }
  }, [upd, updateSynced]);

  const handleSaveUpdateConfig = async () => {
    setError(null);
    setSuccess(null);
    if (!user) return;
    const err = await setUpdateConfig(
      { feedUrl: updateDraft.feedUrl, autoCheck: updateDraft.autoCheck },
      user.id,
    );
    if (err) setError(err);
    else {
      setSuccess('Configuración de actualizaciones guardada correctamente');
      setUpdateSynced(false);
    }
  };

  const handleCheckUpdates = async () => {
    setError(null);
    setSuccess(null);
    if (!user) return;
    const err = await checkUpdates(user.id);
    if (err) setError(err);
  };

  const handleInstallUpdate = async () => {
    setError(null);
    setSuccess(null);
    if (!user) return;
    const err = await installUpdates(user.id);
    if (err) setError(err);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Configuración</h1>

      {error && <AlertBadge type="error">{error}</AlertBadge>}
      {success && <AlertBadge type="success">{success}</AlertBadge>}

      {!canManageSettings && (
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Solo un administrador puede modificar los datos de la empresa, gestionar copias de seguridad o administrar usuarios.
          </p>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 dark:text-slate-100">Licencia</h2>
        {status?.activated ? (
          <div className="space-y-2">
            <AlertBadge type="success">
              Versión Pro activada
              {status.customer ? ` para ${status.customer}` : ''}
              {status.expiresAt ? ` · válida hasta ${new Date(status.expiresAt).toLocaleDateString()}` : ' · licencia perpetua'}
            </AlertBadge>
          </div>
        ) : status?.edition === 'trial_expired' ? (
          <AlertBadge type="error">
            El periodo de prueba ha terminado. La aplicación está en modo de solo lectura.
          </AlertBadge>
        ) : (
          <AlertBadge type="warning">
            Estás usando la versión de prueba: te quedan {status?.trialDaysLeft ?? 0} días. La versión
            Pro desbloquea la importación masiva, la exportación de reportes, las etiquetas de código
            de barras y las copias de seguridad.
          </AlertBadge>
        )}
        {status?.tampered && (
          <AlertBadge type="error">
            Detectamos cambios en la fecha/reloj del equipo. El periodo de prueba continúa contando y
            no se puede reiniciar manipulando el reloj. Si consideras que es un error, contacta a tu
            proveedor.
          </AlertBadge>
        )}
        <p className="text-sm text-gray-500 mt-4 mb-2 dark:text-slate-400">
          Para activar tu licencia envía este código de máquina a tu vendedor:
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded bg-gray-100 px-3 py-2 text-xs break-all dark:bg-slate-700 dark:text-slate-200">
            {status?.machineHash || 'Cargando...'}
          </code>
          <button onClick={handleCopyHash} className="btn-secondary whitespace-nowrap">
            Copiar
          </button>
        </div>
        {canManageSettings && (
          <form onSubmit={handleActivate} className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Clave de licencia</label>
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Pega aquí tu clave de licencia"
                className="input-field"
              />
            </div>
            {keyStatus && <AlertBadge type="error">{keyStatus}</AlertBadge>}
            <div className="flex justify-end">
              <button type="submit" className="btn-primary" disabled={!key.trim()}>
                Activar licencia
              </button>
            </div>
          </form>
        )}
      </div>

      {canManageSettings && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 dark:text-slate-100">Datos de la empresa</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Nombre de la empresa</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Dirección</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
              className="input-field"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Teléfono</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className="input-field"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">RUC / ID Fiscal</label>
            <input
              type="text"
              value={form.tax_id}
              onChange={(e) => update('tax_id', e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Moneda</label>
            <select
              value={form.currency}
              onChange={(e) => update('currency', e.target.value)}
              className="input-field"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary">
              Guardar empresa
            </button>
          </div>
        </form>
      </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 dark:text-slate-100">{t('common.language')}</h2>
        <p className="text-sm text-gray-500 mb-4 dark:text-slate-400">
          El idioma se aplica a la interfaz principal (menú, inicio de sesión y encabezados).
        </p>
        <div className="flex gap-2">
          {LANGUAGE_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setLang(o.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                lang === o.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 dark:text-slate-100">Apariencia</h2>
        <p className="text-sm text-gray-500 mb-4 dark:text-slate-400">
          Elige cómo se ve la aplicación: claro, oscuro o siguiendo la configuración del sistema.
        </p>
        <div className="flex gap-2">
          {(
            [
              { value: 'light', label: 'Claro', icon: Sun },
              { value: 'dark', label: 'Oscuro', icon: Moon },
              { value: 'system', label: 'Sistema', icon: Monitor },
            ] as const
          ).map((o) => (
            <button
              key={o.value}
              onClick={() => setTheme(o.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                theme === o.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              <o.icon className="w-4 h-4" aria-hidden="true" />
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 dark:text-slate-100">Notificaciones del sistema</h2>
        <p className="text-sm text-gray-500 mb-4 dark:text-slate-400">
          La aplicación puede avisarte con una notificación nativa cuando algún producto quede
          en o por debajo de su stock mínimo.
        </p>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyEnabled}
              disabled={!canManageSettings}
              onChange={(e) => setNotifyEnabled(e.target.checked)}
              className="w-4 h-4 accent-primary-600"
            />
            <span className="text-sm text-gray-700 dark:text-slate-300">Activar alertas de stock bajo</span>
          </label>
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">
                Revisar cada (minutos)
              </label>
              <input
                type="number"
                min={5}
                max={1440}
                value={notifyInterval}
                disabled={!canManageSettings}
                onChange={(e) => setNotifyInterval(Number(e.target.value))}
                className="input-field w-32"
              />
            </div>
            <button onClick={handleSaveNotify} disabled={!canManageSettings} className="btn-primary">
              Guardar
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleTestNotification}
              disabled={!canManageSettings}
              className="btn-secondary"
            >
              Probar notificación
            </button>
          </div>
        </div>
        {!canManageSettings && (
          <p className="text-xs text-gray-400 mt-2 dark:text-slate-500">
            Solo un administrador puede modificar este valor.
          </p>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 dark:text-slate-100">Alertas de vencimiento</h2>
        <p className="text-sm text-gray-500 mb-4 dark:text-slate-400">
          Los productos con control de lotes se marcan como "por vencer" en el dashboard cuando
          les quedan menos días que este umbral antes de la fecha de vencimiento.
        </p>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">
              Días de anticipación
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={expiryDays}
              disabled={!canManageSettings}
              onChange={(e) => setExpiryDays(Number(e.target.value))}
              className="input-field w-32"
            />
          </div>
          <button onClick={handleSaveExpiry} disabled={!canManageSettings} className="btn-primary">
            Guardar
          </button>
        </div>
        {!canManageSettings && (
          <p className="text-xs text-gray-400 mt-2 dark:text-slate-500">
            Solo un administrador puede modificar este valor.
          </p>
        )}
      </div>

      {canManageSettings && (
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 dark:text-slate-100">Backup y restauración</h2>
        <p className="text-sm text-gray-500 mb-4 dark:text-slate-400">
          Las copias de seguridad se cifran con una contraseña (mínimo 8 caracteres) y son
          portables a cualquier computadora. Guarda esa contraseña en un lugar seguro o no
          podrás restaurar el backup.
          <span className="text-amber-600 font-medium"> Disponible en la versión Pro.</span>
        </p>
        {isPro ? (
          <div className="flex gap-3">
            <button onClick={handleBackup} className="btn-primary">
              Exportar copia de seguridad
            </button>
            <button onClick={handleRestore} className="btn-secondary">
              Restaurar desde backup
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-slate-500">
            Esta función requiere una licencia Pro. Actívale en la sección "Licencia".
          </p>
        )}
      </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 dark:text-slate-100">Actualizaciones</h2>
        <p className="text-sm text-gray-500 mb-2 dark:text-slate-400">
          Versión instalada: <span className="font-medium">{upd?.currentVersion || '-'}</span>
        </p>
        {upd && !upd.enabled && (
          <AlertBadge type="warning">{upd.disabledReason}</AlertBadge>
        )}
        {upd?.state === 'checking' && (
          <p className="text-sm text-gray-600 dark:text-slate-300">Buscando actualizaciones...</p>
        )}
        {upd?.state === 'downloading' && (
          <div className="mt-2">
            <p className="text-sm text-gray-600 dark:text-slate-300">
              Descargando la nueva versión {upd.info?.version ?? ''}...
            </p>
            {upd.progress && (
              <>
                <div className="mt-2 h-2 w-full overflow-hidden rounded bg-gray-200 dark:bg-slate-700">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${Math.min(100, upd.progress.percent)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1 dark:text-slate-400">
                  {Math.round(upd.progress.percent)}%
                </p>
              </>
            )}
          </div>
        )}
        {upd?.state === 'downloaded' && (
          <div className="mt-2 space-y-3">
            <AlertBadge type="success">
              La versión {upd.info?.version ?? ''} se descargó correctamente.
            </AlertBadge>
            <button onClick={handleInstallUpdate} className="btn-primary">
              Reiniciar e instalar
            </button>
          </div>
        )}
        {upd?.state === 'not-available' && (
          <p className="text-sm text-gray-600 dark:text-slate-300">
            Ya tienes la versión más reciente instalada.
          </p>
        )}
        {upd?.state === 'error' && (
          <AlertBadge type="error">
            {upd.error || 'No se pudo comprobar las actualizaciones.'}
          </AlertBadge>
        )}
        {canManageSettings && (
          <div className="mt-4 space-y-4 border-t border-gray-200 pt-4 dark:border-slate-700">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">
                URL de un servidor propio de actualizaciones (opcional, avanzado)
              </label>
              <input
                type="text"
                value={updateDraft.feedUrl}
                onChange={(e) =>
                  setUpdateDraft((d) => ({ ...d, feedUrl: e.target.value }))
                }
                placeholder="https://tu-servidor.com/actualizaciones/"
                className="input-field"
              />
              <p className="text-xs text-gray-400 mt-1 dark:text-slate-500">
                Déjala vacía para usar las actualizaciones vía GitHub Releases (configuradas al
                empaquetar la aplicación).
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={updateDraft.autoCheck}
                onChange={(e) =>
                  setUpdateDraft((d) => ({ ...d, autoCheck: e.target.checked }))
                }
                className="h-4 w-4"
              />
              Buscar actualizaciones automáticamente al iniciar la aplicación
            </label>
            <div className="flex gap-3">
              <button onClick={handleSaveUpdateConfig} className="btn-secondary">
                Guardar configuración
              </button>
              <button
                onClick={handleCheckUpdates}
                className="btn-primary"
                disabled={upd?.state === 'checking'}
              >
                Buscar actualizaciones
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 dark:text-slate-100">Cambiar contraseña</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Contraseña actual</label>
            <input
              type="password"
              value={pw.current}
              onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
              className="input-field"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Nueva contraseña</label>
            <input
              type="password"
              value={pw.next}
              onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
              className="input-field"
              autoComplete="new-password"
            />
            <p className="text-xs text-gray-400 mt-1 dark:text-slate-500">Mínimo 6 caracteres</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Confirmar nueva contraseña</label>
            <input
              type="password"
              value={pw.confirm}
              onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
              className="input-field"
              autoComplete="new-password"
            />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary">
              Cambiar contraseña
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 dark:text-slate-100">Pregunta de seguridad</h2>
        <p className="text-sm text-gray-500 mb-4 dark:text-slate-400">
          Configura una pregunta de seguridad para poder recuperar tu contraseña si la olvidas.
        </p>
        {sqStatus.set && (
          <p className="text-sm text-gray-600 mb-4 dark:text-slate-300">
            Pregunta actual: <span className="font-medium">{sqStatus.question}</span>
          </p>
        )}
        <form onSubmit={handleSetSecurityQuestion} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Pregunta de seguridad</label>
            <input
              type="text"
              value={sq.question}
              onChange={(e) => setSq((p) => ({ ...p, question: e.target.value }))}
              placeholder="Ej: ¿Cuál es el nombre de tu primera mascota?"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Respuesta</label>
            <input
              type="text"
              value={sq.answer}
              onChange={(e) => setSq((p) => ({ ...p, answer: e.target.value }))}
              className="input-field"
            />
            <p className="text-xs text-gray-400 mt-1 dark:text-slate-500">La respuesta se guardará de forma segura y no se mostrará.</p>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary">
              {sqStatus.set ? 'Actualizar pregunta' : 'Guardar pregunta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}