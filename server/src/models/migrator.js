const fs = require('fs');
const path = require('path');

class Migrator {
  constructor(db) {
    this.db = db;
  }

  async runMigrations() {
    const migrationsDir = path.resolve(__dirname, '../../migrations');
    if (!fs.existsSync(migrationsDir)) return;

    // Ensure schema_migrations table exists
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(50) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const version = path.basename(file, '.sql');
      const alreadyApplied = await this.db.get(
        'SELECT version FROM schema_migrations WHERE version = ?',
        [version]
      );

      if (alreadyApplied) {
        continue;
      }

      console.log(`[CareWave Migrator] Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf8');

      // Strip comments and split statements on semicolon
      const cleanSql = sqlContent.replace(/--[^\r\n]*/g, '');
      const statements = cleanSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements) {
        try {
          await this.db.run(stmt);
        } catch (err) {
          // If column already exists (e.g. during dev transitions), proceed gracefully
          const isIgnorable =
            err.message.includes('duplicate column') ||
            err.message.includes('already exists') ||
            err.message.includes('duplicate key');
          if (!isIgnorable) {
            console.warn(`[CareWave Migrator] Notice in statement "${stmt.substring(0, 40)}...": ${err.message}`);
          }
        }
      }

      await this.db.run(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, CURRENT_TIMESTAMP)',
        [version]
      );
      console.log(`[CareWave Migrator] Successfully recorded migration: ${version}`);
    }
  }
}

module.exports = Migrator;
