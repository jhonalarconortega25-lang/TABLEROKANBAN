// Modo de almacenamiento elegido al compilar:
//  - 'local'    (por defecto): navegador, con Supabase opcional (GitHub Pages)
//  - 'artifact': base de datos compartida del artefacto de claude.ai
export const IS_ARTIFACT = import.meta.env.VITE_BACKEND === 'artifact';

type ClaudeHost = { use: (name: string) => Promise<unknown> };

/** Obtiene una capacidad del visor de claude.ai, o null fuera de él. */
export async function claudeUse<T>(name: string): Promise<T | null> {
  const c = (window as unknown as { claude?: ClaudeHost }).claude;
  if (!c?.use) return null;
  try {
    return ((await c.use(name)) as T | null) ?? null;
  } catch {
    return null;
  }
}
