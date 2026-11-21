/**
 * CareBridge Unified Protocol Buffers Codec (Browser & Client)
 * Provides high-efficiency binary serialization and exact deserialization for medical records.
 */

import protobuf from 'protobufjs';

const PROTO_DEFINITION = `
syntax = "proto3";

package carebridge;

message MedicalRecord {
  uint32 schema_version = 1;

  string record_id = 2;
  string patient_id = 3;
  string patient_name = 4;

  uint32 age = 5;
  string gender = 6;
  string village = 7;
  string contact_number = 8;
  string blood_group = 9;

  string symptoms = 10;
  string symptom_onset = 11;
  string symptom_duration = 12;
  string severity_progression = 13;
  string medical_history = 14;
  string current_medications = 15;
  string allergies = 16;
  string healthcare_notes = 17;
  string immediate_action = 18;
  string priority = 19;
  string specialization = 20;
  string doctor_id = 21;
  string doctor_name = 22;

  repeated Vital vitals = 23;
  repeated Attachment attachments = 24;

  string healthcare_worker_id = 25;
  string healthcare_worker_name = 26;
  string clinic_id = 27;
  string consultation_timestamp = 28;
  string idempotency_key = 29;
}

message Vital {
  string name = 1;
  string value = 2;
  string unit = 3;
}

message Attachment {
  string attachment_id = 1;
  string filename = 2;
  string mime_type = 3;
  string attachment_type = 4;
  uint64 original_size = 5;
  bytes content = 6;
  string sha256 = 7;
}

message DoctorResponseRecord {
  uint32 schema_version = 1;
  string response_id = 2;
  string consultation_id = 3;
  string doctor_id = 4;
  string doctor_name = 5;
  string review_timestamp = 6;
  string assessment = 7;
  string recommended_steps = 8;
  string follow_up_advice = 9;
  bool referral_required = 10;
  string referral_details = 11;
  string prescription_text = 12;
  repeated PrescriptionItem prescriptions = 13;
  repeated Attachment attachments = 14;
  string sha256 = 15;
}

message PrescriptionItem {
  string medicine_name = 1;
  string dosage = 2;
  string frequency = 3;
  string duration = 4;
  string instructions = 5;
}
`;

const parsedRoot = protobuf.parse(PROTO_DEFINITION, { keepCase: true }).root;
export const MedicalRecordType = parsedRoot.lookupType('carebridge.MedicalRecord');
export const DoctorResponseRecordType = parsedRoot.lookupType('carebridge.DoctorResponseRecord');

/**
 * Computes SHA-256 hash in browser using Web Crypto API or fallback
 * @param {Uint8Array|ArrayBuffer} data 
 * @returns {Promise<string>} hex string
 */
export async function calculateSha256(data) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buffer = data.buffer ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data;
    const hashBuf = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuf));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback simple checksum if WebCrypto unavailable in test runner
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data[i];
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

/**
 * Encodes a complete medical record object into Protocol Buffers binary (Uint8Array)
 * @param {object} recordData 
 * @returns {Promise<Uint8Array>}
 */
export async function encodeMedicalRecord(recordData) {
  const processedAttachments = [];
  for (let idx = 0; idx < (recordData.attachments || []).length; idx++) {
    const att = recordData.attachments[idx];
    let uint8Content;
    if (att.content instanceof Uint8Array) {
      uint8Content = att.content;
    } else if (att.content instanceof ArrayBuffer) {
      uint8Content = new Uint8Array(att.content);
    } else if (typeof att.content === 'string') {
      // Decode base64
      const binaryStr = atob(att.content);
      uint8Content = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        uint8Content[i] = binaryStr.charCodeAt(i);
      }
    } else if (att.file instanceof File || att.file instanceof Blob) {
      const buf = await att.file.arrayBuffer();
      uint8Content = new Uint8Array(buf);
    } else {
      uint8Content = new Uint8Array(0);
    }

    const sha256 = att.sha256 || await calculateSha256(uint8Content);
    processedAttachments.push({
      attachment_id: att.attachment_id || att.id || `ATT-${idx + 1}`,
      filename: att.filename || att.name || `file_${idx + 1}.bin`,
      mime_type: att.mime_type || att.mimeType || att.type || 'application/octet-stream',
      attachment_type: att.attachment_type || att.type || 'other',
      original_size: att.original_size || uint8Content.length,
      content: uint8Content,
      sha256: sha256,
    });
  }

  const payload = {
    schema_version: recordData.schema_version || 1,
    record_id: recordData.record_id || recordData.id || `REC-${Date.now()}`,
    patient_id: recordData.patient_id || recordData.patientId || 'PAT-UNKNOWN',
    patient_name: recordData.patient_name || recordData.patientName || '',
    age: Number(recordData.age) || 0,
    gender: recordData.gender || recordData.sex || '',
    village: recordData.village || '',
    contact_number: recordData.contact_number || recordData.contactNumber || recordData.phone || '',
    blood_group: recordData.blood_group || recordData.bloodGroup || '',
    symptoms: typeof recordData.symptoms === 'object' ? JSON.stringify(recordData.symptoms) : String(recordData.symptoms || ''),
    symptom_onset: recordData.symptom_onset || recordData.symptomOnset || '',
    symptom_duration: recordData.symptom_duration || recordData.symptomDuration || '',
    severity_progression: recordData.severity_progression || recordData.severityProgression || '',
    medical_history: recordData.medical_history || recordData.medicalHistory || '',
    current_medications: recordData.current_medications || recordData.currentMedications || recordData.medications || '',
    allergies: recordData.allergies || '',
    healthcare_notes: recordData.healthcare_notes || recordData.healthcareNotes || recordData.clinicalNotes || '',
    immediate_action: recordData.immediate_action || recordData.immediateAction || '',
    priority: recordData.priority || recordData.urgency || 'normal',
    specialization: recordData.specialization || 'General Medicine',
    doctor_id: recordData.doctor_id || recordData.doctorId || '',
    doctor_name: recordData.doctor_name || recordData.doctorName || '',
    vitals: (recordData.vitals || []).map(v => ({
      name: v.name || '',
      value: String(v.value !== undefined ? v.value : ''),
      unit: v.unit || '',
    })),
    attachments: processedAttachments,
    healthcare_worker_id: recordData.healthcare_worker_id || recordData.healthWorkerId || '',
    healthcare_worker_name: recordData.healthcare_worker_name || recordData.healthWorkerName || '',
    clinic_id: recordData.clinic_id || recordData.clinicId || 'CLINIC-RURAL-01',
    consultation_timestamp: recordData.consultation_timestamp || recordData.consultationDate || new Date().toISOString(),
    idempotency_key: recordData.idempotency_key || recordData.idempotencyKey || `IDEMP-${Date.now()}`,
  };

  const errMsg = MedicalRecordType.verify(payload);
  if (errMsg) throw new Error(`Medical record validation failed: ${errMsg}`);

  const msg = MedicalRecordType.create(payload);
  return MedicalRecordType.encode(msg).finish();
}

/**
 * Deserializes Protocol Buffers binary into structured medical record
 * @param {Uint8Array} binaryBuffer 
 * @returns {object}
 */
export function decodeMedicalRecord(binaryBuffer) {
  const msg = MedicalRecordType.decode(binaryBuffer);
  return MedicalRecordType.toObject(msg, { defaults: true });
}

export default {
  calculateSha256,
  encodeMedicalRecord,
  decodeMedicalRecord,
  MedicalRecordType,
  DoctorResponseRecordType,
};
