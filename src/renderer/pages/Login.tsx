import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Modal } from '../components/Modal';
import { api } from '../lib/api';
import { AlertBadge } from '../components/AlertBadge';
import { useI18n, LANGUAGE_OPTIONS } from '../lib/i18n';
import logo from '../assets/logo.png';

export function Login() {
  const login = useAuthStore((s) => s.login);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ── Register modal ──
  const [showRegister, setShowRegister] = useState(false);
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState(false);

  // ── Forgot password modal ──
  const [showRecover, setShowRecover] = useState(false);
  const [recStep, setRecStep] = useState<1 | 2 | 3>(1);
  const [recUsername, setRecUsername] = useState('');
  const [recQuestion, setRecQuestion] = useState('');
  const [recAnswer, setRecAnswer] = useState('');
  const [recNewPw, setRecNewPw] = useState('');
  const [recConfirmPw, setRecConfirmPw] = useState('');
  const [recError, setRecError] = useState<string | null>(null);
  const [recSuccess, setRecSuccess] = useState(false);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const resetRecover = () => {
    setShowRecover(false);
    setRecStep(1);
    setRecUsername('');
    setRecQuestion('');
    setRecAnswer('');
    setRecNewPw('');
    setRecConfirmPw('');
    setRecError(null);
    setRecSuccess(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const err = await login(username, password);
    if (err) setError(err);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    if (regPassword !== regConfirm) {
      setRegError('Las contraseñas no coinciden');
      return;
    }
    if (regPassword.length < 6) {
      setRegError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    const res = await api.auth.register({ name: regName, username: regUsername, password: regPassword, role: 'operator' });
    if (res.success) {
      setRegSuccess(true);
      setTimeout(() => {
        setShowRegister(false);
        setRegSuccess(false);
        setRegName('');
        setRegUsername('');
        setRegPassword('');
        setRegConfirm('');
      }, 1500);
    } else {
      setRegError(res.error || 'Error al registrar');
    }
  };

  // ── Forgot password handlers ──

  const handleRecStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecError(null);
    if (!recUsername.trim()) { setRecError('Ingresa tu usuario'); return; }
    const res = await api.auth.getSecurityQuestion(recUsername.trim());
    if (!res.success || !res.data) { setRecError(res.error || 'Error al buscar el usuario'); return; }
    if (!res.data.set) {
      setRecError('No hay pregunta de seguridad configurada para este usuario. Contacta al administrador.');
      return;
    }
    setRecQuestion(res.data.question);
    setRecStep(2);
  };

  const handleRecStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecError(null);
    if (!recAnswer.trim()) { setRecError('Ingresa la respuesta'); return; }
    setRecStep(3);
  };

  const handleRecStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecError(null);
    if (recNewPw !== recConfirmPw) { setRecError('Las contraseñas no coinciden'); return; }
    if (recNewPw.length < 6) { setRecError('La contraseña debe tener al menos 6 caracteres'); return; }
    const res = await api.auth.resetPassword({
      username: recUsername.trim(),
      answer: recAnswer.trim(),
      newPassword: recNewPw,
    });
    if (res.success) {
      setRecSuccess(true);
    } else {
      setRecError(res.error || 'Error al restablecer la contraseña');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-gray-100 dark:from-slate-900 dark:to-slate-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src={logo}
            alt="WarehOS"
            className="w-20 h-20 mx-auto mb-4 object-contain"
          />
          <h1 className="text-3xl font-bold text-primary-600 dark:text-primary-400">WarehOS</h1>
          <p className="text-gray-500 mt-2 dark:text-slate-400">{t('login.tagline')}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 dark:bg-slate-800 dark:border dark:border-slate-700">
          <div className="flex justify-end mb-2">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as 'es' | 'en' | 'pt')}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-6 dark:text-slate-100">{t('login.title')}</h2>
          {error && (
            <div className="mb-4">
              <AlertBadge type="error">{error}</AlertBadge>
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">{t('login.username')}</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">{t('login.password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              {t('login.submit')}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <button
              onClick={() => setShowRecover(true)}
              className="text-sm text-primary-500 hover:text-primary-600 font-medium"
            >
              {t('login.forgot')}
            </button>
            <div>
              <button
                onClick={() => setShowRegister(true)}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                {t('login.register')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showRegister && (
        <Modal title="Registrar usuario" onClose={() => setShowRegister(false)}>
          {regSuccess ? (
            <AlertBadge type="success">Usuario registrado correctamente</AlertBadge>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              {regError && <AlertBadge type="error">{regError}</AlertBadge>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Nombre completo</label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Usuario</label>
                <input
                  type="text"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className="input-field"
                  autoComplete="username"
                  placeholder="Entre 3 y 30 caracteres (letras, números, . _ -)"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Contraseña</label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Confirmar contraseña</label>
                <input
                  type="password"
                  value={regConfirm}
                  onChange={(e) => setRegConfirm(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
              <button type="submit" className="btn-primary w-full">
                Registrarse
              </button>
            </form>
          )}
        </Modal>
      )}

      {showRecover && (
        <Modal title="Restablecer contraseña" onClose={resetRecover}>
          {recSuccess ? (
            <div className="text-center py-6">
              <p className="text-green-700 font-semibold mb-2">Contraseña restablecida correctamente</p>
              <p className="text-sm text-gray-500 mb-4 dark:text-slate-400">Ahora puedes iniciar sesión con tu nueva contraseña.</p>
              <button onClick={resetRecover} className="btn-primary">Iniciar sesión</button>
            </div>
          ) : recStep === 1 ? (
            <form onSubmit={handleRecStep1} className="space-y-4">
              {recError && <AlertBadge type="error">{recError}</AlertBadge>}
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Ingresa tu usuario para verificar tu identidad.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Usuario</label>
                <input
                  type="text"
                  value={recUsername}
                  onChange={(e) => setRecUsername(e.target.value)}
                  className="input-field"
                  autoComplete="username"
                  required
                  autoFocus
                />
              </div>
              <button type="submit" className="btn-primary w-full">Continuar</button>
            </form>
          ) : recStep === 2 ? (
            <form onSubmit={handleRecStep2} className="space-y-4">
              {recError && <AlertBadge type="error">{recError}</AlertBadge>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Tu pregunta de seguridad</label>
                <p className="text-gray-800 font-medium bg-gray-50 p-3 rounded-lg dark:bg-slate-700 dark:text-slate-200">{recQuestion}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Tu respuesta</label>
                <input
                  type="text"
                  value={recAnswer}
                  onChange={(e) => setRecAnswer(e.target.value)}
                  className="input-field"
                  required
                  autoFocus
                />
              </div>
              <button type="submit" className="btn-primary w-full">Validar respuesta</button>
            </form>
          ) : (
            <form onSubmit={handleRecStep3} className="space-y-4">
              {recError && <AlertBadge type="error">{recError}</AlertBadge>}
              <p className="text-sm text-gray-500 dark:text-slate-400">Respuesta correcta. Establece tu nueva contraseña.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Nueva contraseña</label>
                <input
                  type="password"
                  value={recNewPw}
                  onChange={(e) => setRecNewPw(e.target.value)}
                  className="input-field"
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1 dark:text-slate-500">Mínimo 6 caracteres</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Confirmar contraseña</label>
                <input
                  type="password"
                  value={recConfirmPw}
                  onChange={(e) => setRecConfirmPw(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
              <button type="submit" className="btn-primary w-full">Restablecer contraseña</button>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
