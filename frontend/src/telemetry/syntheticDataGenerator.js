/**
 * CareBridge Synthetic Medical Record Generator
 * Generates realistic, fully structured, non-clinical synthetic medical records
 * containing patient demographics, vitals, clinical observations, and binary attachments
 * (JPEG, PNG, PDF, DOCX) for physical network testing and validation.
 * 
 * ALL GENERATED RECORDS ARE STRICTLY LABELED AS SYNTHETIC TEST DATA.
 */

import { calculateSha256 } from './protoCodec';

/**
 * Creates a valid synthetic JPEG image using an offscreen canvas
 */
export async function createSyntheticJpegImage(label = 'SYNTHETIC CLINICAL PHOTO') {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 400, 300);
    grad.addColorStop(0, '#f8fafc');
    grad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 400, 300);

    // Decorative clinical test pattern
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, 360, 260);

    // Grid
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 0.5;
    for (let x = 40; x < 380; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x, 280);
      ctx.stroke();
    }
    for (let y = 40; y < 280; y += 30) {
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.lineTo(380, y);
      ctx.stroke();
    }

    // Diagnostic indicator badge
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(30, 30, 340, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('NON-CLINICAL SYNTHETIC TEST PATTERN', 50, 50);

    // Metadata text
    ctx.fillStyle = '#0f172a';
    ctx.font = '14px monospace';
    ctx.fillText(label, 40, 100);
    ctx.font = '11px monospace';
    ctx.fillText(`Timestamp: ${new Date().toISOString()}`, 40, 130);
    ctx.fillText('Modality: Clinical Dermatological Photo Test', 40, 150);
    ctx.fillText('Integrity Hash Target: SHA-256', 40, 170);
    ctx.fillText('Resolution: 400x300 sRGB', 40, 190);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        blob.arrayBuffer().then((ab) => resolve(new Uint8Array(ab)));
      }, 'image/jpeg', 0.85);
    });
  }

  // Fallback 1x1 valid JPEG
  const b64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

/**
 * Creates a valid synthetic PNG image representing an ECG trace
 */
export async function createSyntheticPngEcg(label = 'SYNTHETIC ECG LEAD II') {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');

    // ECG grid paper background (pink/red grid)
    ctx.fillStyle = '#fff1f2';
    ctx.fillRect(0, 0, 500, 200);

    ctx.strokeStyle = '#fecdd3';
    ctx.lineWidth = 0.75;
    for (let x = 0; x <= 500; x += 10) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 200); ctx.stroke();
    }
    for (let y = 0; y <= 200; y += 10) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(500, y); ctx.stroke();
    }

    // ECG waveform (Lead II P-QRS-T wave simulation)
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, 100);

    for (let i = 0; i < 4; i++) {
      const offset = 20 + i * 110;
      ctx.lineTo(offset, 100);
      ctx.lineTo(offset + 15, 93); // P wave
      ctx.lineTo(offset + 30, 100);
      ctx.lineTo(offset + 35, 104); // Q
      ctx.lineTo(offset + 42, 35);  // R peak
      ctx.lineTo(offset + 50, 120); // S
      ctx.lineTo(offset + 58, 100);
      ctx.lineTo(offset + 75, 88);  // T wave
      ctx.lineTo(offset + 95, 100);
    }
    ctx.lineTo(490, 100);
    ctx.stroke();

    // Banner
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.fillRect(10, 10, 240, 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`${label} (TEST)`, 18, 26);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        blob.arrayBuffer().then((ab) => resolve(new Uint8Array(ab)));
      }, 'image/png');
    });
  }

  const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErmJggg==';
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

/**
 * Creates valid PDF document bytes
 */
