const db = require('../src/models/db');
(async () => {
  await db.init();
  const rows = await db.all("SELECT id, name, reference_id, age, sex, village, blood_group FROM patients WHERE name ILIKE '%rakshitha%' OR reference_id ILIKE '%rakshitha%'");
  console.log('Rakshitha rows in patients:', rows);

  if (rows.length > 0) {
    for (const r of rows) {
      const cons = await db.all("SELECT id, patient_id, clinic_id, status, main_complaint, created_at FROM consultations WHERE patient_id = ? OR patient_id = ?", [r.id, r.reference_id]);
      console.log('Consultations for', r.id, r.reference_id, ':', cons);
    }
  }

  // Also check all consultations
  const allCons = await db.all("SELECT id, patient_id, status, created_at FROM consultations ORDER BY created_at DESC LIMIT 5");
  console.log('Recent 5 consultations in DB:', allCons);
  process.exit(0);
})();
