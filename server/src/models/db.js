const fs = require('fs');
const path = require('path');
const config = require('../config/config');

let dbInstance = null;
let clientType = 'sqlite';
let globalPgPool = null;

// Helper to convert '?' placeholders to '$1, $2, ...' for Postgres
function convertPlaceholders(sql) {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

class DatabaseAdapter {
  constructor() {
    this.client = null;
    this.type = 'sqlite';
    this.initialized = false;
    this.initializingPromise = null;
  }

  async init() {
    if (this.initialized) return;
    if (this.initializingPromise) return this.initializingPromise;

    this.initializingPromise = (async () => {
      if (config.dbClient === 'postgres') {
        try {
          if (!globalPgPool) {
            const { Pool } = require('pg');
            const poolConfig = {
              ...(config.databaseUrl
                ? { connectionString: config.databaseUrl }
                : {
                    host: config.pg.host,
                    port: config.pg.port,
                    user: config.pg.user,
                    password: config.pg.password,
                    database: config.pg.database,
                  }),
              max: 10,
              idleTimeoutMillis: 10000,
              connectionTimeoutMillis: 5000,
            };

            globalPgPool = new Pool(poolConfig);
            // Test connection
            await globalPgPool.query('SELECT 1');
            console.log('[CareWave DB] Connected to PostgreSQL database.');
          }

          this.client = globalPgPool;
          this.type = 'postgres';
          clientType = 'postgres';
          this.initialized = true;
        } catch (err) {
          console.error(`[CareWave DB Error] Explicitly configured PostgreSQL connection failed: ${err.message}`);
          throw new Error(`PostgreSQL connection failed: ${err.message}. Refusing silent fallback as PostgreSQL is explicitly configured.`);
        }
      } else {
        this.initSQLite();
        this.initialized = true;
      }

      // Run versioned migrations
      const Migrator = require('./migrator');
      const migrator = new Migrator(this);
      await migrator.runMigrations();
    })();

    try {
      await this.initializingPromise;
    } finally {
      this.initializingPromise = null;
    }
  }

  initSQLite() {
    const { DatabaseSync } = require('node:sqlite');
    const dbDir = path.dirname(config.sqlite.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    this.client = new DatabaseSync(config.sqlite.dbPath);
    this.type = 'sqlite';
    clientType = 'sqlite';
    // Enable foreign keys and WAL mode for better concurrency
    try {
      this.client.exec('PRAGMA foreign_keys = ON;');
      this.client.exec('PRAGMA journal_mode = WAL;');
    } catch (e) {
      // ignore
    }
    console.log(`[CareWave DB] SQLite database initialized at ${config.sqlite.dbPath}`);
  }

  async transaction(fn) {
    await this.init();
    if (this.type === 'sqlite') {
      this.client.exec('BEGIN TRANSACTION;');
      try {
        const result = await fn(this);
        this.client.exec('COMMIT;');
        return result;
      } catch (err) {
        this.client.exec('ROLLBACK;');
        throw err;
      }
    } else {
      // PostgreSQL pool client transaction
      const client = await this.client.connect();
      try {
        await client.query('BEGIN');
        const txAdapter = {
          run: async (sql, params = []) => {
            const pgSql = convertPlaceholders(sql);
            const res = await client.query(pgSql, params);
            return { changes: res.rowCount, rowCount: res.rowCount };
          },
          get: async (sql, params = []) => {
            const pgSql = convertPlaceholders(sql);
            const res = await client.query(pgSql, params);
            return res.rows && res.rows.length > 0 ? res.rows[0] : null;
          },
          all: async (sql, params = []) => {
            const pgSql = convertPlaceholders(sql);
            const res = await client.query(pgSql, params);
            return res.rows || [];
          },
        };
        const result = await fn(txAdapter);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  }

  async query(sql, params = []) {
    await this.init();
    if (this.type === 'sqlite') {
      try {
        const trimmed = sql.trim().toUpperCase();
        if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH') || trimmed.startsWith('PRAGMA')) {
          const stmt = this.client.prepare(sql);
          return stmt.all(...params);
        } else {
          const stmt = this.client.prepare(sql);
          const result = stmt.run(...params);
          return { rowCount: result.changes, changes: result.changes, lastInsertRowid: result.lastInsertRowid };
        }
      } catch (err) {
        console.error(`[CareWave DB Error - SQLite] ${err.message} \nQuery: ${sql}`, params);
        throw err;
      }
    } else {
      // Postgres
      const pgSql = convertPlaceholders(sql);
      try {
        const res = await this.client.query(pgSql, params);
        return res.rows || { rowCount: res.rowCount };
      } catch (err) {
        console.error(`[CareWave DB Error - PG] ${err.message} \nQuery: ${pgSql}`, params);
        throw err;
      }
    }
  }

  async all(sql, params = []) {
    const res = await this.query(sql, params);
    return Array.isArray(res) ? res : [];
  }

  async get(sql, params = []) {
    const rows = await this.all(sql, params);
    return rows && rows.length > 0 ? rows[0] : null;
  }

  async run(sql, params = []) {
    await this.init();
    if (this.type === 'sqlite') {
      const stmt = this.client.prepare(sql);
      const info = stmt.run(...params);
      return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
    } else {
      const pgSql = convertPlaceholders(sql);
      const res = await this.client.query(pgSql, params);
      return { changes: res.rowCount, rowCount: res.rowCount };
    }
  }

  async exec(sql) {
    await this.init();
    if (this.type === 'sqlite') {
      this.client.exec(sql);
    } else {
      await this.client.query(sql);
    }
  }

  getType() {
    return this.type;
  }
}

const db = new DatabaseAdapter();

module.exports = db;
