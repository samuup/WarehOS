import { contextBridge, ipcRenderer } from 'electron';
import type { UpdaterEvent } from '../shared/types';

export interface ElectronAPI {
  auth: {
    register: (input: unknown, callerUserId?: number) => Promise<unknown>;
    login: (creds: unknown) => Promise<unknown>;
    me: (callerUserId: number) => Promise<unknown>;
    listUsers: (callerUserId: number) => Promise<unknown>;
    deleteUser: (id: number, callerUserId: number) => Promise<unknown>;
    changePassword: (input: unknown) => Promise<unknown>;
    setSecurityQuestion: (input: unknown) => Promise<unknown>;
    getSecurityQuestion: (username: string) => Promise<unknown>;
    resetPassword: (input: unknown) => Promise<unknown>;
  };
  categories: {
    list: () => Promise<unknown>;
    create: (input: unknown, userId: number) => Promise<unknown>;
    update: (id: number, input: unknown, userId: number) => Promise<unknown>;
    delete: (id: number, userId: number) => Promise<unknown>;
  };
  warehouses: {
    list: () => Promise<unknown>;
    create: (input: unknown, userId: number) => Promise<unknown>;
    update: (id: number, input: unknown, userId: number) => Promise<unknown>;
    delete: (id: number, userId: number) => Promise<unknown>;
  };
  products: {
    list: (params?: unknown) => Promise<unknown>;
    get: (id: number) => Promise<unknown>;
    getByBarcode: (barcode: string) => Promise<unknown>;
    create: (input: unknown, userId: number) => Promise<unknown>;
    update: (id: number, input: unknown, userId: number) => Promise<unknown>;
    delete: (id: number, userId: number) => Promise<unknown>;
    import: (userId: number) => Promise<unknown>;
  };
  movements: {
    list: (params?: unknown) => Promise<unknown>;
    create: (input: unknown, userId: number) => Promise<unknown>;
  };
  lots: {
    list: (productId: number) => Promise<unknown>;
    expiring: () => Promise<unknown>;
  };
  audit: {
    list: (query: unknown, userId: number) => Promise<unknown>;
  };
  dashboard: {
    summary: () => Promise<unknown>;
  };
  reports: {
    inventory: () => Promise<unknown>;
  };
  company: {
    get: () => Promise<unknown>;
    update: (input: unknown, userId: number) => Promise<unknown>;
  };
  settings: {
    get: () => Promise<unknown>;
    update: (input: unknown, userId: number) => Promise<unknown>;
  };
  notifications: {
    test: (userId: number) => Promise<unknown>;
    check: (userId: number) => Promise<unknown>;
  };
  backup: {
    export: (targetPath: string, password: string, userId: number) => Promise<unknown>;
    import: (sourcePath: string, password: string, userId: number) => Promise<unknown>;
  };
  license: {
    getStatus: () => Promise<unknown>;
    activate: (key: string, userId: number) => Promise<unknown>;
  };
  updates: {
    getStatus: () => Promise<unknown>;
    check: (userId: number) => Promise<unknown>;
    install: (userId: number) => Promise<unknown>;
    setConfig: (input: unknown, userId: number) => Promise<unknown>;
    onEvent: (listener: (event: UpdaterEvent) => void) => () => void;
  };
}

const api: ElectronAPI = {
  auth: {
    register: (input, callerUserId) => ipcRenderer.invoke('auth:register', input, callerUserId),
    login: (creds) => ipcRenderer.invoke('auth:login', creds),
    me: (callerUserId) => ipcRenderer.invoke('auth:me', callerUserId),
    listUsers: (callerUserId) => ipcRenderer.invoke('auth:listUsers', callerUserId),
    deleteUser: (id, callerUserId) => ipcRenderer.invoke('auth:deleteUser', id, callerUserId),
    changePassword: (input) => ipcRenderer.invoke('auth:changePassword', input),
    setSecurityQuestion: (input) => ipcRenderer.invoke('auth:setSecurityQuestion', input),
    getSecurityQuestion: (username) => ipcRenderer.invoke('auth:getSecurityQuestion', username),
    resetPassword: (input) => ipcRenderer.invoke('auth:resetPassword', input),
  },
  categories: {
    list: () => ipcRenderer.invoke('categories:list'),
    create: (input, userId) => ipcRenderer.invoke('categories:create', input, userId),
    update: (id, input, userId) => ipcRenderer.invoke('categories:update', id, input, userId),
    delete: (id, userId) => ipcRenderer.invoke('categories:delete', id, userId),
  },
  warehouses: {
    list: () => ipcRenderer.invoke('warehouses:list'),
    create: (input, userId) => ipcRenderer.invoke('warehouses:create', input, userId),
    update: (id, input, userId) => ipcRenderer.invoke('warehouses:update', id, input, userId),
    delete: (id, userId) => ipcRenderer.invoke('warehouses:delete', id, userId),
  },
  products: {
    list: (params?) => ipcRenderer.invoke('products:list', params),
    get: (id) => ipcRenderer.invoke('products:get', id),
    getByBarcode: (barcode) => ipcRenderer.invoke('products:getByBarcode', barcode),
    create: (input, userId) => ipcRenderer.invoke('products:create', input, userId),
    update: (id, input, userId) => ipcRenderer.invoke('products:update', id, input, userId),
    delete: (id, userId) => ipcRenderer.invoke('products:delete', id, userId),
    import: (userId) => ipcRenderer.invoke('products:import', userId),
  },
  movements: {
    list: (params?) => ipcRenderer.invoke('movements:list', params),
    create: (input, userId) => ipcRenderer.invoke('movements:create', input, userId),
  },
  lots: {
    list: (productId) => ipcRenderer.invoke('lots:list', productId),
    expiring: () => ipcRenderer.invoke('lots:expiring'),
  },
  audit: {
    list: (query, userId) => ipcRenderer.invoke('audit:list', userId, query),
  },
  dashboard: {
    summary: () => ipcRenderer.invoke('dashboard:summary'),
  },
  reports: {
    inventory: () => ipcRenderer.invoke('reports:inventory'),
  },
  company: {
    get: () => ipcRenderer.invoke('company:get'),
    update: (input, userId) => ipcRenderer.invoke('company:update', input, userId),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (input, userId) => ipcRenderer.invoke('settings:update', input, userId),
  },
  notifications: {
    test: (userId) => ipcRenderer.invoke('notifications:test', userId),
    check: (userId) => ipcRenderer.invoke('notifications:check', userId),
  },
  backup: {
    export: (targetPath, password, userId) =>
      ipcRenderer.invoke('backup:export', targetPath, password, userId),
    import: (sourcePath, password, userId) =>
      ipcRenderer.invoke('backup:import', sourcePath, password, userId),
  },
  license: {
    getStatus: () => ipcRenderer.invoke('license:getStatus'),
    activate: (key, userId) => ipcRenderer.invoke('license:activate', key, userId),
  },
  updates: {
    getStatus: () => ipcRenderer.invoke('updates:getStatus'),
    check: (userId) => ipcRenderer.invoke('updates:check', userId),
    install: (userId) => ipcRenderer.invoke('updates:install', userId),
    setConfig: (input, userId) => ipcRenderer.invoke('updates:setConfig', input, userId),
    onEvent: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => {
        listener(payload as UpdaterEvent);
      };
      ipcRenderer.on('updates:event', handler);
      return () => ipcRenderer.removeListener('updates:event', handler);
    },
  },
};

contextBridge.exposeInMainWorld('api', api);