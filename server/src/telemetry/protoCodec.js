/**
 * CareBridge Unified Protocol Buffers Codec (Server & Node.js)
 * Provides high-efficiency binary serialization and exact deserialization for medical records.
 */

const protobuf = require('protobufjs');
const crypto = require('crypto');

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

// Parse root once
const parsedRoot = protobuf.parse(PROTO_DEFINITION, { keepCase: true }).root;
const MedicalRecordType = parsedRoot.lookupType('carebridge.MedicalRecord');
const DoctorResponseRecordType = parsedRoot.lookupType('carebridge.DoctorResponseRecord');

/**
 * Calculates SHA-256 of any binary buffer or string
 * @param {Buffer|Uint8Array|string} data 
 * @returns {string} hex hash
 */
function calculateSha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Encodes a structured medical record object into serialized Protocol Buffers binary
 * @param {object} recordData
 * @returns {Buffer} serialized binary buffer
 */
function encodeMedicalRecord(recordData) {
  // Normalize attachments to ensure content is Buffer and individual SHA-256 is computed
  const attachments = (recordData.attachments || []).map((att, idx) => {
    let contentBuf = att.content;
    if (typeof contentBuf === 'string') {
      contentBuf = Buffer.from(contentBuf, 'base64');
    } else if (!Buffer.isBuffer(contentBuf) && contentBuf instanceof Uint8Array) {
      contentBuf = Buffer.from(contentBuf);
    } else if (!Buffer.isBuffer(contentBuf)) {
      contentBuf = Buffer.from(contentBuf || '');
    }

    const sha256 = att.sha256 || calculateSha256(contentBuf);
    return {
      attachment_id: att.attachment_id || att.id || `ATT-${idx + 1}`,
      filename: att.filename || att.name || `file_${idx + 1}.bin`,
      mime_type: att.mime_type || att.mimeType || 'application/octet-stream',
      attachment_type: att.attachment_type || att.type || 'other',
      original_size: att.original_size || contentBuf.length,
      content: contentBuf,
      sha256: sha256,
    };
  });

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
    attachments: attachments,
    healthcare_worker_id: recordData.healthcare_worker_id || recordData.healthWorkerId || '',
    healthcare_worker_name: recordData.healthcare_worker_name || recordData.healthWorkerName || '',
    clinic_id: recordData.clinic_id || recordData.clinicId || 'CLINIC-RURAL-01',
    consultation_timestamp: recordData.consultation_timestamp || recordData.consultationDate || new Date().toISOString(),
    idempotency_key: recordData.idempotency_key || recordData.idempotencyKey || `IDEMP-${Date.now()}`,
  };

  const errMsg = MedicalRecordType.verify(payload);
  if (errMsg) {
    throw new Error(`Protobuf verification failed: ${errMsg}`);
  }

  const message = MedicalRecordType.create(payload);
  const encoded = MedicalRecordType.encode(message).finish();
  return Buffer.from(encoded);
}

/**
 * Deserializes a Protocol Buffers binary buffer into structured medical record object
 * @param {Buffer|Uint8Array} binaryBuffer 
 * @returns {object} decoded record with attachments as Buffers
 */
function decodeMedicalRecord(binaryBuffer) {
  if (!binaryBuffer || binaryBuffer.length === 0) {
    throw new Error('Cannot decode empty binary buffer');
  }

  const message = MedicalRecordType.decode(binaryBuffer);
  const obj = MedicalRecordType.toObject(message, {
    defaults: true,
    bytes: Buffer, // Convert bytes fields directly to Buffers
  });

  // Ensure attachments content is genuine Node Buffer
  if (Array.isArray(obj.attachments)) {
    obj.attachments = obj.attachments.map(att => ({
      ...att,
      content: Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content || []),
    }));
  }

  return obj;
}

/**
 * Encodes a DoctorResponseRecord into Protocol Buffers binary
 */
function encodeDoctorResponse(responseData) {
  const payload = {
    schema_version: responseData.schema_version || 1,
    response_id: responseData.response_id || responseData.id || `RESP-${Date.now()}`,
    consultation_id: responseData.consultation_id || responseData.consultationId,
    doctor_id: responseData.doctor_id || responseData.doctorId,
    doctor_name: responseData.doctor_name || responseData.doctorName || 'Specialist Doctor',
    review_timestamp: responseData.review_timestamp || new Date().toISOString(),
    assessment: responseData.assessment || '',
    recommended_steps: responseData.recommended_steps || responseData.recommendations || '',
    follow_up_advice: responseData.follow_up_advice || responseData.followUpInstructions || '',
    referral_required: Boolean(responseData.referral_required || responseData.referral?.recommended),
    referral_details: responseData.referral_details || responseData.referral?.details || '',
    prescription_text: responseData.prescription_text || '',
    prescriptions: (responseData.prescriptions || []).map(p => ({
      medicine_name: p.medicine_name || p.medicineName || '',
      dosage: p.dosage || '',
      frequency: p.frequency || '',
      duration: p.duration || '',
      instructions: p.instructions || '',
    })),
    attachments: (responseData.attachments || []).map((att, idx) => {
      const contentBuf = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content || '');
      return {
        attachment_id: att.attachment_id || `RESP-ATT-${idx + 1}`,
        filename: att.filename || `file_${idx + 1}.bin`,
        mime_type: att.mime_type || 'application/octet-stream',
        attachment_type: att.attachment_type || 'prescription',
        original_size: contentBuf.length,
        content: contentBuf,
        sha256: att.sha256 || calculateSha256(contentBuf),
      };
    }),
    sha256: '',
  };

  const errMsg = DoctorResponseRecordType.verify(payload);
  if (errMsg) throw new Error(`DoctorResponse verification error: ${errMsg}`);

  const msg = DoctorResponseRecordType.create(payload);
  const encoded = DoctorResponseRecordType.encode(msg).finish();
  return Buffer.from(encoded);
}

/**
 * Deserializes a DoctorResponseRecord binary buffer
 */
function decodeDoctorResponse(binaryBuffer) {
  const message = DoctorResponseRecordType.decode(binaryBuffer);
  const obj = DoctorResponseRecordType.toObject(message, {
    defaults: true,
    bytes: Buffer,
  });
  if (Array.isArray(obj.attachments)) {
    obj.attachments = obj.attachments.map(att => ({
      ...att,
      content: Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content || []),
    }));
  }
  return obj;
}

module.exports = {
  calculateSha256,
  encodeMedicalRecord,
  decodeMedicalRecord,
  encodeDoctorResponse,
  decodeDoctorResponse,
  MedicalRecordType,
  DoctorResponseRecordType,
};
