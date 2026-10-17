import { useSyncExternalStore } from "react";

/** Estado do último envio das preferências/dados para a conta (escrito por lib/cloud-sync.tsx). */
export type SyncStatus = "idle" | "saving" | "saved" | "error";

let current: SyncStatus = "idle";
const listeners = new Set<() => void>();

export function setSyncStatus(next: SyncStatus) {
  if (next === current) return;
  current = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
