# CareWave -- Bits2Wave

## 24-Hour Hackathon Development Plan

**Project:** Enabling Reliable Telemedicine for Rural Clinics over 2G
Networks\
**Team structure:** 3 developers --- Frontend, Backend, Communication
Mechanism\
**Implementation constraint:** Authentication and user management will
be completed in the final phase.

------------------------------------------------------------------------

## 1. Project Overview

CareWave is an offline-first telemedicine prototype designed to help
rural healthcare workers send structured patient consultation
information to remote doctors even when internet connectivity is weak,
intermittent, or unavailable.

The central idea is to transmit essential clinical information first,
transfer larger attachments reliably, and resume interrupted transfers
when connectivity returns.

### Core concept

-   **Care:** Support the consultation workflow between the patient,
    rural healthcare worker, and doctor.
-   **Bits:** Represent clinical information and attachments as
    structured digital data.
-   **Wave:** Deliver that information using prioritised, resumable,
    network-aware communication.

The prototype is a communication and consultation-support system. It is
**not an autonomous diagnostic system**.

## 2. Main Users and Dashboards

The application will have three separate dashboards.

### A. Patient dashboard

The patient dashboard should allow a patient to:

-   View their profile and basic details.
-   View consultation history and current consultation status.
-   Read the doctor's advice and follow-up instructions.
-   View referral information, when provided.

For the initial assisted-clinic workflow, the rural healthcare worker
creates the consultation. Patient self-registration and self-initiated
consultations are not required for the first working prototype.

### B. Rural healthcare worker dashboard

The healthcare worker dashboard is the main data-entry point at the
rural clinic.

It should allow the healthcare worker to:

-   Register or select a patient.
-   Create a new consultation.
-   Enter symptoms, symptom duration, relevant medical history,
    allergies, and current medication.
-   Record available vitals, such as temperature, blood pressure, heart
    rate, SpO2, respiratory rate, and blood glucose where relevant and
    measured.
-   Attach an ECG or medical report when available.
-   Save the consultation locally before attempting transmission.
-   See whether each item is pending, uploading, delivered, or failed.
-   View the doctor's response after it has synchronised.

Only collect measurements that are actually available. Do not fabricate
missing values.

### C. Doctor dashboard

The doctor dashboard should allow a doctor to:

-   View incoming consultations.
-   See patient details and the clinical summary.
-   Review symptoms, history, vitals, ECGs, and reports.
-   Identify which information has arrived and which attachments are
    still transferring.
-   Submit advice, follow-up instructions, or a referral recommendation.
-   See consultation and delivery status.

The interface must clearly distinguish complete information from
partially received information.

------------------------------------------------------------------------

## 3. Communication Mechanism: End-to-End Workflow

This is the core technical contribution of the project.

1.  **Consultation creation:** The healthcare worker selects a patient
    and creates a consultation.
2.  **Structured data entry:** Symptoms, history, available vitals,
    observations, and attachments are added.
3.  **Local-first save:** The application saves the consultation in
    IndexedDB before transmission. The user should not lose entered data
    if the network disappears.
4.  **Unique identification:** Each consultation and each attachment
    receives a unique identifier. A stable idempotency key is used to
    prevent duplicate consultations during retries.
5.  **Network assessment:** The application checks server reachability
    and observes request latency, upload speed, and failures.
    `navigator.onLine` alone is not a reliable measure of internet
    availability.
6.  **Network classification:** The application classifies the
    connection as good, degraded, or disconnected based on measured
    performance.
7.  **Component preparation:** Consultation data is separated into
    components such as clinical summary, vitals, symptoms/history, ECG,
    and reports.
8.  **Prioritised transmission:** Essential clinical information is sent
    before large attachments. Clinical urgency should be assigned by the
    healthcare worker using an agreed protocol; the software must not
    independently diagnose or decide urgency.
9.  **Chunked attachment upload:** Larger files are split into chunks.
    The server acknowledges received chunks.
