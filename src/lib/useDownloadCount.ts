import { useEffect, useSyncExternalStore } from "react";

let downloadCount: number | null = null;
let requestStarted = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return downloadCount;
}

function updateCount(count: number) {
  downloadCount = count;
  listeners.forEach((listener) => listener());
}

function loadDownloadCount() {
  if (requestStarted) return;
  requestStarted = true;

  fetch("/api/download-count")
    .then((response) => {
      if (!response.ok) throw new Error("Download count unavailable");
      return response.json() as Promise<{ count?: unknown }>;
    })
    .then(({ count }) => {
      if (typeof count === "number" && Number.isSafeInteger(count) && count >= 0) {
        updateCount(count);
      }
    })
    .catch(() => {
      // The count is optional; both download links remain usable without it.
    });
}

export function useDownloadCount() {
  const count = useSyncExternalStore(subscribe, getSnapshot, () => null);

  useEffect(() => {
    loadDownloadCount();
  }, []);

  return count;
}
