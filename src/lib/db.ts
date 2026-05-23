// Tiny dependency-free IndexedDB key-value wrapper.
// Stores raw key bytes + per-entry encrypted blobs.

const DB_NAME = "purple-dashboard";
const STORE = "kv";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
};

const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> => {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const req = fn(store);
    t.oncomplete = () => resolve((req as IDBRequest<T> | undefined)?.result as T);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
};

export const idbGet = <T>(key: string): Promise<T | undefined> =>
  tx<T>("readonly", (s) => s.get(key));

export const idbSet = (key: string, value: unknown): Promise<void> =>
  tx<void>("readwrite", (s) => { s.put(value, key); });

export const idbDel = (key: string): Promise<void> =>
  tx<void>("readwrite", (s) => { s.delete(key); });

export const idbKeys = (): Promise<string[]> =>
  tx<string[]>("readonly", (s) => s.getAllKeys() as IDBRequest<string[]>);

export const idbClear = (): Promise<void> =>
  tx<void>("readwrite", (s) => { s.clear(); });