export function createSyntheticPdfBytes(recordId) {
  const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 260 >>
stream
BT
/F1 14 Tf
50 720 Td
(CAREBRIDGE TELEMEDICINE - SYNTHETIC TEST REPORT) Tj
/F1 10 Tf
0 -30 Td
(RECORD ID: ${recordId}) Tj
0 -20 Td
(STATUS: NON-CLINICAL VALIDATION DATA - DO NOT USE FOR DIAGNOSIS) Tj
0 -20 Td
(TEST PROFILE: 2G GSM TELEMETRY INTEGRITY BENCHMARK) Tj
0 -20 Td
(GENERATION TIMESTAMP: ${new Date().toISOString()}) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000224 00000 n 
0000000535 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
612
%%EOF`;

  return new TextEncoder().encode(content);
}

/**
 * Creates valid synthetic DOCX bytes (minimal ZIP archive)
 */
export function createSyntheticDocxBytes(recordId) {
  const textContent = `CAREBRIDGE CLINICAL SUMMARY (SYNTHETIC BENCHMARK RECORD)\n` +
    `Record ID: ${recordId}\n` +
    `Type: DOCX Clinical Telemetry Verification\n` +
    `Timestamp: ${new Date().toISOString()}\n` +
    `Notice: Synthetic test data generated to validate 100% lossless exact byte reconstruction over 2G mobile link.`;

  // Standard ZIP Local File Header (PK\x03\x04)
  const header = new Uint8Array([
    0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x21, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x13, 0x00, 0x00, 0x00,
    // filename: word/document.xml
    0x77, 0x6f, 0x72, 0x64, 0x2f, 0x64, 0x6f, 0x63, 0x75, 0x6d,
    0x65, 0x6e, 0x74, 0x2e, 0x78, 0x6d, 0x6c
  ]);

  const body = new TextEncoder().encode(textContent);
  const total = new Uint8Array(header.length + body.length);
  total.set(header, 0);
  total.set(body, header.length);
  return total;
}

/**
 * Builds a complete synthetic MedicalRecord matching CareBridge proto3 schema
 */
export async function generateSyntheticMedicalRecord(options = {}) {
  const timestamp = Date.now();
  const recordId = `CW-SYNTH-${timestamp}`;
  const patientId = `SYNTH-PAT-${Math.floor(1000 + Math.random() * 9000)}`;

  // Attachments
  const attachments = [];

  // 1. JPEG
  if (options.includeImages !== false) {
    const jpegBytes = await createSyntheticJpegImage(`SYNTHETIC SKIN LESION #${timestamp}`);
    const jpegHash = await calculateSha256(jpegBytes);
    attachments.push({
      attachment_id: `ATT-SYNTH-JPG-${timestamp}`,
      filename: `clinical_photo_${timestamp}.jpg`,
      mime_type: 'image/jpeg',
      attachment_type: 'clinical_photo',
      original_size: jpegBytes.length,
      content: jpegBytes,
      sha256: jpegHash,
    });

    // 2. PNG
    const pngBytes = await createSyntheticPngEcg(`SYNTHETIC ECG LEAD-II #${timestamp}`);
    const pngHash = await calculateSha256(pngBytes);
    attachments.push({
      attachment_id: `ATT-SYNTH-PNG-${timestamp}`,
      filename: `ecg_lead2_${timestamp}.png`,
      mime_type: 'image/png',
      attachment_type: 'ecg',
      original_size: pngBytes.length,
      content: pngBytes,
      sha256: pngHash,
    });
  }

  // 3. PDF
  if (options.includeDocuments !== false) {
    const pdfBytes = createSyntheticPdfBytes(recordId);
    const pdfHash = await calculateSha256(pdfBytes);
    attachments.push({
      attachment_id: `ATT-SYNTH-PDF-${timestamp}`,
      filename: `lab_report_${timestamp}.pdf`,
      mime_type: 'application/pdf',
      attachment_type: 'lab_report',
      original_size: pdfBytes.length,
      content: pdfBytes,
      sha256: pdfHash,
    });

    // 4. DOCX
    const docxBytes = createSyntheticDocxBytes(recordId);
    const docxHash = await calculateSha256(docxBytes);
    attachments.push({
      attachment_id: `ATT-SYNTH-DOCX-${timestamp}`,
      filename: `clinical_history_${timestamp}.docx`,
      mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      attachment_type: 'referral_letter',
      original_size: docxBytes.length,
      content: docxBytes,
      sha256: docxHash,
    });
  }

  return {
    schema_version: 1,
    record_id: recordId,
    patient_id: patientId,
    patient_name: `[SYNTHETIC] Patient ${patientId}`,
    age: 38,
    gender: 'Female',
    village: 'Sitapur Validation Node (PHC-04)',
    contact_number: '+91 98765 43210',
    blood_group: 'B+',
    symptoms: '[SYNTHETIC TEST RECORD - NON-CLINICAL VALIDATION] Acute localized dermatitis on left forearm with mild pruritus.',
    symptom_onset: '2 days ago',
    symptom_duration: '48 hours',
    severity_progression: 'Stable',
    medical_history: 'No known chronic diseases. Seasonal rhinitis.',
    current_medications: 'None',
    allergies: 'Penicillin (Suspected rash 2021)',
    healthcare_notes: '*** CRITICAL NOTICE: THIS IS A SYNTHETIC BENCHMARK RECORD GENERATED EXCLUSIVELY FOR PHYSICAL NETWORK VALIDATION. NOT FOR REAL CLINICAL CARE. ***',
    immediate_action: 'Topical soothing ointment applied at rural node.',
    priority: 'normal',
    specialization: 'General Medicine',
    doctor_name: 'Dr. Vikram Chandra',
    vitals: [
      { name: 'SpO2', value: '98', unit: '%' },
      { name: 'Heart Rate', value: '76', unit: 'bpm' },
      { name: 'Blood Pressure', value: '122/78', unit: 'mmHg' },
      { name: 'Temperature', value: '98.4', unit: '°F' },
      { name: 'Respiratory Rate', value: '16', unit: 'breaths/min' },
    ],
    attachments,
    healthcare_worker_id: 'HW-VALIDATION-NODE',
    healthcare_worker_name: 'Field Verification Officer',
    clinic_id: 'CLINIC-RURAL-VAL-01',
    consultation_timestamp: new Date().toISOString(),
    idempotency_key: `IDEMP-${recordId}`,
    is_synthetic_test: true,
  };
}

export default {
  createSyntheticJpegImage,
  createSyntheticPngEcg,
  createSyntheticPdfBytes,
  createSyntheticDocxBytes,
  generateSyntheticMedicalRecord,
};
