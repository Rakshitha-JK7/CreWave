import { openDB as mockOpenDB } from '../offline/mock-idb.js';

let idbOpenDB = mockOpenDB;
try {
  if (typeof window !== 'undefined' && window.indexedDB) {
    // In browser environment with native indexedDB or if custom provider set
    idbOpenDB = mockOpenDB;
  }
} catch (e) {
  // use mockOpenDB
}

const DB_NAME = 'carewave_db';
const DB_VERSION = 1;

let dbPromise = null;

export function setCustomOpenDB(customFn) {
  idbOpenDB = customFn;
  dbPromise = null;
}

export function resetDB() {
  dbPromise = null;
}

export function getDB() {
  if (!dbPromise) {
    if (!idbOpenDB) {
      throw new Error('No openDB implementation available');
    }
    dbPromise = idbOpenDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // 1. Consultations store
        if (!db.objectStoreNames.contains('consultations')) {
          const consultationStore = db.createObjectStore('consultations', { keyPath: 'consultationId' });
          consultationStore.createIndex('syncStatus', 'syncStatus');
          consultationStore.createIndex('createdAt', 'createdAt');
        }

        // 2. Components store
        if (!db.objectStoreNames.contains('components')) {
          const compStore = db.createObjectStore('components', { keyPath: 'componentId' });
          compStore.createIndex('consultationId', 'consultationId');
          compStore.createIndex('status', 'status');
          compStore.createIndex('priority', 'priority');
          compStore.createIndex('priority_status', ['priority', 'status']);
        }

        // 3. Chunks store (composite key: [componentId, index])
        if (!db.objectStoreNames.contains('chunks')) {
          const chunkStore = db.createObjectStore('chunks', { keyPath: ['componentId', 'index'] });
          chunkStore.createIndex('componentId', 'componentId');
        }

        // 4. Outbox (sync queue)
        if (!db.objectStoreNames.contains('outbox')) {
          const outboxStore = db.createObjectStore('outbox', { keyPath: 'id' });
          outboxStore.createIndex('priority', 'priority');
          outboxStore.createIndex('status', 'status');
          outboxStore.createIndex('createdAt', 'createdAt');
        }

        // 5. Doctor responses store
        if (!db.objectStoreNames.contains('doctor_responses')) {
          const respStore = db.createObjectStore('doctor_responses', { keyPath: 'id' });
          respStore.createIndex('consultationId', 'consultationId');
          respStore.createIndex('createdAt', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}

// ==================== Consultations ====================

export async function saveConsultationLocally(consultation) {
  const db = await getDB();
  await db.put('consultations', consultation);
  return consultation;
}

export const saveConsultation = saveConsultationLocally;

export async function getConsultation(consultationId) {
  const db = await getDB();
  return db.get('consultations', consultationId);
}

export async function updateConsultationStatus(consultationId, syncStatus) {
  const db = await getDB();
  const tx = db.transaction('consultations', 'readwrite');
  const consultation = await tx.store.get(consultationId);
  if (consultation) {
    consultation.syncStatus = syncStatus;
    consultation.updatedAt = new Date().toISOString();
    await tx.store.put(consultation);
  }
  await tx.done;
  return consultation;
}

export async function getAllConsultations() {
  const db = await getDB();
  return db.getAll('consultations');
}

export const getConsultations = getAllConsultations;

// ==================== Components ====================

export async function saveComponent(component) {
  const db = await getDB();
  await db.put('components', component);
  return component;
}

export async function getComponent(componentId) {
  const db = await getDB();
  return db.get('components', componentId);
}

export async function getComponentsByConsultation(consultationId) {
  const db = await getDB();
  return db.getAllFromIndex('components', 'consultationId', consultationId);
}

export async function updateComponentStatus(componentId, updates) {
  const db = await getDB();
  const tx = db.transaction('components', 'readwrite');
  const comp = await tx.store.get(componentId);
  if (comp) {
    Object.assign(comp, updates, { updatedAt: new Date().toISOString() });
    await tx.store.put(comp);
  }
  await tx.done;
  return comp;
}

// ==================== Chunks ====================

export async function saveChunk(componentId, index, blob, hash) {
  const db = await getDB();
  return db.put('chunks', {
    componentId,
    index,
    blob,
    hash,
    size: blob.size,
    savedAt: new Date().toISOString(),
  });
}

export async function getChunk(componentId, index) {
  const db = await getDB();
  return db.get('chunks', [componentId, index]);
}

export async function getChunksByComponent(componentId) {
  const db = await getDB();
  return db.getAllFromIndex('chunks', 'componentId', componentId);
}

export async function deleteChunksForComponent(componentId) {
  const db = await getDB();
  const tx = db.transaction('chunks', 'readwrite');
  const index = tx.store.index('componentId');
  let cursor = await index.openCursor(componentId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

// ==================== Outbox (Sync Queue) ====================

export async function addToOutbox(item) {
  const db = await getDB();
  await db.put('outbox', item);
  return item;
}

export async function getOutboxItem(id) {
  const db = await getDB();
  return db.get('outbox', id);
}

export async function getPendingOutboxItems() {
  const db = await getDB();
  const all = await db.getAll('outbox');
  // Sort by priority ascending (1 = highest priority), then createdAt ascending
  return all
    .filter(item => item.status === 'pending' || item.status === 'uploading' || item.status === 'retrying')
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}

export async function updateOutboxItem(id, updates) {
  const db = await getDB();
  const tx = db.transaction('outbox', 'readwrite');
  const item = await tx.store.get(id);
  if (item) {
    Object.assign(item, updates, { updatedAt: new Date().toISOString() });
    await tx.store.put(item);
  }
  await tx.done;
  return item;
}

export async function removeOutboxItem(id) {
  const db = await getDB();
  return db.delete('outbox', id);
}

export async function getAllOutboxItems() {
  const db = await getDB();
  return db.getAll('outbox');
}

// ==================== Doctor Responses ====================

export async function saveDoctorResponse(response) {
  const db = await getDB();
  await db.put('doctor_responses', response);
  return response;
}

export async function getDoctorResponses() {
  const db = await getDB();
  return db.getAll('doctor_responses');
}

export async function getDoctorResponseByConsultationId(consultationId) {
  const db = await getDB();
  const all = await db.getAll('doctor_responses');
  return all.find(r => r.consultationId === consultationId) || null;
}
