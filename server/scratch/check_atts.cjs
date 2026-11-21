const db = require('../src/models/db');
(async () => {
  await db.init();
  const atts = await db.all("SELECT * FROM attachments WHERE consultation_id LIKE '%CW1795302093638%' OR consultation_id LIKE '%RAKSHITHA%'");
  console.log('Attachments for rakshitha consultations:', atts);
  const allAtts = await db.all("SELECT id, consultation_id, file_name, mime_type, storage_path, upload_status FROM attachments LIMIT 10");
  console.log('Total sample attachments in DB:', allAtts);
  process.exit(0);
})();
