import api from '../utils/api';
import * as offlinePassCache from './offlinePassCache';

let syncing = false;
let autoSyncInterval: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(pending: number) => void>();

export function onQueueChange(callback: (pending: number) => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

async function notify() {
  const queue = await offlinePassCache.getQueue();
  listeners.forEach((callback) => callback(queue.length));
  checkAutoSync(queue.length);
}

function checkAutoSync(queueLength: number) {
  if (queueLength > 0 && !autoSyncInterval) {
    // ponytail: auto-retry syncing queued walk-ins every 5s while items are pending
    autoSyncInterval = setInterval(() => {
      flushQueue();
    }, 5000);
  } else if (queueLength === 0 && autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
}

export function isSyncing(): boolean {
  return syncing;
}

export async function queueWalkin(payload: Record<string, unknown>): Promise<void> {
  await offlinePassCache.enqueue(payload);
  await notify();
}

// ponytail: retries the queue serially on every trigger — fine at guard-app
// scale (a handful of pending walk-ins), revisit if volume grows.
export async function flushQueue(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const queue = await offlinePassCache.getQueue();
    for (const item of queue) {
      try {
        await api.post('/walkins/request', item.payload);
        await offlinePassCache.remove(item.id);
      } catch (error: any) {
        if (error.response) {
          // server rejected the request itself (bad data) -- retrying won't help
          await offlinePassCache.remove(item.id);
        } else {
          // still offline -- stop here, try the rest again on the next trigger
          break;
        }
      }
    }
  } finally {
    syncing = false;
    await notify();
  }
}
