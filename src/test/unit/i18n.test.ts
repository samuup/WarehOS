import { describe, it, expect, afterEach } from 'vitest';
import { getLang, setLang, translate, LANGUAGE_OPTIONS } from '../../renderer/lib/i18n';

describe('i18n de la interfaz', () => {
  afterEach(() => {
    setLang('es');
  });

  it('traduce claves a los tres idiomas', () => {
    setLang('es');
    expect(translate('nav.products')).toBe('Productos');
    expect(translate('login.submit')).toBe('Ingresar');
    setLang('en');
    expect(translate('nav.products')).toBe('Products');
    expect(translate('login.submit')).toBe('Sign in');
    setLang('pt');
    expect(translate('nav.products')).toBe('Produtos');
    expect(translate('login.submit')).toBe('Entrar');
  });

  it('devuelve la clave cuando falta la traducción', () => {
    setLang('en');
    expect(translate('clave.inexistente')).toBe('clave.inexistente');
  });

  it('cambia el idioma y lo recuerda', () => {
    setLang('pt');
    expect(getLang()).toBe('pt');
    expect(LANGUAGE_OPTIONS.length).toBeGreaterThanOrEqual(3);
  });
});