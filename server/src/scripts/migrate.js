const db = require('../models/db');

async function migrate() {
  console.log('[CareWave Migration] Starting database migration...');
  await db.init();
  console.log('[CareWave Migration] Migration completed successfully.');
}

if (require.main === module) {
  migrate().then(() => process.exit(0)).catch(err => {
    console.error('[CareWave Migration] Failed:', err);
    process.exit(1);
  });
}

module.exports = migrate;
