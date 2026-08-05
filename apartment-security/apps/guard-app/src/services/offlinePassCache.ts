import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'guardOfflineWalkinQueue';

export type QueuedWalkin = {
  id: string;
  payload: Record<string, unknown>;
  queuedAt: string;
};

async function readAll(): Promise<QueuedWalkin[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

async function writeAll(items: QueuedWalkin[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function enqueue(payload: Record<string, unknown>): Promise<void> {
  const items = await readAll();
  items.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, payload, queuedAt: new Date().toISOString() });
  await writeAll(items);
}

export async function getQueue(): Promise<QueuedWalkin[]> {
  return readAll();
}

export async function remove(id: string): Promise<void> {
  const items = await readAll();
  await writeAll(items.filter((item) => item.id !== id));
}
