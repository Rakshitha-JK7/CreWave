/**
 * CareWave IndexedDB Service
 * Provides robust client-side persistence for consultations, patients, drafts, and sync queues
 * Ensures no clinical data is lost across offline sessions or browser reloads.
 */

const DB_NAME = 'carewave-db';
const DB_VERSION = 1;

let dbPromise = null;

export function initDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('IndexedDB not supported in this environment');
      resolve(null);
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Consultations store
      if (!db.objectStoreNames.contains('consultations')) {
        const consultStore = db.createObjectStore('consultations', { keyPath: 'id' });
        consultStore.createIndex('patientId', 'patientId', { unique: false });
        consultStore.createIndex('status', 'status', { unique: false });
        consultStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Patients store
      if (!db.objectStoreNames.contains('patients')) {
        const patientStore = db.createObjectStore('patients', { keyPath: 'id' });
        patientStore.createIndex('name', 'name', { unique: false });
        patientStore.createIndex('village', 'village', { unique: false });
      }

      // Drafts store
      if (!db.objectStoreNames.contains('drafts')) {
        const draftStore = db.createObjectStore('drafts', { keyPath: 'id' });
        draftStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // Pending queue for offline sync
      if (!db.objectStoreNames.contains('pendingQueue')) {
        const queueStore = db.createObjectStore('pendingQueue', { keyPath: 'id' });
        queueStore.createIndex('consultationId', 'consultationId', { unique: false });
        queueStore.createIndex('priority', 'priority', { unique: false });
        queueStore.createIndex('status', 'status', { unique: false });
      }

      // Attachments metadata & blobs store
      if (!db.objectStoreNames.contains('attachments')) {
        const attachStore = db.createObjectStore('attachments', { keyPath: 'id' });
        attachStore.createIndex('consultationId', 'consultationId', { unique: false });
      }

      // Doctor responses store
      if (!db.objectStoreNames.contains('doctorResponses')) {
        const responseStore = db.createObjectStore('doctorResponses', { keyPath: 'id' });
        responseStore.createIndex('consultationId', 'consultationId', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };
  });

  return dbPromise;
}

// Generic transaction helper
async function performTx(storeName, mode, callback) {
  const db = await initDB();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let result = null;

      callback(store, (res) => {
        result = res;
      });

      tx.oncomplete = () => resolve(result);
      tx.onerror = (e) => reject(e.target.error);
    } catch (err) {
      reject(err);
    }
  });
}

/* ============================================================
   CONSULTATION OPERATIONS
   ============================================================ */

export async function saveConsultation(consultation) {
  const record = {
    ...consultation,
    updatedAt: new Date().toISOString(),
  };

  return performTx('consultations', 'readwrite', (store, setResult) => {
    const req = store.put(record);
    req.onsuccess = () => setResult(record);
  });
}

export async function getConsultation(id) {
  return performTx('consultations', 'readonly', (store, setResult) => {
    const req = store.get(id);
    req.onsuccess = () => setResult(req.result || null);
  });
}

export async function getAllConsultations() {
  return performTx('consultations', 'readonly', (store, setResult) => {
    const req = store.getAll();
    req.onsuccess = () => setResult(req.result || []);
  });
}

/* ============================================================
   DRAFT OPERATIONS
   ============================================================ */

export async function saveDraft(draft) {
  const record = {
    ...draft,
    id: draft.id || `DRAFT-${Date.now()}`,
    updatedAt: new Date().toISOString(),
  };

  return performTx('drafts', 'readwrite', (store, setResult) => {
    const req = store.put(record);
    req.onsuccess = () => setResult(record);
  });
}

export async function getDraftConsultations() {
  return performTx('drafts', 'readonly', (store, setResult) => {
    const req = store.getAll();
    req.onsuccess = () => setResult(req.result || []);
  });
}

export async function deleteDraft(id) {
  return performTx('drafts', 'readwrite', (store, setResult) => {
    const req = store.delete(id);
    req.onsuccess = () => setResult(true);
  });
}

export const clearDraft = deleteDraft;

/* ============================================================
   PATIENT OPERATIONS
   ============================================================ */

export async function savePatient(patient) {
  const record = {
    ...patient,
    updatedAt: new Date().toISOString(),
  };

  return performTx('patients', 'readwrite', (store, setResult) => {
    const req = store.put(record);
    req.onsuccess = () => setResult(record);
  });
}

export async function getPatient(id) {
  return performTx('patients', 'readonly', (store, setResult) => {
    const req = store.get(id);
    req.onsuccess = () => setResult(req.result || null);
  });
}

export async function getAllPatients() {
  return performTx('patients', 'readonly', (store, setResult) => {
    const req = store.getAll();
    req.onsuccess = () => setResult(req.result || []);
  });
}

/* ============================================================
   PENDING QUEUE OPERATIONS (Sync Engine Boundary)
   ============================================================ */

export async function savePendingUpload(item) {
  const record = {
    ...item,
    id: item.id || `QUEUE-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    queuedAt: item.queuedAt || new Date().toISOString(),
    status: item.status || 'pending',
    attempts: item.attempts || 0,
  };

  return performTx('pendingQueue', 'readwrite', (store, setResult) => {
    const req = store.put(record);
    req.onsuccess = () => setResult(record);
  });
}

export async function getPendingUploads() {
  return performTx('pendingQueue', 'readonly', (store, setResult) => {
    const req = store.getAll();
    req.onsuccess = () => setResult(req.result || []);
  });
}

export async function removePendingUpload(id) {
  return performTx('pendingQueue', 'readwrite', (store, setResult) => {
    const req = store.delete(id);
    req.onsuccess = () => setResult(true);
  });
}

/* ============================================================
   DOCTOR RESPONSE OPERATIONS
   ============================================================ */

export async function saveDoctorResponse(response) {
  const record = {
    ...response,
    storedAt: new Date().toISOString(),
  };

  return performTx('doctorResponses', 'readwrite', (store, setResult) => {
    const req = store.put(record);
    req.onsuccess = () => setResult(record);
  });
}

export async function getDoctorResponses() {
  return performTx('doctorResponses', 'readonly', (store, setResult) => {
    const req = store.getAll();
    req.onsuccess = () => setResult(req.result || []);
  });
}

export default {
  initDB,
  saveConsultation,
  getConsultation,
  getAllConsultations,
  saveDraft,
  getDraftConsultations,
  deleteDraft,
  clearDraft,
  savePatient,
  getPatient,
  getAllPatients,
  savePendingUpload,
  getPendingUploads,
  removePendingUpload,
  saveDoctorResponse,
  getDoctorResponses,
};
