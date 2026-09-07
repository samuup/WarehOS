import type { Role } from './permissions';

export type { Role };

export interface User {
  id: number;
  name: string;
  username: string;
  role: Role;
  created_at: string;
  mustChangePassword?: boolean;
}

export interface UserInput {
  name: string;
  username: string;
  password: string;
  role: Role;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface ChangePasswordInput {
  userId: number;
  currentPassword: string;
  newPassword: string;
}

export interface SetSecurityQuestionInput {
  userId: number;
  question: string;
  answer: string;
}

export interface ResetPasswordInput {
  username: string;
  answer: string;
  newPassword: string;
}

export interface SecurityQuestionInfo {
  set: boolean;
  question: string;
}

export interface Category {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

export interface CategoryInput {
  name: string;
  description: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  description: string;
  category_id: number;
  category_name?: string;
  unit: string;
  stock_min: number;
  current_stock: number;
  cost_price: number;
  sale_price: number;
  track_lots: boolean;
  min_expiry?: string | null;
  stocks?: Record<number, number>;
  created_at: string;
  updated_at: string;
}

export interface ProductInput {
  name: string;
  sku: string;
  barcode: string | null;
  description: string;
  category_id: number;
  unit: string;
  stock_min: number;
  cost_price: number;
  sale_price: number;
  track_lots?: boolean;
}

export interface ImportRow {
  nombre: string;
  sku: string;
  barcode: string;
  descripcion?: string;
  categoria?: string;
  unidad?: string;
  stock_min?: number;
  stock_inicial?: number;
  costo?: number;
  precio_venta?: number;
}

export interface ImportResult {
  canceled: boolean;
  created: number;
  skipped: number;
  errors: string[];
}

export type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER';

export interface StockMovement {
  id: number;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  type: MovementType;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  note: string;
  warehouse_id?: number | null;
  warehouse_name?: string;
  destination_warehouse_id?: number | null;
  destination_warehouse_name?: string;
  user_id: number;
  user_name?: string;
  created_at: string;
}

export interface StockMovementInput {
  product_id: number;
  type: MovementType;
  quantity: number;
  note: string;
  warehouse_id?: number | null;
  destination_warehouse_id?: number | null;
  batch?: string;
  expiry_date?: string | null;
}

export interface Lot {
  id: number;
  product_id: number;
  warehouse_id: number;
  warehouse_name?: string;
  batch: string;
  expiry_date: string | null;
  quantity: number;
  created_at: string;
}

export type LotExpiryStatus = 'expired' | 'near';

export interface ExpiringLot {
  lot_id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  warehouse_id: number;
  warehouse_name: string;
  batch: string;
  expiry_date: string | null;
  quantity: number;
  days_left: number;
  status: LotExpiryStatus;
}

export interface SettingsInfo {
  expiry_threshold_days: number;
  notify_low_stock: boolean;
  notify_expiry: boolean;
  notify_interval_min: number;
}

export interface SettingsInput {
  expiry_threshold_days?: number;
  notify_low_stock?: boolean;
  notify_expiry?: boolean;
  notify_interval_min?: number;
}

export interface Warehouse {
  id: number;
  name: string;
  address: string;
  is_default: number;
  created_at: string;
}

export interface WarehouseInput {
  name: string;
  address: string;
}

export interface Company {
  id: number;
  name: string;
  address: string;
  phone: string;
  email: string;
  tax_id: string;
  currency: string;
}

export interface CompanyInput {
  name: string;
  address: string;
  phone: string;
  email: string;
  tax_id: string;
  currency: string;
}

export interface StockTrendPoint {
  date: string;
  total: number;
}

export interface TopMovedProduct {
  product_id: number;
  name: string;
  unit: string;
  quantity: number;
}

export interface StockByCategory {
  category_id: number | null;
  category_name: string;
  total: number;
}

export interface DashboardSummary {
  total_products: number;
  total_categories: number;
  total_movements: number;
  total_stock_value: number;
  low_stock_count: number;
  recent_movements: StockMovement[];
  low_stock_products: Product[];
  expiring_lots: ExpiringLot[];
  stock_trend: StockTrendPoint[];
  top_moved: TopMovedProduct[];
  stock_by_category: StockByCategory[];
}

export interface AuditLog {
  id: number;
  user_id: number;
  user_name: string;
  action: string;
  entity: string;
  entity_id: number | null;
  detail: string;
  created_at: string;
}

export interface AuditLogQuery {
  action?: string;
  entity?: string;
  user_id?: number;
  from?: string;
  to?: string;
  limit?: number;
}

export interface InventoryReportItem {
  product_id: number;
  product_name: string;
  product_sku: string;
  category_name: string;
  unit: string;
  current_stock: number;
  cost_price: number;
  stock_value: number;
}

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export type LicenseEdition = 'pro' | 'trial' | 'trial_expired';

export interface LicenseStatus {
  edition: LicenseEdition;
  trialDays: number;
  trialDaysLeft: number;
  activated: boolean;
  machineHash: string;
  customer?: string;
  expiresAt?: string | null;
  tampered?: boolean;
}

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'error';

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
}

export interface UpdateProgress {
  bytesPerSecond: number;
  percent: number;
  total: number;
  transferred: number;
}

export interface UpdaterStatus {
  enabled: boolean;
  disabledReason?: string;
  currentVersion: string;
  feedUrl: string;
  autoCheck: boolean;
  state: UpdateState;
  info?: UpdateInfo | null;
  progress?: UpdateProgress | null;
  error?: string;
}

export interface UpdateConfigInput {
  feedUrl?: string;
  autoCheck: boolean;
}

export type UpdaterEvent =
  | { type: 'checking' }
  | { type: 'update-available'; info: UpdateInfo }
  | { type: 'update-not-available' }
  | { type: 'download-progress'; progress: UpdateProgress }
  | { type: 'update-downloaded'; info: UpdateInfo }
  | { type: 'error'; message: string }
  | { type: 'state'; status: UpdaterStatus };