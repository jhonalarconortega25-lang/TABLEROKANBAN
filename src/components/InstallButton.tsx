import { useState } from 'react';
import { Download, Share, MoreVertical, PlusSquare } from 'lucide-react';
import { usePwa, promptInstall } from '../lib/pwa';
import { IS_ARTIFACT } from '../lib/backend';
import { useUI } from '../store/useUI';
import { Button, Modal } from './ui';

/** Botón "Instalar app": diálogo nativo cuando existe; si no, pasos según el dispositivo. */
export function InstallButton() {
  const { canPrompt, installed, isIOS } = usePwa();
  const [help, setHelp] = useState(false);
  if (IS_ARTIFACT || installed) return null;

  const onClick = async () => {
    if (canPrompt) {
      if (await promptInstall()) useUI.getState().toast('App instalada. Búscala en tu pantalla de inicio.');
    } else setHelp(true);
  };

  return (
    <>
      <button type="button" onClick={onClick} className="inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-brand-600 px-3 text-sm font-bold text-brand-700 hover:bg-brand-50">
        <Download size={15} /> <span className="hidden md:inline">Instalar app</span>
      </button>
      <Modal open={help} onClose={() => setHelp(false)} title="Instalar la app" size="sm" footer={<Button variant="primary" onClick={() => setHelp(false)}>Entendido</Button>}>
        <p className="mb-3 text-sm text-slate-600">Queda un ícono en tu pantalla de inicio que abre el planner directo, a pantalla completa.</p>
        {isIOS ? (
          <ol className="space-y-2.5 text-sm text-slate-700">
            <li className="flex gap-2"><b className="text-brand-700">1.</b> Ábrela en <b>Safari</b>.</li>
            <li className="flex gap-2"><b className="text-brand-700">2.</b> Toca <Share size={16} className="inline text-brand-700" /> <b>Compartir</b>.</li>
            <li className="flex gap-2"><b className="text-brand-700">3.</b> Elige <PlusSquare size={16} className="inline text-brand-700" /> <b>Agregar a inicio</b>.</li>
          </ol>
        ) : (
          <ol className="space-y-2.5 text-sm text-slate-700">
            <li className="flex gap-2"><b className="text-brand-700">1.</b> Ábrela en <b>Chrome</b> o <b>Edge</b>.</li>
            <li className="flex gap-2"><b className="text-brand-700">2.</b> Abre el menú <MoreVertical size={16} className="inline text-brand-700" /> del navegador.</li>
            <li className="flex gap-2"><b className="text-brand-700">3.</b> Elige <b>Instalar app</b> o <b>Agregar a la pantalla principal</b>.</li>
          </ol>
        )}
      </Modal>
    </>
  );
}
