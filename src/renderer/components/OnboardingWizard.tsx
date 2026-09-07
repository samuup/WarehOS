import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { AlertBadge } from './AlertBadge';
import { CURRENCIES } from '@shared/currencies';
import { can } from '@shared/permissions';

const ONBOARDING_DISMISSED_KEY = 'onboarding_dismissed';

export function OnboardingWizard() {
  const user = useAuthStore((s) => s.user);
  const { company, fetchCompany, updateCompany } = useSettingsStore();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState({
    name: '',
    tax_id: '',
    phone: '',
    email: '',
    address: '',
    currency: 'PEN',
  });
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  useEffect(() => {
    if (company) {
      setDraft({
        name: company.name || '',
        tax_id: company.tax_id || '',
        phone: company.phone || '',
        email: company.email || '',
        address: company.address || '',
        currency: company.currency || 'PEN',
      });
    }
  }, [company]);

  const canManage = can(user?.role, 'settings.manage');

  const dismissed = (() => {
    try {
      return localStorage.getItem(ONBOARDING_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  })();

  if (!user || !canManage || done || dismissed || (company !== null && company.name !== '')) {
    return null;
  }

  const skip = () => {
    try {
      localStorage.setItem(ONBOARDING_DISMISSED_KEY, '1');
    } catch {
      // ignore
    }
    setDone(true);
  };

  const setField = (key: keyof typeof draft, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFieldError(null);
    if (!draft.name.trim()) {
      setFieldError('El nombre de la empresa es obligatorio');
      return;
    }
    setSaving(true);
    const err = await updateCompany({
      name: draft.name.trim(),
      address: draft.address.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim(),
      tax_id: draft.tax_id.trim(),
      currency: draft.currency,
    });
    setSaving(false);
    if (err) {
      setFieldError(err);
      return;
    }
    setDone(true);
  };

  return (
    <Modal title="Bienvenido a WarehOS" onClose={skip}>
      {step === 1 ? (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-slate-300">
            Este asistente te ayuda a dejar lista tu configuración inicial en menos de un minuto.
          </p>
          <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside dark:text-slate-400">
            <li>Configura los datos de tu empresa</li>
            <li>Elige tu moneda (soles, dólares, euros y más)</li>
            <li>Empieza a registrar productos y movimientos</li>
          </ul>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={skip} className="btn-secondary">
              Omitir
            </button>
            <button type="button" onClick={() => setStep(2)} className="btn-primary">
              Continuar
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          {fieldError && <AlertBadge type="error">{fieldError}</AlertBadge>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Nombre de la empresa *</label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setField('name', e.target.value)}
              className="input-field"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">RUC / ID fiscal</label>
              <input
                type="text"
                value={draft.tax_id}
                onChange={(e) => setField('tax_id', e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Teléfono</label>
              <input
                type="text"
                value={draft.phone}
                onChange={(e) => setField('phone', e.target.value)}
                className="input-field"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Email de contacto</label>
              <input
                type="email"
                value={draft.email}
                onChange={(e) => setField('email', e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Dirección</label>
              <input
                type="text"
                value={draft.address}
                onChange={(e) => setField('address', e.target.value)}
                className="input-field"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Moneda</label>
            <select
              value={draft.currency}
              onChange={(e) => setField('currency', e.target.value)}
              className="input-field"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={skip} className="btn-secondary">
              Omitir
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Guardando...' : 'Guardar y empezar'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}