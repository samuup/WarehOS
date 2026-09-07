import React, { useEffect, useMemo, useState } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchable?: boolean;
  searchKeys?: string[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  pageSize?: number;
}

export function DataTable<T extends object>({
  columns,
  data,
  searchable = false,
  searchKeys = [],
  onRowClick,
  emptyMessage = 'No hay datos para mostrar',
  pageSize = 20,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!search || searchKeys.length === 0) return data;
    const q = search.toLowerCase();
    return data.filter((item) =>
      searchKeys.some((key) => String((item as Record<string, unknown>)[key] ?? '').toLowerCase().includes(q)),
    );
  }, [data, search, searchKeys]);

  useEffect(() => {
    setPage(0);
  }, [data, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  return (
    <div>
      {searchable && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field max-w-sm"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left dark:bg-slate-800/60">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 font-medium text-gray-600 dark:text-slate-400 ${col.className ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paged.map((item, idx) => (
                <tr
                  key={idx}
                  className={`hover:bg-gray-50 transition-colors dark:hover:bg-slate-800/50 ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 ${col.className ?? ''}`}>
                      {col.render
                        ? col.render(item)
                        : String((item as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="text-xs text-gray-400 dark:text-slate-500">{filtered.length} registros</div>
        {pageCount > 1 && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
            <button
              type="button"
              disabled={safePage === 0}
              onClick={() => setPage(Math.max(0, safePage - 1))}
              className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40 dark:border-slate-600"
            >
              Anterior
            </button>
            <span>
              Página {safePage + 1} de {pageCount}
            </span>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
              className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40 dark:border-slate-600"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}