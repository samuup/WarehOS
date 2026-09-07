import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { api } from '../lib/api';
import { formatExpiry, expiryStatus, expiryStatusLabel } from '../lib/formatters';
import type { Product, Lot, SettingsInfo } from '@shared/types';

const STATUS_COLORS: Record<string, string> = {
  expired: 'text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-950/40',
  near: 'text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/40',
  ok: 'text-green-600 bg-green-50 dark:text-green-300 dark:bg-green-950/40',
};

const DEFAULT_THRESHOLD = 30;

export function LotsModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [lotsRes, settingsRes] = await Promise.all([
        api.lots.list(product.id),
        api.settings.get() as Promise<{ success: boolean; data?: SettingsInfo }>,
      ]);
      if (lotsRes.success && lotsRes.data) setLots(lotsRes.data);
      if (settingsRes.success && settingsRes.data) {
        setThreshold(settingsRes.data.expiry_threshold_days ?? DEFAULT_THRESHOLD);
      }
    })().catch(() => setError('No se pudieron cargar los lotes'));
  }, [product.id]);

  return (
    <Modal title={`Lotes de ${product.name}`} onClose={onClose}>
      {error && <p className="text-sm text-red-600 mb-3 dark:text-red-400">{error}</p>}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left dark:bg-slate-800/60">
            <tr>
              <th className="px-4 py-2.5 font-medium text-gray-600 dark:text-slate-400">Lote</th>
              <th className="px-4 py-2.5 font-medium text-gray-600 dark:text-slate-400">Vence</th>
              <th className="px-4 py-2.5 font-medium text-gray-600 dark:text-slate-400">Almacén</th>
              <th className="px-4 py-2.5 font-medium text-gray-600 dark:text-slate-400 text-right">Cantidad</th>
              <th className="px-4 py-2.5 font-medium text-gray-600 dark:text-slate-400">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {lots.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">
                  Este producto aún no tiene lotes registrados
                </td>
              </tr>
            ) : (
              lots.map((l) => {
                const status = expiryStatus(l.expiry_date, threshold);
                return (
                  <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-slate-200">{l.batch}</td>
                    <td className="px-4 py-2.5 dark:text-slate-300">{formatExpiry(l.expiry_date)}</td>
                    <td className="px-4 py-2.5 dark:text-slate-300">{l.warehouse_name || '—'}</td>
                    <td className="px-4 py-2.5 text-right dark:text-slate-300">
                      {l.quantity} {product.unit}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${l.expiry_date ? (STATUS_COLORS[status] ?? STATUS_COLORS.ok) : 'text-gray-500 bg-gray-100 dark:text-slate-400 dark:bg-slate-700'}`}>
                        {l.expiry_date ? expiryStatusLabel(status) : 'Sin fecha'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-between items-center">
        <p className="text-xs text-gray-400 dark:text-slate-500">
          Salidas y transferencias descuentan del lote que vence primero (FEFO).
        </p>
        <button onClick={onClose} className="btn-primary">
          Cerrar
        </button>
      </div>
    </Modal>
  );
}