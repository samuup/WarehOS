import { useEffect, useState } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import type { DashboardSummary } from '@shared/types';

interface Goal {
  label: string;
  hint: string;
  done: boolean;
}

const GUIDE_HIDDEN_KEY = 'guide_hidden';

export function FirstStepsChecklist({
  summary,
}: {
  summary: DashboardSummary;
}) {
  const { company } = useSettingsStore();
  const [hidden, setHidden] = useState(
    () => {
      try {
        return localStorage.getItem(GUIDE_HIDDEN_KEY) === '1';
      } catch {
        return false;
      }
    },
  );

  const goals: Goal[] = [
    {
      label: 'Completar los datos de tu empresa',
      hint: 'Configuración → Datos de la empresa (nombre, RUC, moneda).',
      done: Boolean(company?.name),
    },
    {
      label: 'Crear una categoría',
      hint: 'Pestaña Productos → botón "Nueva categoría".',
      done: summary.total_categories > 0,
    },
    {
      label: 'Registrar tu primer producto',
      hint: 'Pestaña Productos → "Nuevo producto".',
      done: summary.total_products > 0,
    },
    {
      label: 'Registrar un movimiento de inventario',
      hint: 'Pestaña Inventario → "Nuevo movimiento" (entrada o salida).',
      done: summary.total_movements > 0,
    },
  ];

  const allDone = goals.every((g) => g.done);

  useEffect(() => {
    if (allDone) setHidden(true);
  }, [allDone]);

  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(GUIDE_HIDDEN_KEY, '1');
    } catch {
      // ignore
    }
  };

  const pending = goals.filter((g) => !g.done).length;

  return (
    <div className="card border-primary-200 bg-primary-50/40 dark:border-primary-800/60 dark:bg-primary-950/20 animate-in fade-in duration-300">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100">Primeros pasos</h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/60 dark:text-primary-300">
              {pending} pendientes
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-4 dark:text-slate-400">
            Sugerencias para dejar listo tu inventario. Desaparecen cuando completes todo.
          </p>
          <ul className="space-y-2">
            {goals.map((g) => (
              <li
                key={g.label}
                title={g.hint}
                className={`flex items-center gap-3 text-sm ${
                  g.done ? 'text-gray-400 dark:text-slate-500' : 'text-gray-700 dark:text-slate-300'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold ${
                    g.done
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-300 text-transparent dark:border-slate-600'
                  }`}
                >
                  ✓
                </span>
                {g.label}
                {!g.done && <span className="text-xs text-primary-600 dark:text-primary-400">· {g.hint}</span>}
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={dismiss}
          title="Ocultar guía"
          className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none dark:text-slate-500 dark:hover:text-slate-300"
        >
          ×
        </button>
      </div>
    </div>
  );
}