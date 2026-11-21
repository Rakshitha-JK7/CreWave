-- CareWave Migration: 003_doctor_selection_and_specialization
-- Adds doctor selection, target specialization, and assignment to consultations

ALTER TABLE consultations ADD COLUMN IF NOT EXISTS specialization VARCHAR(100);
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS doctor_id VARCHAR(64);
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS doctor_name VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_consultations_doctor ON consultations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_consultations_specialization ON consultations(specialization);
