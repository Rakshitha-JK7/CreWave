-- CareWave Database Schema
-- Version: 001_initial_schema
-- Dialect: PostgreSQL / SQLite compatible

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(150),
  password_hash TEXT NOT NULL,
  name VARCHAR(150) NOT NULL,
  role VARCHAR(50) NOT NULL, -- 'health_worker', 'doctor', 'patient', 'admin'
  status VARCHAR(50) DEFAULT 'active',
  clinic_id VARCHAR(64),
  contact_number VARCHAR(50),
  specialization VARCHAR(100),
  license_number VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patients (
  id VARCHAR(64) PRIMARY KEY,
  reference_id VARCHAR(64) UNIQUE NOT NULL,
  user_id VARCHAR(64),
  name VARCHAR(150),
  age INTEGER NOT NULL,
  date_of_birth VARCHAR(50),
  sex VARCHAR(20),
  village VARCHAR(150) NOT NULL,
  contact_number VARCHAR(50),
  consent BOOLEAN DEFAULT TRUE,
  blood_group VARCHAR(20),
  emergency_contact VARCHAR(100),
  medical_history TEXT,
  allergies TEXT,
  created_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS consultations (
  id VARCHAR(64) PRIMARY KEY,
  idempotency_key VARCHAR(128) UNIQUE NOT NULL,
  patient_id VARCHAR(64) NOT NULL,
  health_worker_id VARCHAR(64) NOT NULL,
  clinic_id VARCHAR(64) NOT NULL,
  consultation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  priority VARCHAR(50) DEFAULT 'normal', -- 'normal', 'urgent', 'emergency'
  status VARCHAR(60) DEFAULT 'received_by_server', -- 'created', 'saved_locally', 'upload_pending', 'received_by_server', 'available_to_doctor', 'in_review', 'reviewed_by_doctor', 'response_submitted', 'response_received_by_clinic'
  sync_status VARCHAR(50) DEFAULT 'delivered', -- 'pending', 'partial', 'delivered', 'failed'
  main_complaint TEXT NOT NULL,
  symptoms TEXT,
  symptom_onset VARCHAR(100),
  symptom_duration VARCHAR(100),
  severity_progression VARCHAR(100),
  medical_history TEXT,
  medications TEXT,
  allergies TEXT,
  health_worker_observations TEXT,
  health_worker_notes TEXT,
  measurements_unavailable TEXT,
  urgency_category VARCHAR(50),
  immediate_action TEXT,
  consent_status BOOLEAN DEFAULT TRUE,
  vitals TEXT, -- JSON-stringified vitals structure
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attachments (
  id VARCHAR(64) PRIMARY KEY,
  consultation_id VARCHAR(64) NOT NULL,
  component_id VARCHAR(64),
  type VARCHAR(50) NOT NULL, -- 'ecg', 'clinical_image', 'lab_report', 'prescription', 'voice_note', 'other'
  priority INTEGER DEFAULT 2, -- 1=essential, 2=clinically important, 3=additional
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100),
  checksum VARCHAR(128),
  checksum_algorithm VARCHAR(20) DEFAULT 'sha256',
  storage_path TEXT,
  upload_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'uploading', 'partial', 'completed', 'failed'
  capture_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS upload_sessions (
  id VARCHAR(64) PRIMARY KEY,
  consultation_id VARCHAR(64) NOT NULL,
  attachment_id VARCHAR(64),
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  chunk_size INTEGER NOT NULL,
  total_chunks INTEGER NOT NULL,
  expected_checksum VARCHAR(128),
  checksum_algorithm VARCHAR(20) DEFAULT 'sha256',
  mime_type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'initialised', -- 'initialised', 'uploading', 'completed', 'failed', 'expired'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS upload_chunks (
  upload_id VARCHAR(64) NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_size INTEGER NOT NULL,
  checksum VARCHAR(128),
  storage_path TEXT NOT NULL,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (upload_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS doctor_responses (
  id VARCHAR(64) PRIMARY KEY,
  consultation_id VARCHAR(64) NOT NULL,
  doctor_id VARCHAR(64) NOT NULL,
  doctor_name VARCHAR(150) NOT NULL,
  review_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assessment TEXT NOT NULL,
  recommended_steps TEXT,
  follow_up_advice TEXT,
  referral_required BOOLEAN DEFAULT FALSE,
  referral_details TEXT,
  prescription_text TEXT,
  prescription_document_path TEXT,
  delivery_status VARCHAR(50) DEFAULT 'submitted', -- 'submitted', 'available', 'synced_to_clinic', 'acknowledged'
  clinic_acknowledged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_events (
  id VARCHAR(64) PRIMARY KEY,
  consultation_id VARCHAR(64),
  event_type VARCHAR(100) NOT NULL,
  client_id VARCHAR(64),
  payload TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_patients_ref ON patients(reference_id);
CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);
CREATE INDEX IF NOT EXISTS idx_consultations_priority ON consultations(priority);
CREATE INDEX IF NOT EXISTS idx_consultations_clinic ON consultations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_attachments_consultation ON attachments(consultation_id);
CREATE INDEX IF NOT EXISTS idx_upload_chunks_upload ON upload_chunks(upload_id);
CREATE INDEX IF NOT EXISTS idx_doctor_responses_consultation ON doctor_responses(consultation_id);
CREATE INDEX IF NOT EXISTS idx_doctor_responses_delivery ON doctor_responses(delivery_status);
