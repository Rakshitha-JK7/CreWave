# CareWave – Rural Telemedicine Frontend

> **Enabling Reliable Telemedicine for Rural Clinics over 2G Networks**

CareWave is a specialized telemedicine platform engineered for resource-constrained rural clinics operating over slow, unstable, or intermittent 2G cellular networks. It enables rural healthcare workers to record comprehensive patient consultations, preserve clinical data locally with zero data loss, transmit prioritized vitals and symptoms ahead of heavy attachments, and receive remote specialist doctor advice and prescriptions.

---

## 🚀 Quick Start

### 1. Installation

```bash
cd frontend
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configuration keys:
- `VITE_API_BASE_URL`: Base URL for the backend API (Default: `http://localhost:5000/api`)
- `VITE_ENV`: `development` or `production`

### 3. Run Development Server

```bash
npm run dev
```

### 4. Build for Production

```bash
npm run build
```

---

## 🏛 Application Structure & Navigation

The platform features three independent, fully functional dashboards accessible from the landing page role-selector (`/`):

| Role | Landing Route | Key Capabilities |
| :--- | :--- | :--- |
| **Welcome / Role Selector** | `/` | Temporary landing page for role testing (Authentication in Phase 7) |
| **Rural Healthcare Worker** | `/health-worker` | Patient registration, multi-section consultation creation, offline drafts, vitals, attachment queue, doctor response delivery, network diagnostics |
| **Remote Doctor** | `/doctor` | Incoming triage, priority sorting, multi-section clinical case review, attachment inspector, prescription issuance, signed response submission |
| **Patient** | `/patient` | Patient portal, timeline tracker, longitudinal vitals history, doctor advice viewer, printable prescription slips, profile updates |

### Detailed Route Map

```
/                                   -> Home (Role Selector)

/health-worker                      -> Healthcare Worker Dashboard
/health-worker/register-patient     -> Register New Patient
/health-worker/patients             -> Patient Records Directory
/health-worker/new-consultation     -> Multi-Section Consultation Form
/health-worker/consultations        -> Consultation History Table
/health-worker/pending-uploads      -> 2G Offline Queue & Resumable Transfer Manager
/health-worker/responses            -> Received Doctor Advice & Delivery Tracker
/health-worker/network              -> Live 2G Link Monitor & Bandwidth Simulator

/doctor                             -> Doctor Overview & Triage Dashboard
/doctor/incoming                    -> Incoming Consultations Filterable Table
/doctor/consultation/:id            -> Clinical Case Review & Attachment Viewer
/doctor/response/:id                -> Specialist Prescription & Assessment Form
/doctor/reviewed                    -> Reviewed Cases Archive
/doctor/patients                    -> Rural Patient Directory
/doctor/notifications               -> Urgent Alert Center

/patient                            -> Patient Dashboard & Status Stepper
/patient/profile                    -> Permitted Profile & Emergency Contact Updates
/patient/consultations              -> Personal Consultation History
/patient/records                    -> Biometric Vitals History & Attachments
/patient/advice                     -> Official Doctor Advice & Prescription Viewer
/patient/notifications              -> Patient Alert Center
```

---

## 📡 2G Low-Bandwidth Communication Architecture

The frontend is built around clean boundaries for the communication developer's synchronization engine:

### 1. Zero Data Loss Client Persistence (`src/offline/indexedDB.js`)
- Uses browser **IndexedDB** (`carewave-db`) with dedicated stores for `consultations`, `patients`, `drafts`, `pendingQueue`, `attachments`, and `doctorResponses`.
- Auto-saves form progress as drafts. Form drafts and unsent consultations survive browser refreshes, app restarts, and complete device power loss.

### 2. Communication Module Boundary (`src/offline/offlineQueue.js`)
Exposes standardized adapter methods ready for direct hookup to the communication developer's module:
- `saveConsultationLocally(consultation)`: Pre-sync storage.
- `enqueueConsultation(consultationId, options)`: Registers consultation with assigned priority levels.
- `getPendingUploads()`: Queries active transmission queue.
- `resumeUpload(consultationId)`: Signals resuming of paused chunks without restarting from byte 0.
- `retryUpload(consultationId)`: Retries failed fragments.
- `cancelUpload(consultationId)`: Safely removes from queue.
- `syncDoctorResponses()`: Retrieves and synchronizes specialist responses from server.

### 3. Priority-Based Transmission Hierarchy
1. **Priority 1 (Crucial Clinical Data):** Patient demographic data, chief complaints, duration, severity, and measured vital signs are packaged into ultralight JSON payloads (< 2 KB) transmitted within seconds.
2. **Priority 2 (Diagnostic Reports):** 12-lead ECG files and lab summaries.
3. **Priority 3 (High-Resolution Media):** Clinical photos, chest X-rays, and multi-megabyte attachments.

### 4. Resumable Chunked Uploads (`src/services/uploadService.js`)
Attachments are partitioned into 16KB/32KB chunks via:
- `POST /uploads/init`
- `PUT /uploads/:id/chunks/:index`
- `GET /uploads/:id/status`
- `POST /uploads/:id/complete`

---

## 🧪 Demonstration & Testing Guide

To test the complete end-to-end clinical workflow:

1. **Role Selection (`/`):** Click **"Open Healthcare Worker Dashboard"**.
2. **Register a Patient (`/health-worker/register-patient`):**
   - Fill in patient name, age, village, chronic conditions, and allergies.
   - Click **Save Patient Record**. Note the generated Patient ID.
3. **Initiate Consultation (`/health-worker/new-consultation`):**
   - Select the registered patient.
   - Fill in symptoms (chief complaint, duration, onset, severity).
   - Enter vitals (BP: 130/85, HR: 84 bpm, Temp: 38.2 °C, SpO2: 97%).
   - Select Urgency Level (e.g., High).
   - Click **Save Draft** to verify local IndexedDB draft saving.
   - Click **Submit Consultation** -> Case is saved and queued for transfer.
4. **Inspect Offline Transmission Queue (`/health-worker/pending-uploads`):**
   - View the consultation in the queue with chunked progress.
   - Test **Pause**, **Resume**, and **Sync All Pending** actions.
5. **Switch to Doctor Role (`/` -> Doctor Dashboard):**
   - Navigate to `/doctor/incoming`.
   - Click on the incoming consultation to inspect vitals and symptoms.
   - Click **Start Review** -> opens `/doctor/response/:id`.
   - Fill in clinical assessment, add medications (e.g., Paracetamol 500mg, Amoxicillin 500mg), follow-up advice.
   - Click **Sign & Submit Response** -> Response is cryptographically logged and locked.
6. **Return to Healthcare Worker (`/health-worker/responses`):**
   - Notice the received doctor advice for the patient.
   - Click **Print Prescription** to generate a clinical slip.
   - Click **Mark as Communicated** -> records that advice was explained to the patient.
7. **View as Patient (`/patient`):**
   - Open `/patient/advice` to view the doctor's assessment and prescribed medications.
   - Open `/patient/records` to view the longitudinal table of measured vitals.
8. **Simulate 2G & Offline Outages (`/health-worker/network`):**
   - Use the **Hackathon Evaluator Network Simulation** buttons to switch between **Auto-Detect**, **Simulate Rural 2G**, and **Simulate Full Disconnection**.
