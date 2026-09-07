import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Modal } from './Modal';
import {
  LABEL_SIZES,
  buildLabelsPdf,
  selectFormat,
  type LabelSizeKey,
} from '../lib/labelRenderer';
import { formatCurrency } from '../lib/formatters';
import type { Product } from '@shared/types';

interface BarcodeLabelModalProps {
  product: Product;
  currency: string;
  onClose: () => void;
}

export function BarcodeLabelModal({ product, currency, onClose }: BarcodeLabelModalProps) {
  const [sizeKey, setSizeKey] = useState<LabelSizeKey>('50x30');
  const [copies, setCopies] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);
  const value = product.barcode || product.sku;

  useEffect(() => {
    if (!svgRef.current) return;
    const options = {
      width: 2,
      height: 70,
      displayValue: true,
      fontSize: 14,
      margin: 2,
    };
    try {
      JsBarcode(svgRef.current, value, { ...options, format: selectFormat(value) });
    } catch {
      JsBarcode(svgRef.current, value, { ...options, format: 'CODE128' });
    }
  }, [value]);

  const handleGenerate = () => {
    const sub = [
      product.sku ? `SKU: ${product.sku}` : '',
      `${product.current_stock} ${product.unit}`,
      product.sale_price > 0 ? formatCurrency(product.sale_price, currency) : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const doc = buildLabelsPdf({ barcode: value, name: product.name, sub }, sizeKey, copies);
    doc.save(`etiqueta_${product.sku || 'producto'}.pdf`);
    onClose();
  };

  const label = LABEL_SIZES[sizeKey];

  return (
    <Modal title={`Etiqueta de ${product.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 flex justify-center dark:border-slate-700 dark:bg-slate-900">
          <div className="bg-white rounded border border-gray-100 p-2 dark:bg-white" style={{ width: 210, height: (210 * label.height) / label.width }}>
            <svg ref={svgRef} className="w-full h-auto" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Tamaño de etiqueta</label>
            <select
              value={sizeKey}
              onChange={(e) => setSizeKey(e.target.value as LabelSizeKey)}
              className="input-field"
            >
              <option value="50x30">50 × 30 mm</option>
              <option value="60x40">60 × 40 mm</option>
              <option value="80x50">80 × 50 mm</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Copias</label>
            <input
              type="number"
              min={1}
              max={200}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
              className="input-field"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Genera un PDF en hoja A4 con {copies} {copies === 1 ? 'etiqueta' : 'etiquetas'} de {label.width} × {label.height} mm. Al abrir el PDF se lanza automáticamente el diálogo de impresión.
        </p>
        <button onClick={handleGenerate} className="btn-primary w-full">
          Generar etiqueta PDF
        </button>
      </div>
    </Modal>
  );
}