10. **Resume after interruption:** If the connection drops, the client
    checks the upload status and sends only missing chunks after
    reconnection.
11. **Integrity verification:** The server verifies chunk and final-file
    checksums before marking an attachment complete.
12. **Doctor-side availability:** The doctor can review the clinical
    summary as soon as it arrives, while the interface marks attachments
    that are still pending.
13. **Doctor response:** The doctor submits advice or referral
    instructions. The backend stores the response.
14. **Reverse synchronisation:** The healthcare worker's application
    retrieves the doctor's response when connectivity is available.
15. **Patient access:** The patient dashboard displays the advice and
    consultation status.

### Important communication decisions

-   The first prototype will use REST/HTTPS for consultation data and
    file transfer.
-   Use polling for response updates initially. WebSockets are optional
    if time permits.
-   WebRTC video calling is optional and should not block the core
    workflow.
-   If internet connectivity is poor but ordinary cellular voice service
    is available, the healthcare worker and doctor can use a normal
    phone call. This call is separate from CareWave's data-transfer
    mechanism.
-   No separate voice-recording or voice-upload feature is required.
-   If there is no connectivity, save the consultation locally and
    synchronise later. Urgent cases must follow the clinic's emergency
    referral procedure; they must not wait for an upload to complete.

------------------------------------------------------------------------

## 4. Three-Person Work Allocation

Each person owns a major workstream. All three must agree on the API
contract and data format before implementation proceeds independently.

## Individual 1 --- Frontend Developer

**Ownership:** React application and all three dashboards.

### Responsibilities

1.  Set up the React project and shared layout.
2.  Build the patient dashboard.
3.  Build the healthcare worker dashboard.
4.  Build the doctor dashboard.
5.  Create patient and consultation forms.
6.  Create vitals and attachment input interfaces.
7.  Display consultation and upload statuses.
8.  Display doctor responses and patient consultation history.
9.  Integrate the UI with backend APIs.
10. Use mock JSON responses until backend endpoints are ready.
11. Add login and role-selection screens during the final authentication
    phase.

### Expected deliverables

-   Working React frontend.
-   Three distinct dashboard views.
-   Consultation creation and review screens.
-   Clear pending, uploading, delivered, and failed status indicators.
-   API integration.
-   Login UI added in the final phase.

### Suggested frontend structure

``` text
src/
  components/
    Navbar/
    StatusBadge/
    PatientForm/
    VitalsForm/
    AttachmentUpload/
  pages/
    PatientDashboard.jsx
    HealthWorkerDashboard.jsx
    DoctorDashboard.jsx
    Login.jsx
  services/
    api.js
  App.jsx
```

The exact structure can be adjusted to the team's conventions.

## Individual 2 --- Backend Developer

**Ownership:** Server, database, APIs, consultation lifecycle, and
server-side upload handling.

### Responsibilities

1.  Set up Node.js and Express.
2.  Set up PostgreSQL and database migrations.
3.  Design patient, consultation, attachment, and response tables.
4.  Implement patient APIs.
5.  Implement consultation creation, retrieval, and update APIs.
6.  Implement the doctor's incoming consultation queue.
7.  Implement doctor review and response APIs.
8.  Implement upload initialisation, chunk receipt, status, and
    completion endpoints.
9.  Verify received chunks and final-file checksums.
10. Store consultation and delivery statuses.
11. Handle duplicate requests safely using idempotency keys.
12. Return clear errors and upload acknowledgements.
13. Add authentication, password hashing, and role-based access in the
    final phase.

### Expected deliverables

-   Running Express backend.
-   PostgreSQL schema and migrations.
-   Working patient and consultation APIs.
-   Doctor review and response APIs.
-   Chunk-upload and status APIs.
-   Server-side file reassembly and integrity checks.
-   Authentication and access control added last.

### Suggested backend structure

