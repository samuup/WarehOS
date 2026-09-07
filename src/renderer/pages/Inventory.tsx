import { useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, Plus } from 'lucide-react';
import { useInventoryStore } from '../store/inventoryStore';
import { useProductStore } from '../store/productStore';
import { useWarehouseStore } from '../store/warehouseStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { Modal } from '../components/Modal';
import { AlertBadge } from '../components/AlertBadge';
import { ScanInput } from '../components/ScanInput';
import { type Column } from '../components/DataTable';
import { formatDate, MOVEMENT_LABELS, MOVEMENT_COLORS } from '../lib/formatters';
import { useBarcodeScanner } from '../lib/useBarcodeScanner';
import { useLicenseStore } from '../store/licenseStore';
import { api } from '../lib/api';
import { can } from '@shared/permissions';
import type { MovementType, Product, StockMovement, StockMovementInput } from '@shared/types';

export function Inventory() {
  const { movements, fetchMovements, createMovement } = useInventoryStore();
  const { products, fetchProducts } = useProductStore();
  const { warehouses, fetchWarehouses } = useWarehouseStore();
  const { company, fetchCompany } = useSettingsStore();
  const user = useAuthStore((s) => s.user);
  const canManage = can(user?.role, 'inventory.manage');
  const isPro = useLicenseStore((s) => s.isPro);

  const [showMoveModal, setShowMoveModal] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState<number>(0);

  const [form, setForm] = useState<StockMovementInput>({
    product_id: 0,
    type: 'IN',
    quantity: 0,
    note: '',
    warehouse_id: 0,
    destination_warehouse_id: 0,
    batch: '',
    expiry_date: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [barcode, setBarcode] = useState('');
  const [viaScan, setViaScan] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);

  const defaultWarehouse = warehouses.find((w) => w.is_default === 1) || warehouses[0];

  const resetForm = () => {
    setForm({
      product_id: 0,
      type: 'IN',
      quantity: 0,
      note: '',
      warehouse_id: defaultWarehouse?.id ?? 0,
      destination_warehouse_id: 0,
      batch: '',
      expiry_date: '',
    });
    setBarcode('');
    setViaScan(false);
    setError(null);
  };

  const openMoveModal = () => {
    setForm((f) => ({
      ...f,
      warehouse_id: defaultWarehouse?.id ?? f.warehouse_id,
      destination_warehouse_id: 0,
    }));
    setShowMoveModal(true);
  };

  const closeModal = () => {
    setShowMoveModal(false);
    resetForm();
  };

  const handleScannedCode = async (code: string) => {
    setError(null);
    const res = await api.products.getByBarcode(code);
    if (res.success && res.data) {
      const product = res.data as Product;
      setForm((f) => ({ ...f, product_id: product.id, batch: '', expiry_date: '' }));
      setBarcode('');
      setViaScan(true);
      quantityRef.current?.focus();
    } else {
      setBarcode('');
      setError(res.error ?? `No se encontró ningún producto con el código ${code}`);
    }
  };

  useBarcodeScanner(async (code) => {
    openMoveModal();
    await handleScannedCode(code);
  });

  useEffect(() => {
    fetchMovements({
      type: typeFilter || undefined,
      from: from || undefined,
      to: to || undefined,
      warehouse_id: warehouseFilter || undefined,
    });
  }, [typeFilter, from, to, warehouseFilter, fetchMovements]);

  useEffect(() => {
    fetchProducts();
    fetchWarehouses();
    fetchCompany();
  }, [fetchProducts, fetchWarehouses, fetchCompany]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.product_id === 0) {
      setError('Selecciona un producto o escanea su código de barras');
      return;
    }
    if (form.type === 'TRANSFER' && !form.destination_warehouse_id) {
      setError('Selecciona el almacén de destino');
      return;
    }
    if (form.quantity < 0 || (form.quantity === 0 && form.type !== 'ADJUSTMENT')) {
      setError('La cantidad debe ser mayor a 0 (o igual a 0 en un ajuste)');
      return;
    }
    if (!user) return;
    const err = await createMovement(form, user.id);
    if (err) {
      setError(err);
    } else {
      await fetchProducts();
      if (viaScan) {
        setForm({
          product_id: 0,
          type: 'IN',
          quantity: 0,
          note: '',
          warehouse_id: defaultWarehouse?.id ?? 0,
          destination_warehouse_id: 0,
          batch: '',
          expiry_date: '',
        });
        setBarcode('');
        setViaScan(false);
        setError(null);
        window.setTimeout(() => barcodeRef.current?.focus(), 50);
      } else {
        closeModal();
      }
    }
  };

  const selectedProduct = products.find((p) => p.id === form.product_id);

  const stockInWarehouse = (p: Product | undefined, warehouseId: number): number | undefined => {
    if (!p) return undefined;
    if (!warehouseId) return p.current_stock;
    const s = p.stocks?.[warehouseId];
    return s === undefined ? 0 : s;
  };

  const warehouseName = (id?: number | null): string => {
  if (!id) return '—';
  return warehouses.find((w) => w.id === id)?.name ?? '—';
};

  const filtersLabel = [
    typeFilter ? `Tipo: ${MOVEMENT_LABELS[typeFilter]}` : '',
    warehouseFilter ? `Almacén: ${warehouseName(warehouseFilter)}` : '',
    from ? `Desde: ${from}` : '',
    to ? `Hasta: ${to}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const exportPDF = () => {
    const doc = new jsPDF();
    const companyName = company?.name || 'WarehOS';

    doc.setFontSize(16);
    doc.text(companyName, 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    if (company?.address) doc.text(company.address, 14, 24);
    if (company?.phone) doc.text(`Tel: ${company.phone}`, 14, 29);
    doc.text(`Generado el: ${formatDate(new Date().toISOString())}`, 14, 39);
    if (filtersLabel) doc.text(`Filtros: ${filtersLabel}`, 14, 44);

    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text('Reporte de movimientos', 14, 54);

    const totals: Record<string, number> = {};
    for (const m of movements) totals[m.type] = (totals[m.type] || 0) + m.quantity;

    autoTable(doc, {
      startY: 60,
      head: [['Fecha', 'Tipo', 'Producto', 'SKU', 'Almacén', 'Cantidad', 'Stock resultante', 'Usuario']],
      body: movements.map((m) => [
        formatDate(m.created_at),
        MOVEMENT_LABELS[m.type],
        m.product_name || '',
        m.product_sku || '',
        m.type === 'TRANSFER'
          ? `${m.warehouse_name || '—'} → ${m.destination_warehouse_name || '—'}`
          : m.warehouse_name || '—',
        `${m.type === 'IN' ? '+' : m.type === 'ADJUSTMENT' ? '=' : '-'}${m.quantity}`,
        String(m.new_stock),
        m.user_name || '',
      ]),
      foot: [
        [
          'TOTALES',
          '',
          '',
          '',
          '',
          `Entradas: ${totals.IN || 0} · Salidas: ${totals.OUT || 0} · Ajustes: ${totals.ADJUSTMENT || 0} · Transferencias: ${totals.TRANSFER || 0}`,
          '',
          '',
        ],
      ],
      footStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9 },
    });

    doc.save(`movimientos_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportCSV = () => {
    const headers = ['Fecha', 'Tipo', 'Producto', 'SKU', 'Almacén', 'Cantidad', 'Stock resultante', 'Nota', 'Usuario'];
    const rows = movements.map((m) => [
      formatDate(m.created_at),
      MOVEMENT_LABELS[m.type],
      m.product_name || '',
      m.product_sku || '',
      m.type === 'TRANSFER'
        ? `${m.warehouse_name || ''} -> ${m.destination_warehouse_name || ''}`
        : m.warehouse_name || '',
      m.quantity,
      m.new_stock,
      m.note || '',
      m.user_name || '',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movimientos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<StockMovement>[] = [
    {
      key: 'date',
      header: 'Fecha',
      render: (m: StockMovement) => formatDate(m.created_at),
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (m: StockMovement) => (
        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${MOVEMENT_COLORS[m.type]}`}>
          {MOVEMENT_LABELS[m.type]}
        </span>
      ),
    },
    {
      key: 'product_name',
      header: 'Producto',
      render: (m: StockMovement) => (
        <div>
          <p className="font-medium text-gray-800 dark:text-slate-200">{m.product_name}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">SKU: {m.product_sku}</p>
        </div>
      ),
    },
    {
      key: 'warehouse',
      header: 'Almacén',
      render: (m: StockMovement) =>
        m.type === 'TRANSFER'
          ? `${m.warehouse_name ?? '—'} → ${m.destination_warehouse_name ?? '—'}`
          : m.warehouse_name ?? '—',
    },
    {
      key: 'quantity',
      header: 'Cantidad',
      render: (m: StockMovement) => (
        <span
          className={
            m.type === 'OUT' || m.type === 'TRANSFER'
              ? 'text-red-600 font-semibold dark:text-red-400'
              : m.type === 'IN'
                ? 'text-green-600 font-semibold dark:text-green-400'
                : 'text-blue-600 font-semibold dark:text-blue-400'
          }
        >
          {m.type === 'IN' ? '+' : m.type === 'ADJUSTMENT' ? '=' : '-'} {m.quantity}
        </span>
      ),
    },
    {
      key: 'stock',
      header: 'Stock resultante',
      render: (m: StockMovement) => m.new_stock,
    },
    { key: 'note', header: 'Nota', render: (m: StockMovement) => m.note || '—' },
    {
      key: 'user_name',
      header: 'Usuario',
      render: (m: StockMovement) => m.user_name || '—',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Movimientos de inventario</h1>
        <div className="flex gap-3">
          {isPro ? (
            <>
              <button onClick={exportPDF} className="btn-secondary inline-flex items-center gap-2">
                <Download className="w-4 h-4" aria-hidden="true" />
                Exportar PDF
              </button>
              <button onClick={exportCSV} className="btn-secondary inline-flex items-center gap-2">
                <Download className="w-4 h-4" aria-hidden="true" />
                Exportar CSV
              </button>
            </>
          ) : (
            <a
              href="#/settings"
              className="btn-secondary opacity-60"
              title="La exportación requiere la versión Pro. Actívala en Configuración."
            >
              Exportar (Pro)
            </a>
          )}
          {canManage && (
            <button onClick={openMoveModal} className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" aria-hidden="true" />
              Registrar movimiento
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-field max-w-xs">
          <option value="">Todos los tipos</option>
          <option value="IN">Entradas</option>
          <option value="OUT">Salidas</option>
          <option value="ADJUSTMENT">Ajustes</option>
          <option value="TRANSFER">Transferencias</option>
        </select>
        <select
          value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(Number(e.target.value))}
          className="input-field max-w-xs"
        >
          <option value={0}>Todos los almacenes</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-field max-w-xs" />
        <span className="self-center text-gray-400 dark:text-slate-500">a</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input-field max-w-xs" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left dark:bg-slate-800/60">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-3 font-medium text-gray-600 dark:text-slate-400">
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {movements.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">
                  No hay movimientos registrados
                </td>
              </tr>
            ) : (
              movements.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3">
                      {c.render!(m)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showMoveModal && (
        <Modal title="Registrar movimiento de stock" onClose={closeModal}>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && <AlertBadge type="error">{error}</AlertBadge>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">
                Código de barras (lector USB)
              </label>
              <ScanInput
                value={barcode}
                onChange={setBarcode}
                onScan={handleScannedCode}
                autoFocus
                inputRef={barcodeRef}
              />
              <p className="text-xs text-gray-500 mt-1 dark:text-slate-400">
                Escanea el código y el producto se seleccionará automáticamente.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Producto*</label>
              <select
                value={form.product_id}
                onChange={(e) => {
                  setForm({ ...form, product_id: Number(e.target.value), batch: '', expiry_date: '' });
                  setViaScan(false);
                }}
                className="input-field"
                required
              >
                <option value={0}>Seleccionar...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({stockInWarehouse(p, form.warehouse_id ?? 0)} {p.unit})
                  </option>
                ))}
              </select>
              {selectedProduct && (
                <div className={`mt-1 p-2 rounded-lg ${viaScan ? 'bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800' : ''}`}>
                  {viaScan && (
                    <p className="text-xs font-semibold text-green-700 dark:text-green-300">
                      {selectedProduct.name} seleccionado por escaneo
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Stock en {warehouseName(form.warehouse_id)}:{' '}
                    {stockInWarehouse(selectedProduct, form.warehouse_id ?? 0)} {selectedProduct.unit}
                    {form.type === 'TRANSFER' && form.destination_warehouse_id
                      ? ` · Destino actual: ${stockInWarehouse(selectedProduct, form.destination_warehouse_id)}`
                      : ''}
                  </p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Tipo de movimiento</label>
              <div className="flex gap-4">
                {(['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER'] as MovementType[]).map((t) => (
                  <label key={t} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="type"
                      checked={form.type === t}
                      onChange={() => setForm({ ...form, type: t })}
                    />
                    {MOVEMENT_LABELS[t]}
                  </label>
                ))}
              </div>
            </div>
            {form.type === 'TRANSFER' ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">
                    Almacén de origen*
                  </label>
                  <select
                    value={form.warehouse_id}
                    onChange={(e) => setForm({ ...form, warehouse_id: Number(e.target.value) })}
                    className="input-field"
                    required
                  >
                    <option value={0}>Seleccionar...</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">
                    Almacén de destino*
                  </label>
                  <select
                    value={form.destination_warehouse_id}
                    onChange={(e) =>
                      setForm({ ...form, destination_warehouse_id: Number(e.target.value) })
                    }
                    className="input-field"
                    required
                  >
                    <option value={0}>Seleccionar...</option>
                    {warehouses
                      .filter((w) => w.id !== form.warehouse_id)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Almacén*</label>
                <select
                  value={form.warehouse_id}
                  onChange={(e) => setForm({ ...form, warehouse_id: Number(e.target.value) })}
                  className="input-field"
                  required
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedProduct?.track_lots && form.type === 'IN' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Número de lote*</label>
                  <input
                    type="text"
                    value={form.batch ?? ''}
                    onChange={(e) => setForm({ ...form, batch: e.target.value })}
                    placeholder="Ej: L-2026-001"
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">
                    Fecha de vencimiento
                  </label>
                  <input
                    type="date"
                    value={form.expiry_date ?? ''}
                    onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>
            )}

            {selectedProduct?.track_lots && form.type === 'OUT' && (
              <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2 dark:text-indigo-300 dark:bg-indigo-950/40">
                Este producto controla lotes: la salida descuenta del lote que vence primero (FEFO).
              </p>
            )}

            {selectedProduct?.track_lots && form.type === 'TRANSFER' && (
              <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2 dark:text-indigo-300 dark:bg-indigo-950/40">
                Se transferirá el lote que vence primero (FEFO) al almacén de destino.
              </p>
            )}

            {selectedProduct?.track_lots && form.type === 'ADJUSTMENT' && (
              <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2 dark:text-indigo-300 dark:bg-indigo-950/40">
                El nuevo stock se reasigna entre los lotes existentes, preservando los que vencen
                primero. Si el total sube, el excedente se suma al lote que vence más tarde.
              </p>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">
                Cantidad*
                {form.type === 'ADJUSTMENT'
                  ? ' (nuevo stock)'
                  : form.type === 'TRANSFER'
                    ? ' (a transferir)'
                    : ''}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                ref={quantityRef}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Nota</label>
              <textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="input-field"
                rows={2}
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              Registrar
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}