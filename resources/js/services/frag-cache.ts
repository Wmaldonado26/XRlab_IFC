/**
 * Local cache for BIM fragment buffers. Cache keys include the authenticated
 * user so projects from different accounts are never mixed in the UI.
 */

const DB_NAME = 'ifc_xrlab_frag_cache';
const DB_VERSION = 1;
const STORE_NAME = 'fragment_buffers';

interface CachedProjectRecord {
  id: string;
  ownerUserId: string;
  projectId: string;
  name: string;
  parts: ArrayBufferLike[];
  partNames?: string[];
  totalBytes: number;
  timestamp: number;
}

function makeCacheId(ownerUserId: string, projectId: string): string {
  return `${encodeURIComponent(ownerUserId)}::${encodeURIComponent(projectId)}`;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveProjectFragments(
  ownerUserId: string,
  projectId: string,
  name: string,
  parts: ArrayBufferLike[],
  partNames?: string[]
): Promise<void> {
  try {
    if (!ownerUserId || !projectId || !parts || !Array.isArray(parts)) return;
    const db = await openDB();
    const validParts = parts.filter((part) => part && part.byteLength > 0);
    const totalBytes = validParts.reduce((acc, part) => acc + part.byteLength, 0);

    const record: CachedProjectRecord = {
      id: makeCacheId(ownerUserId, projectId),
      ownerUserId,
      projectId,
      name: name || projectId,
      parts: validParts,
      partNames: Array.isArray(partNames) ? partNames : undefined,
      totalBytes,
      timestamp: Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('[FragCache] Failed to cache fragments in IndexedDB:', err);
  }
}

export async function appendProjectFragments(
  ownerUserId: string,
  projectId: string,
  name: string,
  newParts: ArrayBuffer[],
  newPartNames?: string[]
): Promise<void> {
  try {
    if (!ownerUserId || !projectId || !newParts || !Array.isArray(newParts)) return;
    const existing = await getProjectFragments(ownerUserId, projectId);
    const combinedParts = existing ? [...existing.parts, ...newParts] : newParts;
    const combinedNames = newPartNames
      ? (existing?.partNames ? [...existing.partNames, ...newPartNames] : newPartNames)
      : undefined;

    await saveProjectFragments(
      ownerUserId,
      projectId,
      name || existing?.name || projectId,
      combinedParts,
      combinedNames
    );
  } catch (err) {
    console.warn('[FragCache] Failed to append fragments:', err);
  }
}

export async function getProjectFragments(
  ownerUserId: string,
  projectId: string
): Promise<{ name: string; parts: ArrayBufferLike[]; partNames?: string[] } | null> {
  try {
    if (!ownerUserId || !projectId) return null;
    const db = await openDB();
    const record = await new Promise<CachedProjectRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(makeCacheId(ownerUserId, projectId));
      request.onsuccess = () => resolve(request.result as CachedProjectRecord | undefined);
      request.onerror = () => reject(request.error);
    });
    db.close();

    if (!record || record.ownerUserId !== ownerUserId || record.projectId !== projectId || !Array.isArray(record.parts)) {
      return null;
    }

    return {
      name: record.name || projectId,
      parts: record.parts.filter((part) => Boolean(part && part.byteLength > 0)),
      partNames: Array.isArray(record.partNames) ? record.partNames : undefined,
    };
  } catch (err) {
    console.warn('[FragCache] Error reading from IndexedDB:', err);
    return null;
  }
}

export async function listCachedProjects(
  ownerUserId: string
): Promise<Array<{ id: string; name: string; totalBytes: number; timestamp: number }>> {
  try {
    if (!ownerUserId) return [];
    const db = await openDB();
    const records = await new Promise<(CachedProjectRecord | null | undefined)[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    db.close();

    return records
      .filter((record): record is CachedProjectRecord => Boolean(
        record && typeof record === 'object' && record.ownerUserId === ownerUserId && record.projectId
      ))
      .map((record) => ({
        id: record.projectId,
        name: record.name || record.projectId,
        totalBytes: typeof record.totalBytes === 'number' ? record.totalBytes : 0,
        timestamp: typeof record.timestamp === 'number' ? record.timestamp : 0,
      }));
  } catch (err) {
    console.warn('[FragCache] Error listing cached projects:', err);
    return [];
  }
}

export async function deleteCachedProject(ownerUserId: string, projectId: string): Promise<void> {
  try {
    if (!ownerUserId || !projectId) return;
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(makeCacheId(ownerUserId, projectId));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('[FragCache] Error deleting from cache:', err);
  }
}

export async function clearAllCachedProjects(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('[FragCache] Error clearing cache:', err);
  }
}