``` text
server/
  src/
    routes/
      patients.js
      consultations.js
      uploads.js
      responses.js
      auth.js
    controllers/
    services/
    middleware/
    models/
    config/
    app.js
  migrations/
```

The exact structure can be adjusted to the team's conventions.

## Individual 3 --- Communication Mechanism Developer

**Ownership:** Offline-first client communication, network monitoring,
prioritisation, retries, and resumable transfer.

This developer owns the **client-side communication logic**. Individual
2 owns the corresponding server endpoints and server-side upload
processing.

### Responsibilities

1.  Implement IndexedDB storage for consultations and pending
    attachments.
2.  Create a local pending-transmission queue.
3.  Save data before attempting network transmission.
4.  Monitor network availability and actual server reachability.
5.  Measure request latency, approximate upload throughput, and
    failures.
6.  Classify the connection as good, degraded, or disconnected.
7.  Separate consultation data into independently transferable
    components.
8.  Implement a clinical-priority transmission queue.
9.  Send essential clinical information before large attachments.
10. Split large attachments into chunks.
11. Track acknowledged chunks.
12. Resume interrupted uploads by sending only missing chunks.
13. Retry failed requests with sensible backoff.
14. Use idempotency keys to avoid duplicate consultation creation.
15. Verify completion status and handle server acknowledgements.
16. Synchronise doctor responses back to the clinic.
17. Test the mechanism under simulated weak-network conditions.

### Expected deliverables

-   IndexedDB local storage.
-   Pending sync queue.
-   Network monitoring and connection classification.
-   Priority-based transmission.
-   Chunked upload client.
-   Interrupted-upload recovery.
-   Duplicate-safe synchronisation.
-   Demonstration of consultation delivery under simulated poor
    connectivity.

### Suggested communication structure

``` text
src/
  communication/
    localDB.js
    networkMonitor.js
    syncQueue.js
    priorityScheduler.js
    uploadManager.js
    retryManager.js
    responseSync.js
```

The exact structure can be adjusted to the team's conventions.

------------------------------------------------------------------------

## 5. Proposed API Contract

The following endpoints are a starting contract. The team should agree
on request bodies, response bodies, status codes, and ownership before
coding. Avoid implementing two endpoints that perform the same operation
under different names.

### Patient APIs

  Method   Endpoint              Purpose
  -------- --------------------- ----------------------
  POST     `/api/patients`       Create a patient
  GET      `/api/patients`       List/search patients
  GET      `/api/patients/:id`   Get patient details

### Consultation APIs

  Method   Endpoint                          Purpose
  -------- --------------------------------- ---------------------------
  POST     `/api/consultations`              Create a consultation
  GET      `/api/consultations/:id`          Get consultation details
  PATCH    `/api/consultations/:id`          Update consultation data
  GET      `/api/doctor/consultations`       Get incoming doctor queue
  PATCH    `/api/consultations/:id/review`   Update review status

### Attachment upload APIs

  ----------------------------------------------------------------------------------------
  Method                  Endpoint                                 Purpose
  ----------------------- ---------------------------------------- -----------------------
  POST                    `/api/uploads/init`                      Create an upload
                                                                   session

  PUT                     `/api/uploads/:uploadId/chunks/:index`   Upload one chunk

  GET                     `/api/uploads/:uploadId/status`          Get received/missing
                                                                   chunks

  POST                    `/api/uploads/:uploadId/complete`        Verify and complete
                                                                   upload
  ----------------------------------------------------------------------------------------

### Doctor response and sync APIs

  --------------------------------------------------------------------------------------
  Method                  Endpoint                               Purpose
  ----------------------- -------------------------------------- -----------------------
  POST                    `/api/consultations/:id/responses`     Submit doctor's
                                                                 response

  GET                     `/api/consultations/:id/responses`     Retrieve consultation
                                                                 responses

  GET                     `/api/sync/responses`                  Retrieve pending
                                                                 responses for the
                                                                 clinic

  PATCH                   `/api/responses/:id/acknowledge`       Acknowledge receipt of
                                                                 a response

  GET                     `/api/consultations/:id/sync-status`   Get consultation
                                                                 delivery status
  --------------------------------------------------------------------------------------

