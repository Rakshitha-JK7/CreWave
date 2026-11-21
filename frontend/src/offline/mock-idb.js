/**
 * Lightweight in-memory IndexedDB & 'idb' compatible shim for Node test environments
 * Implements openDB, transactions, objectStores, indexes, cursors, and key-value methods.
 */

class MockCursor {
  constructor(entries, direction = 'next') {
    this.entries = entries;
    this.index = 0;
  }

  get value() {
    return this.entries[this.index]?.val;
  }

  get key() {
    return this.entries[this.index]?.key;
  }

  async delete() {
    if (this.entries[this.index]) {
      this.entries[this.index].store.delete(this.entries[this.index].rawKey);
    }
  }

  async continue() {
    this.index++;
    if (this.index < this.entries.length) {
      return this;
    }
    return null;
  }
}

class MockIndex {
  constructor(store, name, keyPath) {
    this.store = store;
    this.name = name;
    this.keyPath = keyPath;
  }

  matches(item, query) {
    if (Array.isArray(this.keyPath)) {
      if (!Array.isArray(query)) return false;
      return this.keyPath.every((kp, i) => item[kp] === query[i]);
    }
    return item[this.keyPath] === query;
  }

  async get(query) {
    for (const [k, v] of this.store.data.entries()) {
      if (this.matches(v, query)) {
        return structuredClone(v);
      }
    }
    return undefined;
  }

  async getAll(query) {
    const results = [];
    for (const [k, v] of this.store.data.entries()) {
      if (query === undefined || this.matches(v, query)) {
        results.push(structuredClone(v));
      }
    }
    return results;
  }

  async openCursor(query) {
    const matchingEntries = [];
    for (const [k, v] of this.store.data.entries()) {
      if (query === undefined || this.matches(v, query)) {
        matchingEntries.push({ key: k, rawKey: k, val: v, store: this.store.data });
      }
    }
    if (matchingEntries.length === 0) return null;
    return new MockCursor(matchingEntries);
  }
}

class MockObjectStore {
  constructor(name, options = {}) {
    this.name = name;
    this.keyPath = options.keyPath;
    this.autoIncrement = options.autoIncrement || false;
    this.data = new Map();
    this.indexes = new Map();
    this._autoId = 1;
  }

  createIndex(name, keyPath) {
    const idx = new MockIndex(this, name, keyPath);
    this.indexes.set(name, idx);
    return idx;
  }

  index(name) {
    const idx = this.indexes.get(name);
    if (!idx) throw new Error(`Index not found: ${name}`);
    return idx;
  }

  extractKey(val) {
    if (Array.isArray(this.keyPath)) {
      return JSON.stringify(this.keyPath.map(k => val[k]));
    }
    if (typeof this.keyPath === 'string') {
      return val[this.keyPath];
    }
    return undefined;
  }

  normalizeKey(key) {
    if (Array.isArray(key)) {
      return JSON.stringify(key);
    }
    return key;
  }

  async put(value, optionalKey) {
    let key = optionalKey;
    if (this.keyPath) {
      key = this.extractKey(value);
    }
    if (key === undefined) {
      key = this._autoId++;
      if (this.keyPath && typeof this.keyPath === 'string') {
        value[this.keyPath] = key;
      }
    }
    const normKey = this.normalizeKey(key);
    this.data.set(normKey, structuredClone(value));
    return key;
  }

  async get(key) {
    const normKey = this.normalizeKey(key);
    const val = this.data.get(normKey);
    return val ? structuredClone(val) : undefined;
  }

  async getAll() {
    return Array.from(this.data.values()).map(v => structuredClone(v));
  }

  async getAllFromIndex(indexName, query) {
    const idx = this.index(indexName);
    return idx.getAll(query);
  }

  async delete(key) {
    const normKey = this.normalizeKey(key);
    return this.data.delete(normKey);
  }

  async clear() {
    this.data.clear();
  }
}

class MockDB {
  constructor(name, version) {
    this.name = name;
    this.version = version;
    this.objectStores = new Map();
  }

  get objectStoreNames() {
    const stores = this.objectStores;
    return {
      contains(name) {
        return stores.has(name);
      },
    };
  }

  createObjectStore(name, options) {
    const store = new MockObjectStore(name, options);
    this.objectStores.set(name, store);
    return store;
  }

  transaction(storeNames, mode) {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    const store = this.objectStores.get(names[0]);
    return {
      store,
      done: Promise.resolve(),
    };
  }

  async put(storeName, val, key) {
    const store = this.objectStores.get(storeName);
    return store.put(val, key);
  }

  async get(storeName, key) {
    const store = this.objectStores.get(storeName);
    return store.get(key);
  }

  async getAll(storeName) {
    const store = this.objectStores.get(storeName);
    return store.getAll();
  }

  async getAllFromIndex(storeName, indexName, query) {
    const store = this.objectStores.get(storeName);
    return store.getAllFromIndex(indexName, query);
  }

  async delete(storeName, key) {
    const store = this.objectStores.get(storeName);
    return store.delete(key);
  }
}

const dbs = new Map();

export async function openDB(name, version, { upgrade } = {}) {
  let db = dbs.get(name);
  if (!db) {
    db = new MockDB(name, version);
    if (upgrade) {
      upgrade(db);
    }
    dbs.set(name, db);
  }
  return db;
}

export function clearMockDBs() {
  dbs.clear();
}
