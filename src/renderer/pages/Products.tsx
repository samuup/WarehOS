import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useProductStore } from '../store/productStore';
import { useWarehouseStore } from '../store/warehouseStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { DataTable, type Column } from '../components/DataTable';
import { SearchBar } from '../components/SearchBar';
import { Modal } from '../components/Modal';
import { AlertBadge } from '../components/AlertBadge';
import { BarcodeLabelModal } from '../components/BarcodeLabelModal';
import { LotsModal } from '../components/LotsModal';
import { formatCurrency, formatExpiry, expiryStatus } from '../lib/formatters';
import { useBarcodeScanner } from '../lib/useBarcodeScanner';
import { useLicenseStore } from '../store/licenseStore';
import { can } from '@shared/permissions';
import type { Product, CategoryInput, ImportResult } from '@shared/types';

export function Products() {
  const {
    products,
    categories,
    loading,
    fetchProducts,
    fetchCategories,
    createCategory,
    deleteProduct,
    importProducts,
  } = useProductStore();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const { warehouses, fetchWarehouses } = useWarehouseStore();
  const { company, fetchCompany } = useSettingsStore();
  const canManage = can(role, 'products.manage');
  const canManageCats = can(role, 'categories.manage');
  const isPro = useLicenseStore((s) => s.isPro);
  const currency = company?.currency || 'PEN';

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | 0>(0);
  const [warehouseFilter, setWarehouseFilter] = useState<number>(0);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [labelProduct, setLabelProduct] = useState<Product | null>(null);
  const [lotsProduct, setLotsProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchWarehouses();
    fetchCompany();
  }, [fetchCategories, fetchWarehouses, fetchCompany]);

  useEffect(() => {
    fetchProducts({
      search,
      category_id: categoryFilter || undefined,
      warehouse_id: warehouseFilter || undefined,
    });
  }, [search, categoryFilter, warehouseFilter, fetchProducts]);

  useBarcodeScanner((code) => setSearch(code));

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const err = await createCategory({ name: catName, description: catDesc } as CategoryInput);
    if (err) {
      setError(err);
    } else {
      setShowCategoryModal(false);
      setCatName('');
      setCatDesc('');
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteError(null);
    const err = await deleteProduct(id);
    if (err) setDeleteError(err);
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    const res = await importProducts();
    setImporting(false);
    if (res) {
      setImportResult(res);
    } else {
      setError('No se pudo importar el archivo');
    }
  };

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Producto',
      render: (p: Product) => (
        <div>
          <p className="font-medium text-gray-800 dark:text-slate-200">{p.name}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            SKU: {p.sku}
            {p.barcode ? ` · Código: ${p.barcode}` : ''}
          </p>
        </div>
      ),
    },
    { key: 'category_name', header: 'Categoría', render: (p: Product) => p.category_name || '—' },
    {
      key: 'current_stock',
      header: 'Stock',
      render: (p: Product) => {
        const breakdown =
          warehouseFilter === 0
            ? warehouses.reduce<string[]>((acc, w) => {
                const s = p.stocks?.[w.id];
                if (s !== undefined && s !== 0) acc.push(`${w.name}: ${s}`);
                return acc;
              }, [])
            : [];
        return (
          <div>
            <span className={p.current_stock <= p.stock_min && p.stock_min > 0 ? 'text-red-600 font-semibold dark:text-red-400' : ''}>
              {p.current_stock} {p.unit}
            </span>
            {breakdown.length > 0 && (
              <p className="text-xs text-gray-400 dark:text-slate-500">{breakdown.join(' · ')}</p>
            )}
          </div>
        );
      },
    },
    { key: 'stock_min', header: 'Stock mín.', render: (p: Product) => `${p.stock_min} ${p.unit}` },
    {
      key: 'lots',
      header: 'Lotes / Vencimiento',
      render: (p: Product) =>
        p.track_lots ? (
          <div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLotsProduct(p);
              }}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              Ver lotes
            </button>
            {p.min_expiry && (
              <p
                className={`text-xs mt-0.5 ${
                  expiryStatus(p.min_expiry, 30) === 'expired' ? 'text-red-600 font-medium dark:text-red-400' : 'text-gray-400 dark:text-slate-500'
                }`}
              >
                Vence: {formatExpiry(p.min_expiry)}
              </p>
            )}
          </div>
        ) : (
          '—'
        ),
    },
    { key: 'cost_price', header: 'Costo', render: (p: Product) => formatCurrency(p.cost_price, currency) },
    { key: 'sale_price', header: 'Precio venta', render: (p: Product) => formatCurrency(p.sale_price, currency) },
    {
      key: 'actions',
      header: 'Acciones',
      render: (p: Product) => (
        <div className="flex gap-3">
          {isPro ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLabelProduct(p);
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium dark:text-blue-400 dark:hover:text-blue-300"
            >
              Etiqueta
            </button>
          ) : (
            <span className="text-sm text-gray-400 font-medium dark:text-slate-500" title="Las etiquetas requieren la versión Pro">
              Etiqueta (Pro)
            </span>
          )}
          {canManage && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/products/${p.id}/edit`);
                }}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium dark:text-primary-400 dark:hover:text-primary-300"
              >
                Editar
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(p.id);
                }}
                className="text-sm text-red-600 hover:text-red-700 font-medium dark:text-red-400 dark:hover:text-red-300"
              >
                Eliminar
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Productos</h1>
        <div className="flex gap-3">
          {canManageCats && (
            <button onClick={() => setShowCategoryModal(true)} className="btn-secondary">
              + Categorías
            </button>
          )}
          {canManage && (
            <>
              {isPro ? (
                <button onClick={handleImport} disabled={importing} className="btn-secondary">
                  {importing ? 'Importando...' : 'Importar'}
                </button>
              ) : (
                <a
                  href="#/settings"
                  className="btn-secondary opacity-60"
                  title="La importación masiva requiere la versión Pro. Actívala en Configuración."
                >
                  Importar (Pro)
                </a>
              )}
              <button onClick={() => navigate('/products/new')} className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" aria-hidden="true" />
                Nuevo producto
              </button>
            </>
          )}
        </div>
      </div>

      {deleteError && (
        <AlertBadge type="error">{deleteError}</AlertBadge>
      )}

      <div className="flex gap-4">
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nombre, SKU o código de barras..." />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(Number(e.target.value))}
          className="input-field max-w-xs"
        >
          <option value={0}>Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
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
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={products}
          onRowClick={canManage ? (item) => navigate(`/products/${item.id}/edit`) : undefined}
          emptyMessage="No hay productos registrados"
        />
      )}

      {showCategoryModal && (
        <Modal title="Nueva categoría" onClose={() => setShowCategoryModal(false)}>
          <form onSubmit={handleCreateCategory} className="space-y-4">
            {error && <AlertBadge type="error">{error}</AlertBadge>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Nombre</label>
              <input
                type="text"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Descripción</label>
              <textarea
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                className="input-field"
                rows={3}
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              Guardar
            </button>
          </form>
        </Modal>
      )}

      {importResult && (
        <Modal title="Resultado de importación" onClose={() => setImportResult(null)}>
          <div className="space-y-4">
            {importResult.canceled ? (
              <p className="text-sm text-gray-600 dark:text-slate-300">No se seleccionó ningún archivo.</p>
            ) : (
              <>
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/40">
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-100">
                    Se importaron <span className="font-bold text-primary-600 dark:text-primary-400">{importResult.created}</span> productos
                  </p>
                  <p className="text-sm text-gray-600 mt-1 dark:text-slate-300">
                    Omitidos: <span className="font-semibold">{importResult.skipped}</span>
                  </p>
                </div>
                {importResult.errors.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Detalle de omisiones:</p>
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-100 dark:border-slate-700 dark:divide-slate-700">
                      {importResult.errors.map((err, i) => (
                        <p key={i} className="text-xs text-gray-600 px-3 py-2 dark:text-slate-300">
                          {err}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  Formato aceptado: archivo CSV o Excel (.xlsx/.xls) con columnas{' '}
                  <span className="font-medium">nombre</span>, <span className="font-medium">sku</span>,{' '}
                  <span className="font-medium">categoria</span>, <span className="font-medium">unidad</span>,{' '}
                  <span className="font-medium">stock_inicial</span>, <span className="font-medium">costo</span> y{' '}
                  <span className="font-medium">precio_venta</span>.
                </p>
                <button
                  onClick={() => setImportResult(null)}
                  className="btn-primary w-full"
                >
                  Cerrar
                </button>
              </>
            )}
          </div>
        </Modal>
      )}

      {labelProduct && (
        <BarcodeLabelModal
          product={labelProduct}
          currency={currency}
          onClose={() => setLabelProduct(null)}
        />
      )}

      {lotsProduct && <LotsModal product={lotsProduct} onClose={() => setLotsProduct(null)} />}
    </div>
  );
}