### Authentication APIs --- final phase

  Method   Endpoint               Purpose
  -------- ---------------------- ----------------------------------
  POST     `/api/auth/register`   Register an account, if required
  POST     `/api/auth/login`      Log in
  GET      `/api/auth/me`         Get current user and role
  POST     `/api/auth/logout`     Log out

### Upload protocol agreement

Before implementation, Individual 2 and Individual 3 must agree on:

-   Upload ID and consultation ID formats.
-   Chunk size and chunk numbering convention.
-   Whether chunk indexes start at zero or one.
-   Chunk checksum format.
-   Final-file checksum format.
-   How the server acknowledges a chunk.
-   How the client requests missing chunks.
-   What happens when the same chunk is uploaded twice.
-   Upload expiry and cleanup rules.
-   Maximum attachment size and allowed file types.
-   Exact JSON response format for upload status and completion.

------------------------------------------------------------------------

## 6. Shared Consultation Data Model

Agree on one common data structure so the frontend, backend, and
communication code use the same field names.

Example initial payload:

``` json
{
  "consultationId": "generated-unique-id",
  "idempotencyKey": "stable-retry-key",
  "patientId": "patient-id",
  "createdAt": "ISO-8601-timestamp",
  "clinicalSummary": {
    "symptoms": "Patient-reported symptoms",
    "duration": "Duration of symptoms",
    "medicalHistory": "Relevant history",
    "medications": "Current medications",
    "allergies": "Known allergies",
    "healthWorkerObservations": "Observations"
  },
  "vitals": {
    "temperature": null,
    "heartRate": null,
    "bloodPressure": null,
    "spo2": null,
    "respiratoryRate": null,
    "bloodGlucose": null
  },
  "priority": "normal",
  "attachments": [],
  "syncStatus": "pending"
}
```

This is an illustrative contract, not a final clinical standard. Use
`null` or an explicit unavailable status for measurements that were not
taken. Include units and measurement timestamps in the final vitals
model.

------------------------------------------------------------------------

## 7. Development Sequence

The team should first make the smallest complete consultation workflow
function, then add advanced communication features.

### Milestone 1 --- Agree on contracts (first 1--2 hours)

-   Confirm the three dashboards and their responsibilities.
-   Agree on the consultation JSON structure.
-   Agree on API routes and response formats.
-   Agree on upload protocol and status names.
-   Set up the shared repository and development environment.

### Milestone 2 --- Basic end-to-end workflow

-   Healthcare worker enters a patient consultation.
-   Frontend saves the consultation locally.
-   Backend receives and stores it.
-   Doctor dashboard displays the consultation.
-   Doctor submits advice.
-   Clinic retrieves the advice.
-   Patient dashboard displays the advice.

This is the first critical working milestone. Do not wait until every
advanced feature is complete.

### Milestone 3 --- Offline-first communication

-   Add IndexedDB persistence.
-   Add pending queue and reconnect synchronisation.
-   Prevent duplicate consultation creation.
-   Show transmission status in the healthcare worker dashboard.

### Milestone 4 --- Reliable attachment transfer

-   Add chunked uploads.
-   Add server acknowledgements.
-   Add missing-chunk status.
-   Add resume after interruption.
-   Add checksum verification.

### Milestone 5 --- Network adaptation and testing

-   Add network monitoring.
-   Add priority-based transfer.
-   Test under multiple simulated network profiles.
-   Fix integration and user-interface issues.

### Milestone 6 --- Authentication and user management (last)

-   Add login and account creation if required.
-   Add roles for patient, healthcare worker, and doctor.
-   Add protected routes and API middleware.
-   Enforce access permissions and patient-data ownership.
-   Test the full workflow with separate role accounts.

