-- CareWave Migration: 002_rbac_approval_and_indexes
-- Description: Adds user email, account approval status, professional credentials, and RBAC indexes
-- Compatible: PostgreSQL and SQLite

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(50) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table extensions for RBAC and approval workflow
ALTER TABLE users ADD COLUMN email VARCHAR(150);
ALTER TABLE users ADD COLUMN status VARCHAR(50) DEFAULT 'active';
ALTER TABLE users ADD COLUMN specialization VARCHAR(100);
ALTER TABLE users ADD COLUMN license_number VARCHAR(100);

-- Patients table extensions
ALTER TABLE patients ADD COLUMN user_id VARCHAR(64);

-- Unique index on email and lookup indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_consultations_hw ON consultations(health_worker_id);
CREATE INDEX IF NOT EXISTS idx_patients_user ON patients(user_id);
