# CareWave Backend — Rural Telemedicine Service

CareWave backend is an offline-first, priority-driven consultation and chunked resumable upload service built for rural clinics operating over weak or intermittent 2G/constrained networks.

---

## Architecture & Responsibilities (Individual 2 — Backend Developer)

- **Consultation Lifecycle**: State transitions from `created` → `received_by_server` → `available_to_doctor` → `in_review` → `response_submitted` → `response_received_by_clinic`.
- **Idempotency Engine**: Stable retry keys prevent duplicate consultations during network reconnects.
- **Resumable Chunked Upload Engine**:
  - Upload session initialization
  - Per-chunk idempotent storage & verification
  - Missing-chunk tracking for resume after network interruptions
  - Server-side file reassembly and SHA-256 integrity checks
- **Doctor Incoming Queue**: Priority-based sorting (`emergency` > `urgent` > `normal`) with visible attachment status flags.
- **Reverse Sync for Clinics**: Endpoint for rural clinics to poll and acknowledge doctor assessments and prescriptions.
- **Database Support**: Dual-mode database layer supporting PostgreSQL in production and zero-config Node.js built-in SQLite for instant local development/hackathon demos.

---

## Quick Start

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Default configuration runs on port `5000` with zero-config SQLite. To connect to PostgreSQL:
```env
DB_CLIENT=postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/carewave
```

### 3. Seed Synthetic Test Data
Pre-populates demo patient `PAT-DEMO-1024`, consultation `CW-DEMO-001`, and accounts:
```bash
npm run seed
```

### 4. Run Automated Test Suite
Executes the comprehensive 24-test suite covering all API contracts and upload workflows:
```bash
npm test
```

### 5. Start the Server
```bash
npm start
# or development auto-reload:
npm run dev
```

---

## Demo Accounts (Pre-Seeded)

| Role | Username | Password | ID | Description |
|---|---|---|---|---|
| **Health Worker** | `worker1` | `password123` | `HW-DEMO-01` | Asha Devi (CHW at Kalyanpur Clinic) |
| **Doctor** | `doctor1` | `password123` | `DOC-DEMO-01` | Dr. Ramesh Sharma (Tele-Specialist) |
| **Patient** | `patient1` | `password123` | `PAT-USER-1024`| Rajesh Kumar (Patient PAT-DEMO-1024) |

---

## API Contract Reference

### 1. Health & Network Assessment
- **`GET /api/ping`** or **`GET /api/health`**
  - Used by Client Network Monitor (Individual 3) to measure server reachability and latency.
  - Response: `{ status: "ok", timestamp: 1732168400000, serverTime: "...", dbEngine: "sqlite" }`

### 2. Authentication (`/api/auth`)
- `POST /api/auth/login`: `{ username, password }` → `{ user, token }`
- `POST /api/auth/register`: `{ username, password, name, role, clinicId, contactNumber }`
- `GET /api/auth/me`: Validates JWT token and returns profile
- `POST /api/auth/logout`

*Note: For early integration testing before frontend adds login screens, requests can include dev header `x-user-role: health_worker` or set `DISABLE_AUTH=true` in `.env`.*

### 3. Patients (`/api/patients`)
- `POST /api/patients`: Create patient `{ referenceId, name, age, dateOfBirth, sex, village, contactNumber, consent }`
- `GET /api/patients?search=...&village=...`: Search and list patients
- `GET /api/patients/:id`: Get patient by ID or reference ID (including past consultation history)

### 4. Consultations (`/api/consultations`)
- `POST /api/consultations`: Create consultation.
  - **Required for offline retry**: `idempotencyKey`
  - Body schema:
  ```json
  {
    "consultationId": "CW-DEMO-001",
    "idempotencyKey": "stable-uuid-retry-key",
    "patientId": "PAT-DEMO-1024",
    "clinicId": "CLINIC-RURAL-01",
    "priority": "urgent",
    "urgencyCategory": "Moderate",
    "clinicalSummary": {
      "mainComplaint": "Fever and cough",
      "symptoms": "Fever for 3 days; cough for 2 days",
      "duration": "3 days",
      "medicalHistory": "No chronic illness",
      "medications": "Paracetamol 500mg",
      "allergies": "None",
      "healthWorkerObservations": "Mild tachypnea"
    },
    "vitals": {
      "temperature": 38.2,
      "heartRate": 96,
      "bloodPressure": "120/80",
      "spo2": 94,
      "respiratoryRate": 20,
      "bloodGlucose": null
    },
    "attachments": []
  }
  ```
  - **Duplicate Handling**: If the same `idempotencyKey` is submitted again during a network retry, returns `200 OK` with `{ isDuplicate: true, consultation: ... }` without creating duplicate records.
- `GET /api/consultations/:id`: Retrieve complete consultation details, vitals, attachment upload statuses, and doctor responses.
- `PATCH /api/consultations/:id`: Update consultation fields.
- `PATCH /api/consultations/:id/review`: Doctor starts review `{ status: "in_review" | "reviewed_by_doctor", doctorName: "..." }`.
- `GET /api/consultations/:id/sync-status`: Status breakdown of Transmission Groups 1 (essential summary), 2 (supporting clinical data), and 3 (additional documents).

### 5. Doctor Queue (`/api/doctor/consultations`)
- `GET /api/doctor/consultations?status=...&priority=...`
  - Prioritized queue ordered by urgency (`emergency` > `urgent` > `normal`) and consultation time.
  - Returns `attachmentStatus: { total, completed, pending, hasPendingAttachments }` so doctors see whether ECGs or images are still uploading.

### 6. Chunked Attachment Uploads (`/api/uploads`)
1. **Init Session**:
   - `POST /api/uploads/init`
   - Body: `{ consultationId, fileName, fileSize, chunkSize, totalChunks, checksum, checksumAlgorithm: "sha256", mimeType, priority }`
   - Response: `{ uploadId, chunkSize, totalChunks, status: "initialised" }`
2. **Upload Chunk (0-indexed)**:
   - `PUT /api/uploads/:uploadId/chunks/:index`
   - Accepts raw binary (`application/octet-stream`), multipart `chunk` file, or base64.
   - Header: `x-checksum` (optional chunk checksum validation)
   - Idempotent: Retrying an already uploaded chunk does not corrupt or duplicate data.
   - Response: `{ success: true, chunkIndex, totalChunksReceived, totalChunks, isComplete }`
3. **Get Status & Resume**:
   - `GET /api/uploads/:uploadId/status`
   - Response:
   ```json
   {
     "uploadId": "UPL-...",
     "status": "uploading",
     "totalChunks": 3,
     "receivedChunks": [0, 2],
     "missingChunks": [1],
     "progressPercent": 67,
     "isComplete": false
   }
   ```
4. **Complete & Verify Reassembly**:
   - `POST /api/uploads/:uploadId/complete`
   - Body: `{ finalChecksum: "..." }`
   - Reassembles all chunks in disk, validates SHA-256 checksum, updates attachment status to `completed`, and cleans up chunks.

### 7. Doctor Response & Rural Clinic Sync (`/api/sync` and `/api/responses`)
- `POST /api/consultations/:id/responses`: Doctor submits advice, prescription, and referral recommendation.
- `GET /api/sync/responses?clinicId=CLINIC-RURAL-01`: Rural clinic polls this endpoint to fetch newly submitted doctor responses when connectivity is restored.
- `PATCH /api/responses/:id/acknowledge`: Clinic acknowledges receipt of response; marks delivery complete and updates consultation status to `response_received_by_clinic`.