**Important:** Although authentication is implemented last, include user
IDs, role fields, ownership fields, and appropriate database
relationships in the initial schema. Use synthetic test data and
development-only identities before authentication is ready. Do not use
real patient information or expose a prototype without proper access
controls.

------------------------------------------------------------------------

## 8. Suggested 24-Hour Schedule

  -----------------------------------------------------------------------
  Time              Individual 1 ---  Individual 2 ---  Individual 3 ---
                    Frontend          Backend           Communication
  ----------------- ----------------- ----------------- -----------------
  0--2 hrs          Dashboard plan    DB schema and API Communication
                    and UI skeleton   contract          design and upload
                                                        contract

  2--6 hrs          Build three       Patient and       IndexedDB and
                    dashboard         consultation APIs local queue
                    skeletons                           

  6--10 hrs         Forms and         Doctor queue and  Network monitor
                    consultation      response APIs     and basic sync
                    screens                             

  10--14 hrs        Doctor review and Upload and sync   Priority
                    patient advice UI endpoints         scheduler and
                                                        chunked upload

  14--18 hrs        Connect frontend  Chunk             Resume, retries,
                    to APIs           verification and  integrity
                                      status APIs       handling

  18--21 hrs        Integration and   Integration and   Weak-network
                    UI fixes          database fixes    testing and fixes

  21--23 hrs        Login and role    Authentication    Authenticated
                    screens           and authorisation sync integration

  23--24 hrs        Final end-to-end  Final end-to-end  Final
                    test              test              communication
                                                        demonstration
  -----------------------------------------------------------------------

The schedule is a guide. If time becomes limited, protect the basic
end-to-end workflow and interrupted-upload demonstration before optional
features.

------------------------------------------------------------------------

## 9. Testing the 2G-Like Environment

Use Linux `tc netem` to simulate constrained and unstable network
conditions. These are **experimental test profiles**, not exact
specifications for every 2G network.

  Profile       Bandwidth   Latency   Packet loss
  ----------- ----------- --------- -------------
  Good             1 Mbps     50 ms            0%
  Weak           100 kbps    300 ms            1%
  Very weak       30 kbps    500 ms            5%
  Unstable        50 kbps    800 ms           10%

Compare the normal upload workflow with the CareWave prioritised and
resumable workflow using the same test data and network profile.

### Metrics to record

-   Time until essential clinical information reaches the doctor.
-   Total consultation delivery time.
-   Total data transferred.
-   Number of failed and retried chunks.
-   Amount of retransmitted data.
-   Number of duplicate consultations or attachments.
-   Recovery time after a connection interruption.
-   End-to-end delivery success rate.

Do not claim performance improvements until the team has measured them.

------------------------------------------------------------------------

## 10. Features to Prioritise

### Must-have for the 24-hour prototype

-   Three separate dashboards.
-   Healthcare worker creates a consultation.
-   Structured symptoms and vitals form.
-   Local persistence using IndexedDB.
-   Consultation upload and server storage.
-   Doctor receives and reviews the consultation.
-   Doctor submits advice.
-   Clinic retrieves the response.
-   Upload and sync status indicators.
-   Chunked upload and resume demonstration.
-   Basic weak-network testing.

### Should-have if time permits

-   Network quality classification.
-   Priority scheduler for clinical information.
-   Checksums and stronger integrity validation.
-   Patient consultation history.
-   Notifications or polling improvements.
-   More detailed transfer metrics.

### Optional / future scope

-   WebRTC video consultation when bandwidth permits.
-   Advanced adaptive compression.
-   Additional language support.
-   Integration with medical devices.
-   Production-grade audit, consent, retention, and security controls.

Do not spend time building video calling before the core
store-and-forward workflow works.

------------------------------------------------------------------------

