/**
 * CareWave Database Inspector CLI Utility
 * Usage: node src/scripts/view-db.js [table_name]
 */
const db = require('../models/db');

async function inspectDb() {
  await db.init();

  const specificTable = process.argv[2];
  const tables = ['users', 'patients', 'consultations', 'attachments', 'doctor_responses', 'sync_events'];

  console.log('\n================================================================');
  console.log('                 CAREWAVE DATABASE INSPECTOR');
  console.log(` Database Engine: ${db.getType().toUpperCase()}`);
  console.log(` Database File:   server/carewave.db`);
  console.log('================================================================\n');

  if (specificTable && tables.includes(specificTable)) {
    await printTable(specificTable);
  } else {
    for (const table of tables) {
      await printTableSummary(table);
    }
    console.log('\nTip: To view all records of a specific table, run:');
    console.log('  node src/scripts/view-db.js <table_name>');
    console.log('  e.g.: node src/scripts/view-db.js patients');
    console.log('        node src/scripts/view-db.js consultations\n');
  }
}

async function printTableSummary(tableName) {
  try {
    const countRow = await db.get(`SELECT COUNT(*) as count FROM ${tableName}`);
    const rows = await db.all(`SELECT * FROM ${tableName} ORDER BY created_at DESC LIMIT 3`);
    console.log(`\n Table: [${tableName.toUpperCase()}] (${countRow ? countRow.count : 0} total records)`);
    console.log('-'.repeat(64));
    if (rows && rows.length > 0) {
      console.table(
        rows.map((r) => {
          const sanitized = { ...r };
          if (sanitized.password_hash) sanitized.password_hash = '[HIDDEN BCRYPT HASH]';
          if (sanitized.vitals && typeof sanitized.vitals === 'string' && sanitized.vitals.length > 30) {
            sanitized.vitals = sanitized.vitals.substring(0, 30) + '...';
          }
          return sanitized;
        })
      );
    } else {
      console.log('  (table is currently empty)');
    }
  } catch (err) {
    console.error(`  Error inspecting table ${tableName}:`, err.message);
  }
}

async function printTable(tableName) {
  try {
    const rows = await db.all(`SELECT * FROM ${tableName} ORDER BY created_at DESC LIMIT 50`);
    console.log(`\n Records in [${tableName.toUpperCase()}]: (${rows.length} records shown)`);
    console.log('='.repeat(64));
    console.table(
      rows.map((r) => {
        const sanitized = { ...r };
        if (sanitized.password_hash) sanitized.password_hash = '[HIDDEN BCRYPT HASH]';
        return sanitized;
      })
    );
  } catch (err) {
    console.error(`Error inspecting table ${tableName}:`, err.message);
  }
}

inspectDb().catch((err) => {
  console.error('Failed to inspect database:', err);
  process.exit(1);
});
