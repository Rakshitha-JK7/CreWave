-- CareBridge Migration: 004_carebridge_unified_telemetry
-- Adds support for unified protobuf telemetry, exact verification hashes, compression stats, and receiver-side AI image restorations

ALTER TABLE consultations ADD COLUMN IF NOT EXISTS record_hash VARCHAR(128);
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS compressed_size BIGINT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS uncompressed_size BIGINT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS compression_ratio NUMERIC(5,2);
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS transfer_id VARCHAR(64);

CREATE TABLE IF NOT EXISTS image_restorations (
  id VARCHAR(64) PRIMARY KEY,
  attachment_id VARCHAR(64) NOT NULL,
  consultation_id VARCHAR(64) NOT NULL,
  original_file_path TEXT NOT NULL,
  original_file_hash VARCHAR(128) NOT NULL,
  enhanced_file_path TEXT,
  enhanced_file_hash VARCHAR(128),
  modality VARCHAR(50) DEFAULT 'clinical_photo',
  model_name VARCHAR(100),
  model_version VARCHAR(50),
  processing_config TEXT,
  processing_time_ms INTEGER,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'skipped_unsupported_modality', 'failed'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_image_restorations_attachment ON image_restorations(attachment_id);
CREATE INDEX IF NOT EXISTS idx_image_restorations_consultation ON image_restorations(consultation_id);
CREATE INDEX IF NOT EXISTS idx_consultations_transfer ON consultations(transfer_id);
CREATE INDEX IF NOT EXISTS idx_consultations_record_hash ON consultations(record_hash);