## 11. Technical Stack

  Layer                        Proposed technology
  ---------------------------- ----------------------
  Frontend                     React
  Offline storage              IndexedDB
  Backend                      Node.js + Express
  Database                     PostgreSQL
  Data communication           REST APIs over HTTPS
  File transfer                Chunked HTTP upload
  Network testing              Linux `tc netem`
  Optional live consultation   WebRTC

For the first prototype, JSON is sufficient for structured consultation
data. Consider Protocol Buffers only if measurements show that payload
size is a meaningful bottleneck. Do not compress clinical data in a way
that changes its meaning or reduces the fidelity of ECG and other
medical measurements.

------------------------------------------------------------------------

## 12. Team Coordination Rules

1.  Maintain one shared Git repository.
2.  Agree on API contracts before parallel implementation.
3.  Use a shared `.env.example`; never commit secrets.
4.  Use synthetic patient data for development and demonstrations.
5.  Agree on common status values, for example: `pending`, `uploading`,
    `partial`, `delivered`, and `failed`.
6.  Individual 1 owns frontend API integration.
7.  Individual 2 owns server-side API behaviour and database
    consistency.
8.  Individual 3 owns client-side offline queue, prioritisation,
    retries, and resume logic.
9.  Test the smallest end-to-end workflow early.
10. Merge and test continuously instead of waiting until the final
    hours.

### Suggested Git branches

``` text
main
frontend
backend
communication
```

Merge tested work into `main` regularly.

------------------------------------------------------------------------

## 13. Final Demonstration Flow

A clear demonstration for judges:

1.  Open the healthcare worker dashboard.
2.  Select or create a synthetic patient.
3.  Enter symptoms and available vitals.
4.  Attach a sample report or ECG file.
5.  Save the consultation.
6.  Show the consultation being queued for transmission.
7.  Simulate a weak or interrupted network.
8.  Show essential clinical information arriving first.
9.  Interrupt the attachment upload.
10. Restore connectivity and show the upload resuming without restarting
    from zero.
11. Open the doctor dashboard and review the consultation.
12. Submit doctor's advice.
13. Synchronise the response back to the clinic.
14. Open the patient dashboard and show the advice.

The demonstration should make the key idea visible: **the consultation
is saved locally, essential information is prioritised, and interrupted
transfers can resume.**

------------------------------------------------------------------------

## 14. Important Scope and Safety Notes

-   CareWave supports communication and consultation workflows; it does
    not diagnose patients.
-   Clinical priority must be assigned by an authorised healthcare
    worker according to an agreed protocol, not invented by an
    algorithm.
-   A normal cellular voice call is a separate fallback and is not part
    of the app's internet data-transfer mechanism.
-   A feature phone cannot run the React PWA or independently collect
    digital vitals. The PWA is intended for a smartphone, tablet, or
    computer used at the clinic.
-   Compression is not encryption. Use HTTPS/TLS and appropriate access
    controls before handling real patient data.
-   A hackathon prototype is not ready for real clinical deployment
    without security, privacy, clinical, and operational validation.
-   Never delay emergency referral while waiting for connectivity or
    data synchronisation.

------------------------------------------------------------------------

## 15. Definition of Done

The prototype is ready for the final demonstration when:

-   [ ] Healthcare worker can create a consultation.
-   [ ] Consultation is saved locally before upload.
-   [ ] Consultation reaches the backend without creating duplicates on
    retry.
-   [ ] Doctor can view the consultation.
-   [ ] Doctor can submit advice.
-   [ ] Clinic can retrieve the doctor's response.
-   [ ] Patient dashboard can display consultation status and advice.
-   [ ] A larger attachment can be uploaded in chunks.
-   [ ] An interrupted upload resumes by sending missing chunks.
-   [ ] Transfer status is visible to the healthcare worker.
-   [ ] The workflow has been tested under at least one weak-network
    profile.
-   [ ] Authentication and role-based access are added in the final
    phase.

**Primary success criterion:** Demonstrate a complete consultation round
trip --- clinic to doctor and doctor back to clinic --- with local
saving and reliable recovery from an interrupted transfer.
