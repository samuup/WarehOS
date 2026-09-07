import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import { App } from './App';
import './styles/globals.css';

function initRendererErrorReporting() {
  const report = (scope: string, message: string) => {
    try {
      void window.api?.logs?.error(scope, message).catch(() => {});
    } catch {
      // el renderer debe seguir funcionando aunque falle el reporte
    }
  };

  window.addEventListener('error', (event) => {
    const stack = event.error instanceof Error && event.error.stack ? `\n${event.error.stack}` : '';
    report('renderer', `${event.message}${stack}`);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? `${reason.message}\n${reason.stack ?? ''}`
        : String(reason ?? 'Promesa rechazada sin motivo');
    report('renderer:unhandledrejection', message);
  });
}

initRendererErrorReporting();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);