import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initPwa } from './lib/pwa';

initPwa();
import './index.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto mt-24 max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
        <p className="font-semibold text-slate-900">Algo salió mal</p>
        <p className="mt-1 text-sm text-slate-500">{this.state.error.message}</p>
        <p className="mt-1 text-xs text-slate-400">Tus datos siguen guardados en este navegador.</p>
        <button className="mt-4 rounded-lg bg-green-800 px-4 py-2 text-sm font-medium text-white" onClick={() => location.reload()}>Recargar</button>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
);
