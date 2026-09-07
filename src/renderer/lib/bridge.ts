import type {
  User,
  UserInput,
  LoginCredentials,
  ChangePasswordInput,
  SetSecurityQuestionInput,
  ResetPasswordInput,
  SecurityQuestionInfo,
  Category,
  CategoryInput,
  Warehouse,
  WarehouseInput,
  Product,
  ProductInput,
  StockMovement,
  StockMovementInput,
  Lot,
  ExpiringLot,
  SettingsInfo,
  SettingsInput,
  AuditLog,
  AuditLogQuery,
  Company,
  CompanyInput,
  DashboardSummary,
  InventoryReportItem,
  ImportResult,
  LicenseStatus,
  UpdaterStatus,
  UpdateConfigInput,
  UpdaterEvent,
  ApiResult,
} from '@shared/types';

export interface RendererBridge {
  auth: {
    register: (input: UserInput, callerUserId?: number) => Promise<ApiResult<User>>;
    login: (creds: LoginCredentials) => Promise<ApiResult<User>>;
    me: (callerUserId: number) => Promise<ApiResult<User>>;
    listUsers: (callerUserId: number) => Promise<ApiResult<User[]>>;
    deleteUser: (id: number, callerUserId: number) => Promise<ApiResult<null>>;
    changePassword: (input: ChangePasswordInput) => Promise<ApiResult<null>>;
    setSecurityQuestion: (input: SetSecurityQuestionInput) => Promise<ApiResult<null>>;
    getSecurityQuestion: (username: string) => Promise<ApiResult<SecurityQuestionInfo>>;
    resetPassword: (input: ResetPasswordInput) => Promise<ApiResult<null>>;
  };
  categories: {
    list: () => Promise<ApiResult<Category[]>>;
    create: (input: CategoryInput, userId: number) => Promise<ApiResult<Category>>;
    update: (id: number, input: CategoryInput, userId: number) => Promise<ApiResult<Category>>;
    delete: (id: number, userId: number) => Promise<ApiResult<null>>;
  };
  warehouses: {
    list: () => Promise<ApiResult<Warehouse[]>>;
    create: (input: WarehouseInput, userId: number) => Promise<ApiResult<Warehouse>>;
    update: (id: number, input: WarehouseInput, userId: number) => Promise<ApiResult<Warehouse>>;
    delete: (id: number, userId: number) => Promise<ApiResult<null>>;
  };
  products: {
    list: (params?: { search?: string; category_id?: number; warehouse_id?: number }) => Promise<ApiResult<Product[]>>;
    get: (id: number) => Promise<ApiResult<Product>>;
    getByBarcode: (barcode: string) => Promise<ApiResult<Product>>;
    create: (input: ProductInput, userId: number) => Promise<ApiResult<Product>>;
    update: (id: number, input: ProductInput, userId: number) => Promise<ApiResult<Product>>;
    delete: (id: number, userId: number) => Promise<ApiResult<null>>;
    import: (userId: number) => Promise<ApiResult<ImportResult>>;
  };
  movements: {
    list: (params?: {
      product_id?: number;
      type?: string;
      from?: string;
      to?: string;
      warehouse_id?: number;
    }) => Promise<ApiResult<StockMovement[]>>;
    create: (input: StockMovementInput, userId: number) => Promise<ApiResult<StockMovement>>;
  };
  lots: {
    list: (productId: number) => Promise<ApiResult<Lot[]>>;
    expiring: () => Promise<ApiResult<ExpiringLot[]>>;
  };
  audit: {
    list: (query: AuditLogQuery, userId: number) => Promise<ApiResult<AuditLog[]>>;
  };
  dashboard: {
    summary: () => Promise<ApiResult<DashboardSummary>>;
  };
  reports: {
    inventory: () => Promise<ApiResult<InventoryReportItem[]>>;
  };
  company: {
    get: () => Promise<ApiResult<Company>>;
    update: (input: CompanyInput, userId: number) => Promise<ApiResult<Company>>;
  };
  settings: {
    get: () => Promise<ApiResult<SettingsInfo>>;
    update: (input: SettingsInput, userId: number) => Promise<ApiResult<SettingsInfo>>;
  };
  notifications: {
    test: (userId: number) => Promise<ApiResult<{ shown: boolean }>>;
    check: (userId: number) => Promise<ApiResult<{ lowStock: number; expiring: number }>>;
  };
  logs: {
    error: (scope: string, message: string) => Promise<ApiResult<null>>;
  };
  backup: {
    export: (targetPath: string, password: string, userId: number) => Promise<ApiResult<boolean>>;
    import: (sourcePath: string, password: string, userId: number) => Promise<ApiResult<boolean>>;
  };
  license: {
    getStatus: () => Promise<ApiResult<LicenseStatus>>;
    activate: (key: string, userId: number) => Promise<ApiResult<LicenseStatus>>;
  };
  updates: {
    getStatus: () => Promise<ApiResult<UpdaterStatus>>;
    check: (userId: number) => Promise<ApiResult<boolean>>;
    install: (userId: number) => Promise<ApiResult<boolean>>;
    setConfig: (input: UpdateConfigInput, userId: number) => Promise<ApiResult<UpdaterStatus>>;
    onEvent: (listener: (event: UpdaterEvent) => void) => () => void;
  };
}