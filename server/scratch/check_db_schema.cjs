const db = require('../src/models/db');
(async () => {
  await db.init();
  const tables = await db.all("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log('Tables in DB:', tables.map(t => t.table_name));

  for (const t of tables) {
    const cols = await db.all(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${t.table_name}'`);
    console.log(`\nTable ${t.table_name}:`, cols.map(c => `${c.column_name} (${c.data_type})`).join(', '));
  }
  process.exit(0);
})();
