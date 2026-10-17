/**
 * Aviso de "sessão encerrada de propósito" (logout). O AuthProvider fica FORA do
 * UrbicoProvider, então não pode limpar os dados locais diretamente — quem está
 * dentro dos dois (lib/cloud-sync.tsx) escuta este evento e limpa.
 * Erros de rede ou sessão expirada NÃO emitem este evento.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

export function onSessionCleared(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitSessionCleared() {
  listeners.forEach((listener) => listener());
}
