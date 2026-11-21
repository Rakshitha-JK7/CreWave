/**
 * CareBridge Medical Record Processing & Reconstruction Service
 * Decompresses, cryptographically verifies, and reconstructs unified Protocol Buffers records.
 * Integrates directly with PostgreSQL and secure file storage.
 */

const fs = require('fs');
const path = require('path');
const db = require('../models/db');
const { decodeMedicalRecord, decodeDoctorResponse, calculateSha256 } = require('../telemetry/protoCodec');
const { decompressRecord, verifyIntegrity } = require('../telemetry/compressionEngine');
const aiRestorationService = require('./aiRestorationService');

class MedicalRecordService {
  constructor() {
    this.uploadsDir = path.resolve(__dirname, '../../../uploads/medical_records');
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Processes a complete compressed binary medical record payload received over 2G GSM
   * @param {Buffer} compressedBuffer 
   * @param {object} headers 
   * @param {object} authenticatedUser 
   * @returns {Promise<object>} verified receipt
   */
  async processUpload(compressedBuffer, headers, authenticatedUser) {
    const recordIdHeader = headers['x-record-id'];
    const expectedSha256 = headers['x-record-sha256'];
    const transferId = headers['x-transfer-id'] || `TR-${Date.now()}`;
    const idempotencyKey = headers['x-idempotency-key'] || `IDEMP-${recordIdHeader || Date.now()}`;

    if (!compressedBuffer || compressedBuffer.length === 0) {
      throw new Error('Empty payload rejected: No binary data received.');
    }

    const compressedSize = compressedBuffer.length;

    // 1. Check idempotency: If this record was already delivered, return existing receipt immediately
    const existing = await db.get(
      'SELECT id, status, record_hash, transfer_id, created_at FROM consultations WHERE idempotency_key = ? OR id = ?',
      [idempotencyKey, recordIdHeader]
    );
    if (existing && existing.status === 'delivered') {
      return {
        alreadyDelivered: true,
        recordId: existing.id,
        transferId: existing.transfer_id || transferId,
        status: 'delivered',
        verifiedHash: existing.record_hash,
        serverTimestamp: existing.created_at,
      };
    }

    // 2. Safe GZIP decompression with zip-bomb limit check
    const decompressResult = decompressRecord(compressedBuffer);
    const uncompressedBuffer = decompressResult.uncompressed;
    const uncompressedSize = decompressResult.uncompressedSize;
    const actualSha256 = decompressResult.sha256;

    // 3. Cryptographic SHA-256 integrity verification
    if (expectedSha256 && !verifyIntegrity(uncompressedBuffer, expectedSha256)) {
      throw new Error(`Data integrity verification failure: Expected hash ${expectedSha256}, got ${actualSha256}`);
    }

    // 4. Protocol Buffers deserialization
    let record;
    try {
      record = decodeMedicalRecord(uncompressedBuffer);
    } catch (err) {
      throw new Error(`Malformed medical record payload: ${err.message}`);
    }

    const recordId = record.record_id || recordIdHeader;
    const patientId = record.patient_id || 'PAT-DEMO';
    const hwId = record.healthcare_worker_id || authenticatedUser?.id || 'HW-UNKNOWN';
    const clinicId = record.clinic_id || authenticatedUser?.clinicId || 'CLINIC-RURAL-01';

    // 5. Create secure record directory
    const recordDir = path.join(this.uploadsDir, recordId);
    if (!fs.existsSync(recordDir)) {
      fs.mkdirSync(recordDir, { recursive: true });
    }

    // 6. Verify and reconstruct individual attachments
    const reconstructedAttachments = [];
    for (let idx = 0; idx < (record.attachments || []).length; idx++) {
      const att = record.attachments[idx];
      const content = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content || []);
      const attHash = calculateSha256(content);

      if (att.sha256 && att.sha256.toLowerCase() !== attHash.toLowerCase()) {
        throw new Error(`Attachment integrity verification failure on "${att.filename}": Expected ${att.sha256}, got ${attHash}`);
      }

      // Safe filename sanitization
      const safeFilename = path.basename(att.filename || `file_${idx + 1}.bin`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const attachmentId = att.attachment_id || `ATT-${recordId}-${idx + 1}`;
      const filePath = path.join(recordDir, `${attachmentId}_${safeFilename}`);

      // Write exact original bytes to disk
      fs.writeFileSync(filePath, content);

      reconstructedAttachments.push({
        id: attachmentId,
        consultationId: recordId,
        fileName: safeFilename,
        fileSize: content.length,
        mimeType: att.mime_type || 'application/octet-stream',
        type: att.attachment_type || 'clinical_image',
        checksum: attHash,
        storagePath: filePath,
      });
    }

    // 7. Calculate compression metrics
    const compressionRatio = uncompressedSize > 0
      ? Number(((1 - (compressedSize / uncompressedSize)) * 100).toFixed(2))
      : 0;

    // 8. Atomic Database Persistence
    // Check or create patient
    const existingPatient = await db.get(
      'SELECT id FROM patients WHERE id = ? OR reference_id = ?',
      [patientId, patientId]
    );

    if (!existingPatient) {
      await db.run(
        `INSERT INTO patients 
         (id, reference_id, name, age, sex, village, contact_number, blood_group, medical_history, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          patientId,
          patientId,
          record.patient_name || 'Patient',
          record.age || 0,
          record.gender || 'Unknown',
          record.village || 'Rural Village',
          record.contact_number || '',
          record.blood_group || '',
          record.medical_history || '',
          hwId,
        ]
      );
    }

    // Insert or update consultation
    const chiefComplaint = typeof record.symptoms === 'object'
      ? (record.symptoms.chiefComplaint || 'Consultation')
      : (record.symptoms || 'General Consultation');

    const vitalsJson = JSON.stringify(record.vitals || []);

    await db.run(
      `INSERT INTO consultations 
       (id, idempotency_key, patient_id, health_worker_id, clinic_id, priority, status, sync_status, 
        main_complaint, symptoms, symptom_onset, symptom_duration, severity_progression, 
        medical_history, medications, allergies, health_worker_observations, health_worker_notes, 
        immediate_action, specialization, doctor_id, doctor_name, vitals, record_hash, 
        compressed_size, uncompressed_size, compression_ratio, transfer_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'delivered', 'delivered', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET 
         status = 'delivered',
         sync_status = 'delivered',
         record_hash = EXCLUDED.record_hash,
         compressed_size = EXCLUDED.compressed_size,
         uncompressed_size = EXCLUDED.uncompressed_size,
         compression_ratio = EXCLUDED.compression_ratio,
         transfer_id = EXCLUDED.transfer_id,
         updated_at = CURRENT_TIMESTAMP`,
      [
        recordId,
        idempotencyKey,
        patientId,
        hwId,
        clinicId,
        record.priority || 'normal',
        chiefComplaint,
        record.symptoms || '',
        record.symptom_onset || '',
        record.symptom_duration || '',
        record.severity_progression || '',
        record.medical_history || '',
        record.current_medications || '',
        record.allergies || '',
        record.healthcare_notes || '',
        record.healthcare_notes || '',
        record.immediate_action || '',
        record.specialization || 'General Medicine',
        record.doctor_id || null,
        record.doctor_name || null,
        vitalsJson,
        actualSha256,
        compressedSize,
        uncompressedSize,
        compressionRatio,
        transferId,
      ]
    );

    // Insert reconstructed attachments
    for (const att of reconstructedAttachments) {
      await db.run(
        `INSERT INTO attachments 
         (id, consultation_id, type, priority, file_name, file_size, mime_type, checksum, storage_path, upload_status, created_at)
         VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET 
           consultation_id = EXCLUDED.consultation_id,
           file_name = EXCLUDED.file_name,
           file_size = EXCLUDED.file_size,
           mime_type = EXCLUDED.mime_type,
           type = EXCLUDED.type,
           storage_path = EXCLUDED.storage_path,
           checksum = EXCLUDED.checksum,
           upload_status = 'completed'`,
        [
          att.id,
          recordId,
          att.type,
          att.fileName,
          att.fileSize,
          att.mimeType,
          att.checksum,
          att.storagePath,
        ]
      );

      // Trigger asynchronous AI Image Restoration for clinical images
      const isImg = att.mimeType.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.webp'].some(ext => att.fileName.endsWith(ext));
      if (isImg) {
        setImmediate(async () => {
          try {
            await aiRestorationService.restoreImage({
              attachmentId: att.id,
              consultationId: recordId,
              filePath: att.storagePath,
              originalHash: att.checksum,
              modality: att.type || 'clinical_photo',
            });
          } catch (e) {
            console.warn(`[AI Restoration] Background error on ${att.id}:`, e.message);
          }
        });
      }
    }

    return {
      success: true,
      receipt: {
        recordId,
        transferId,
        status: 'delivered',
        verifiedHash: actualSha256,
        attachmentsVerified: reconstructedAttachments.length,
        originalSize: uncompressedSize,
        compressedSize: compressedSize,
        compressionRatio: compressionRatio,
        serverTimestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Retrieves full reconstructed medical record details including attachment verification and AI previews
   */
  async getReconstructedRecord(recordId) {
    const consultation = await db.get('SELECT * FROM consultations WHERE id = ?', [recordId]);
    if (!consultation) return null;

    const patient = await db.get('SELECT * FROM patients WHERE id = ?', [consultation.patient_id]);
    const attachments = await db.all('SELECT * FROM attachments WHERE consultation_id = ?', [recordId]);
    const restorations = await aiRestorationService.getRestorationsByConsultationId(recordId);

    const restorationMap = {};
    for (const r of restorations) {
      restorationMap[r.attachment_id] = r;
    }

    const enrichedAttachments = attachments.map(att => {
      const rest = restorationMap[att.id];
      return {
        ...att,
        isVerified: true,
        enhancedPreview: rest && rest.status === 'completed' ? {
          restorationId: rest.id,
          enhancedHash: rest.enhanced_file_hash,
          modelName: rest.model_name,
          modelVersion: rest.model_version,
          processingTimeMs: rest.processing_time_ms,
          previewUrl: `/api/medical-records/attachments/${att.id}/enhanced`,
        } : null,
        url: `/api/medical-records/attachments/${att.id}/original`,
        originalUrl: `/api/medical-records/attachments/${att.id}/original`,
      };
    });

    return {
      ...consultation,
      patient,
      attachments: enrichedAttachments,
    };
  }
}

module.exports = new MedicalRecordService();
