export interface TrendRow {
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER';
  quantity: number;
  new_stock: number;
  warehouse_id: number | null;
  destination_warehouse_id: number | null;
  created_at: string;
}

export interface TrendPoint {
  date: string;
  total: number;
}

function bucketKey(warehouseId: number | null): number {
  return warehouseId ?? 0;
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function computeStockTrend(rows: TrendRow[], days = 30): TrendPoint[] {
  const buckets = new Map<number, number>();
  const endOfDay = new Map<string, number>();
  let running = 0;

  const sorted = [...rows].sort((a, b) =>
    a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0,
  );

  for (const row of sorted) {
    if (row.type === 'TRANSFER' && row.destination_warehouse_id != null) {
      buckets.set(bucketKey(row.warehouse_id), row.new_stock);
      const destKey = bucketKey(row.destination_warehouse_id);
      buckets.set(destKey, (buckets.get(destKey) ?? 0) + row.quantity);
    } else if (row.warehouse_id != null) {
      buckets.set(bucketKey(row.warehouse_id), row.new_stock);
    } else {
      buckets.set(0, row.new_stock);
    }
    running = 0;
    for (const q of buckets.values()) running += q;
    endOfDay.set(row.created_at.slice(0, 10), running);
  }

  const points: TrendPoint[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    const key = toDateKey(day);
    if (endOfDay.has(key)) running = endOfDay.get(key) ?? running;
    points.push({ date: key, total: running });
  }
  return points;
}

export function labelDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
  });
}