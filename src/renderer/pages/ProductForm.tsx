import { useEffect, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useProductStore } from '../store/productStore';
import { useAuthStore } from '../store/authStore';
import { AlertBadge } from '../components/AlertBadge';
import { api } from '../lib/api';
import { UNIT_OPTIONS } from '../lib/formatters';
import { can } from '@shared/permissions';
import type { Product, ProductInput } from '@shared/types';

export function ProductForm() {
  const role = useAuthStore((s) => s.user?.role);
  const canManage = can(role, 'products.manage');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { categories, fetchCategories, createProduct, updateProduct } = useProductStore();

  const [form, setForm] = useState<ProductInput>({
    name: '',
    sku: '',
    barcode: null,
    description: '',
    category_id: 0,
    unit: 'uds',
    stock_min: 0,
    cost_price: 0,
    sale_price: 0,
    track_lots: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(id));

  const isEdit = Boolean(id);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (id) {
      (async () => {
        const res = await api.products.get(Number(id));
        if (res.success && res.data) {
          const p = res.data as Product;
          setForm({
            name: p.name,
            sku: p.sku,
            barcode: p.barcode,
            description: p.description,
            category_id: p.category_id,
            unit: p.unit,
            stock_min: p.stock_min,
            cost_price: p.cost_price,
            sale_price: p.sale_price,
            track_lots: p.track_lots ?? false,
          });
        }
        setLoading(false);
      })();
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.category_id === 0) {
      setError('Selecciona una categoría');
      return;
    }
    const err = isEdit ? await updateProduct(Number(id), form) : await createProduct(form);
    if (err) {
      setError(err);
    } else {
      navigate('/products');
    }
  };

  const update = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (!canManage) {
    return <Navigate to="/products" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/products')}
          className="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
          aria-label="Volver a productos"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">
          {isEdit ? 'Editar producto' : 'Nuevo producto'}
        </h1>
      </div>

      {error && <AlertBadge type="error">{error}</AlertBadge>}

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Nombre*</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">SKU*</label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => update('sku', e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">
              Código de barras (EAN-13 / UPC / Code128)
            </label>
            <input
              type="text"
              value={form.barcode ?? ''}
              onChange={(e) => update('barcode', e.target.value)}
              placeholder="Opcional"
              className="input-field"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Descripción</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            className="input-field"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Categoría*</label>
            <select
              value={form.category_id}
              onChange={(e) => update('category_id', Number(e.target.value))}
              className="input-field"
              required
            >
              <option value={0}>Seleccionar...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Unidad de medida</label>
            <select
              value={form.unit}
              onChange={(e) => update('unit', e.target.value)}
              className="input-field"
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Stock mínimo</label>
            <input
              type="number"
              step="any"
              min="0"
              value={form.stock_min}
              onChange={(e) => update('stock_min', Number(e.target.value))}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Precio costo</label>
            <input
              type="number"
              step="any"
              min="0"
              value={form.cost_price}
              onChange={(e) => update('cost_price', Number(e.target.value))}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Precio venta</label>
            <input
              type="number"
              step="any"
              min="0"
              value={form.sale_price}
              onChange={(e) => update('sale_price', Number(e.target.value))}
              className="input-field"
            />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 dark:border-slate-700">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={form.track_lots ?? false}
              onChange={(e) => update('track_lots', e.target.checked)}
              className="h-4 w-4 mt-0.5"
            />
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Control por lotes y fechas de vencimiento</p>
              <p className="text-xs text-gray-400 mt-0.5 dark:text-slate-500">
                Las entradas pedirán número de lote y fecha de vencimiento; las salidas
                descuentan del lote que vence primero (FEFO) y se podrá alertar de
                vencimientos próximos.
                {isEdit && (form.track_lots ? ' Al activarlo, el stock actual se agrupa en un lote "Inicial".' : ' Al desactivarlo, se descartan los lotes del producto.' )}
              </p>
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={() => navigate('/products')} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" className="btn-primary">
            {isEdit ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </div>
      </form>
    </div>
  );
}