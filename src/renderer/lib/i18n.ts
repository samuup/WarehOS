import { useSyncExternalStore } from 'react';

export type AppLang = 'es' | 'en' | 'pt';

const LANG_KEY = 'app_lang';

type Dict = Record<string, string>;

const DICTIONARIES: Record<AppLang, Dict> = {
  es: {
    'nav.dashboard': 'Dashboard',
    'nav.products': 'Productos',
    'nav.inventory': 'Inventario',
    'nav.warehouses': 'Almacenes',
    'nav.reports': 'Reportes',
    'nav.users': 'Usuarios',
    'nav.audit': 'Auditoría',
    'nav.settings': 'Configuración',
    'role.admin': 'Administrador',
    'role.operator': 'Operador',
    'role.viewer': 'Visor',
    'login.tagline': 'Gestión de inventarios para tu empresa',
    'login.title': 'Iniciar sesión',
    'login.username': 'Usuario',
    'login.password': 'Contraseña',
    'login.submit': 'Ingresar',
    'login.forgot': '¿Olvidaste tu contraseña?',
    'login.register': '¿No tienes cuenta? Regístrate',
    'dashboard.title': 'Dashboard',
    'dashboard.welcome': 'Resumen general de tu inventario',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.search': 'Buscar',
    'common.language': 'Idioma',
  },
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.products': 'Products',
    'nav.inventory': 'Inventory',
    'nav.warehouses': 'Warehouses',
    'nav.reports': 'Reports',
    'nav.users': 'Users',
    'nav.audit': 'Audit log',
    'nav.settings': 'Settings',
    'role.admin': 'Administrator',
    'role.operator': 'Operator',
    'role.viewer': 'Viewer',
    'login.tagline': 'Inventory management for your business',
    'login.title': 'Sign in',
    'login.username': 'Username',
    'login.password': 'Password',
    'login.submit': 'Sign in',
    'login.forgot': 'Forgot your password?',
    'login.register': "Don't have an account? Register",
    'dashboard.title': 'Dashboard',
    'dashboard.welcome': 'Overview of your inventory',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.search': 'Search',
    'common.language': 'Language',
  },
  pt: {
    'nav.dashboard': 'Painel',
    'nav.products': 'Produtos',
    'nav.inventory': 'Inventário',
    'nav.warehouses': 'Armazéns',
    'nav.reports': 'Relatórios',
    'nav.users': 'Usuários',
    'nav.audit': 'Auditoria',
    'nav.settings': 'Configurações',
    'role.admin': 'Administrador',
    'role.operator': 'Operador',
    'role.viewer': 'Visualizador',
    'login.tagline': 'Gestão de estoques para sua empresa',
    'login.title': 'Iniciar sessão',
    'login.username': 'Usuário',
    'login.password': 'Senha',
    'login.submit': 'Entrar',
    'login.forgot': 'Esqueceu sua senha?',
    'login.register': 'Não tem conta? Cadastre-se',
    'dashboard.title': 'Painel',
    'dashboard.welcome': 'Resumo geral do seu estoque',
    'common.save': 'Salvar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Excluir',
    'common.edit': 'Editar',
    'common.search': 'Buscar',
    'common.language': 'Idioma',
  },
};

function readLang(): AppLang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === 'en' || v === 'pt' ? v : 'es';
  } catch {
    return 'es';
  }
}

let currentLang: AppLang = readLang();
const listeners = new Set<() => void>();

export function getLang(): AppLang {
  return currentLang;
}

export function setLang(lang: AppLang): void {
  currentLang = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // ignore storage errors
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function translate(key: string): string {
  const dict = DICTIONARIES[currentLang] ?? DICTIONARIES.es;
  return dict[key] ?? DICTIONARIES.es[key] ?? key;
}

export function useI18n(): {
  t: (key: string) => string;
  lang: AppLang;
  setLang: (lang: AppLang) => void;
} {
  useSyncExternalStore(subscribe, () => currentLang);
  return { t: translate, lang: getLang(), setLang };
}

export const LANGUAGE_OPTIONS: { value: AppLang; label: string }[] = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' },
];