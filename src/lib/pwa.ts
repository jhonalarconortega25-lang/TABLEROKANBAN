// Instalación como app (PWA): registra el service worker y expone el aviso de instalación.
import { create } from 'zustand';
import { IS_ARTIFACT } from './backend';

interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

interface PwaState {
  canPrompt: boolean; // Chrome/Edge/Android ofrecen instalar
  installed: boolean; // ya se abre como app
  isIOS: boolean;
}

let deferred: InstallPromptEvent | null = null;

const standalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

export const usePwa = create<PwaState>(() => ({
  canPrompt: false,
  installed: standalone(),
  isIOS: typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent),
}));

export function initPwa() {
  if (IS_ARTIFACT || !import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => void navigator.serviceWorker.register('./sw.js').catch(() => undefined));
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    usePwa.setState({ canPrompt: true });
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    usePwa.setState({ canPrompt: false, installed: true });
  });
}

/** Muestra el diálogo nativo de instalación. Devuelve true si la persona aceptó. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  usePwa.setState({ canPrompt: false });
  return outcome === 'accepted';
}
