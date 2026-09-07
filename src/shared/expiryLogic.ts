export type ExpiryNotifyStatus = 'expired' | 'near';

export interface ExpiringLotNote {
  productName: string;
  sku: string;
  batch: string;
  expiryDate: string | null;
  daysLeft: number;
  status: ExpiryNotifyStatus;
}

export function buildExpiryMessage(expiring: ExpiringLotNote[]): string {
  if (expiring.length === 0) return 'No hay lotes por vencer.';
  const max = 3;
  const shown = expiring.slice(0, max);
  const parts = shown.map((l) =>
    l.status === 'expired'
      ? `${l.productName} (${l.batch}): vencido`
      : `${l.productName} (${l.batch}): ${l.daysLeft}d`,
  );
  if (expiring.length > max) parts.push(`y ${expiring.length - max} más...`);
  return parts.join(' · ');
}