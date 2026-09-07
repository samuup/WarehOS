import { useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download } from 'lucide-react';
import { useInventoryStore } from '../store/inventoryStore';
import { useSettingsStore } from '../store/settingsStore';
import { formatCurrency, formatNumber, formatDate } from '../lib/formatters';
import { DataTable, type Column } from '../components/DataTable';
import { useLicenseStore } from '../store/licenseStore';
import type { InventoryReportItem } from '@shared/types';

export function Reports() {
  const { inventoryReport, fetchInventoryReport } = useInventoryStore();
  const { company, fetchCompany } = useSettingsStore();
  const isPro = useLicenseStore((s) => s.isPro);

  useEffect(() => {
    fetchInventoryReport();
    fetchCompany();
  }, [fetchInventoryReport, fetchCompany]);

  const totalValue = inventoryReport.reduce((sum, item) => sum + item.stock_value, 0);
  const totalUnits = inventoryReport.reduce((sum, item) => sum + item.current_stock, 0);
  const currency = company?.currency || 'PEN';

  const exportCSV = () => {
    const headers = ['Producto', 'SKU', 'Categoría', 'Unidad', 'Stock', 'Costo unit.', 'Valor'];
    const rows = inventoryReport.map((item) => [
      item.product_name,
      item.product_sku,
      item.category_name || '',
      item.unit,
      item.current_stock,
      item.cost_price,
      item.stock_value,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_actual_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const companyName = company?.name || 'WarehOS';

    doc.setFontSize(16);
    doc.text(companyName, 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    if (company?.address) doc.text(company.address, 14, 24);
    if (company?.phone) doc.text(`Tel: ${company.phone}`, 14, 29);
    if (company?.tax_id) doc.text(`RUC: ${company.tax_id}`, 14, 34);
    doc.text(`Generado el: ${formatDate(new Date().toISOString())}`, 14, 44);

    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text('Reporte de Inventario', 14, 54);

    autoTable(doc, {
      startY: 60,
      head: [['Producto', 'SKU', 'Categoría', 'Unidad', 'Stock', 'Costo unit.', 'Valor']],
      body: inventoryReport.map((item) => [
        item.product_name,
        item.product_sku,
        item.category_name || '',
        item.unit,
        String(item.current_stock),
        formatCurrency(item.cost_price, currency),
        formatCurrency(item.stock_value, currency),
      ]),
      foot: [
        [
          'TOTAL',
          '',
          '',
          '',
          String(totalUnits),
          '',
          formatCurrency(totalValue, currency),
        ],
      ],
      footStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9 },
    });

    doc.save(`inventario_actual_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const columns: Column<InventoryReportItem>[] = [
    {
      key: 'product_name',
      header: 'Producto',
      render: (item: InventoryReportItem) => (
        <div>
          <p className="font-medium text-gray-800 dark:text-slate-200">{item.product_name}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">SKU: {item.product_sku}</p>
        </div>
      ),
    },
    { key: 'category_name', header: 'Categoría', render: (item: InventoryReportItem) => item.category_name || '—' },
    {
      key: 'current_stock',
      header: 'Stock',
      render: (item: InventoryReportItem) => `${item.current_stock} ${item.unit}`,
    },
    { key: 'cost_price', header: 'Costo unit.', render: (item: InventoryReportItem) => formatCurrency(item.cost_price, currency) },
    { key: 'stock_value', header: 'Valor total', render: (item: InventoryReportItem) => formatCurrency(item.stock_value, currency) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Reportes</h1>
        <div className="flex gap-3">
          {isPro ? (
            <>
              <button onClick={exportPDF} className="btn-secondary inline-flex items-center gap-2">
                <Download className="w-4 h-4" aria-hidden="true" />
                Exportar PDF
              </button>
              <button onClick={exportCSV} className="btn-primary inline-flex items-center gap-2">
                <Download className="w-4 h-4" aria-hidden="true" />
                Exportar CSV
              </button>
            </>
          ) : (
            <a
              href="#/settings"
              className="btn-primary opacity-60"
              title="La exportación requiere la versión Pro. Actívala en Configuración."
            >
              Exportar (Pro)
            </a>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100">
              {company?.name || 'Reporte de inventario'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Generado el {formatDate(new Date().toISOString())}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-slate-400">Productos: {inventoryReport.length}</p>
            <p className="text-sm text-gray-500 dark:text-slate-400">Unidades totales: {formatNumber(totalUnits)}</p>
            <p className="text-lg font-bold text-primary-600 dark:text-primary-400">Valor total: {formatCurrency(totalValue, currency)}</p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={inventoryReport}
          emptyMessage="No hay productos en el inventario"
        />
      </div>
    </div>
  );
}