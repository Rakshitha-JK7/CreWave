# CareWave -- Rural Telemedicine Information Collection

## Purpose

This document defines the information a rural healthcare worker collects
during a patient consultation and transfers to the remote doctor through
CareWave.

CareWave is designed to work when internet connectivity is weak or
intermittent. The information is therefore divided into: 1. **Essential
clinical summary** -- small, important information sent first. 2.
**Supporting clinical data** -- recordings and observations sent
according to clinical need. 3. **Additional documents** -- relevant
reports and prescriptions sent when available.

> **Important:** CareWave supports communication between the healthcare
> worker and doctor. It does not diagnose patients or independently
> decide clinical urgency. The healthcare worker must follow the
> clinic's clinical protocols and emergency-referral procedures.

------------------------------------------------------------------------

## 1. Patient Identification

  -----------------------------------------------------------------------
  Field                   What to collect         Required?
  ----------------------- ----------------------- -----------------------
  Patient reference ID    Unique ID for this      Yes
                          consultation or patient 
                          record                  

  Patient name            Name, if required by    As required
                          the clinic's workflow   

  Age or date of birth    Patient's age or DOB    Yes

  Sex                     Record when clinically  As relevant
                          relevant or required    

  Village / location      Patient's village or    Yes
                          clinic catchment area   

  Contact number          Phone number for        Optional
                          follow-up, if needed    

  Consent                 Confirmation that the   Yes
                          patient has agreed to   
                          the teleconsultation    
                          and relevant data       
                          sharing                 
  -----------------------------------------------------------------------

**Privacy note:** Use a patient reference ID in routine transfer
wherever possible. Collect only identifying details that are necessary,
protect them appropriately, and do not expose sensitive information in
SMS notifications.

## 2. Symptoms and Presenting Complaint

  -----------------------------------------------------------------------
  Field                   What to collect         Required?
  ----------------------- ----------------------- -----------------------
  Main complaint          Primary reason for the  Yes
                          visit, in the patient's 
                          own words where         
                          possible                

  Symptoms                Other symptoms being    Yes
                          experienced             

  Onset                   When the symptoms began Yes

  Duration                How long the symptoms   Yes
                          have been present       

  Severity / progression  Whether symptoms are    If known
                          mild, moderate or       
                          severe, and whether     
                          they are worsening      

  Relevant history        Existing medical        If relevant
                          conditions and relevant 
                          previous episodes       

  Current medication      Medicines the patient   If relevant
                          is currently taking     

  Allergies               Known medicine or other If known
                          relevant allergies      
  -----------------------------------------------------------------------

The healthcare worker should record the patient's account accurately and
avoid adding an unverified diagnosis.

## 3. Vital Signs and Measurements

Record the measurement, unit, date/time and (where useful) the device or
method used.

  -----------------------------------------------------------------------
  Measurement             Unit / format           Collection guidance
  ----------------------- ----------------------- -----------------------
  Body temperature        °C                      Record if measured

  Heart rate / pulse      beats per minute (bpm)  Record if measured

  Blood pressure          mmHg                    Record if measured
                          (systolic/diastolic)    

  Oxygen saturation       \%                      Record if measured with
  (SpO₂)                                          a pulse oximeter

  Respiratory rate        breaths per minute      Count and record if
                                                  measured

  Blood glucose           mg/dL or mmol/L         Record only when
                                                  measured and relevant

  Weight                  kg                      Optional; collect when
                                                  relevant
  -----------------------------------------------------------------------

Do not enter estimated values as measured values. If a measurement is
unavailable, mark it as **not measured** rather than entering zero or
guessing.

**Device note:** A mobile phone or basic Nokia feature phone cannot
independently measure blood pressure, SpO₂, ECG or blood glucose. These
require suitable medical devices or equipment and, where applicable,
trained assistance.

## 4. Clinical Recordings and Attachments

Attach only information relevant to the patient's case and collected
with appropriate consent.

  -----------------------------------------------------------------------
  Data type               Example                 Required?
  ----------------------- ----------------------- -----------------------
  ECG                     ECG trace or recording  Only when clinically
                          from a compatible ECG   indicated and available
                          device                  

  Clinical image          Photograph of a visible Only when relevant and
                          symptom, wound or       consented
                          affected area           

  Lab report              Relevant blood, urine   If available and
                          or other test report    relevant

  Previous prescription   Existing prescription   If relevant
                          related to the current  
                          complaint               

  Other medical document  Discharge summary or    If relevant
                          previous investigation  
  -----------------------------------------------------------------------

For every attachment, CareWave should record: - Consultation ID -
Attachment ID and type - Capture date/time - File size - Upload status -
Integrity/checksum status

Large attachments can be uploaded separately and resumed after a network
interruption. The doctor dashboard must clearly show whether an
attachment is still pending.

## 5. Voice Note (Optional)

A short audio recording may be useful when the patient is more
comfortable speaking in a local language.

Possible content: - Patient describing the main symptoms - Clarification
of symptom duration or progression - Healthcare worker's relevant
observations

Voice recording should be optional and consent-based. It should not
replace the structured symptom and vital-sign fields. If the network is
very weak, the structured summary should be sent first and the audio can
be queued.

## 6. Healthcare Worker and Consultation Details

  -----------------------------------------------------------------------
  Field                   What to collect         Required?
  ----------------------- ----------------------- -----------------------
  Consultation ID         Unique ID for this      Yes
                          consultation            

  Healthcare worker ID    ID of the worker        Yes
                          recording the case      

  Clinic ID / location    Facility from which the Yes
                          case is submitted       

  Consultation date/time  When the information    Yes
                          was collected           

  Measurements            Vital signs or tests    If applicable
  unavailable             that could not be       
                          obtained                

  Healthcare worker notes Relevant observations,  If applicable
                          clearly separated from  
                          patient-reported        
                          symptoms                

  Urgency category        Category assigned by    As required by protocol
                          the healthcare worker   
                          under an approved       
                          clinical protocol       

  Immediate action        Any first aid, referral If applicable
                          or other action already 
                          taken                   
  -----------------------------------------------------------------------

CareWave should not automatically assign a medical urgency category.
Urgent or emergency symptoms must be handled according to the clinic's
referral protocol; the patient must not be made to wait for an internet
connection or an online doctor's reply.

## 7. Information Sent Back by the Doctor

The consultation is not complete merely because the upload reaches the
server. The doctor's response should also be recorded and delivered back
to the clinic.

The response may include: - Doctor's name or clinician ID - Date/time of
review - Assessment or comments - Recommended next steps - Advice for
follow-up - Whether an in-person examination or referral is required -
Prescription or supporting document, if issued through an authorized
workflow

The doctor remains responsible for clinical decisions. Any prescription
or treatment instruction must follow applicable professional and legal
requirements.

------------------------------------------------------------------------

## 8. Recommended Transmission Priority

CareWave should send information in a way that gives the doctor useful
clinical context early, while keeping the status of incomplete
information visible.

  -----------------------------------------------------------------------
  Transmission group      Information             Suggested handling
  ----------------------- ----------------------- -----------------------
  **1 -- Essential        Consultation ID,        Send first; keep the
  summary**               patient reference, main payload small
                          complaint, symptom      
                          duration, relevant      
                          history, available      
                          vital signs, worker     
                          notes and declared      
                          urgency category        

  **2 -- Clinically       ECG, relevant clinical  Prioritize according to
  important supporting    images, or other        the case and clinical
  data**                  recordings              protocol; send in
                                                  resumable chunks

  **3 -- Additional       Previous reports,       Queue and transfer when
  supporting documents**  prescriptions and other bandwidth is available,
                          relevant files          unless clinically
                                                  urgent
  -----------------------------------------------------------------------

Priority must be based on clinical relevance and the clinic's
protocol---not simply on file size or media type. The doctor must be
able to see which items have arrived and which are still pending.

## 9. Minimum Data Set for the 24-Hour Prototype

For a working hackathon demonstration, start with these fields:

### Required for the demo

-   Consultation ID
-   Patient reference ID
-   Age
-   Village / clinic location
-   Main complaint
-   Symptom duration
-   Relevant medical history
-   Current medication and known allergies, if any
-   Temperature, if measured
-   Heart rate, if measured
-   Blood pressure, if measured
-   SpO₂, if measured
-   Healthcare worker ID
-   Consultation date/time
-   Healthcare worker notes
-   Consent status

### Optional demo attachments

-   A sample ECG file
-   A short voice note
-   A sample medical report or prescription

Use **synthetic patient information and sample files** for the hackathon
demonstration. Do not use real patient records unless the project has
the necessary authorization, consent, privacy and security safeguards.

## 10. Example Consultation Record (Synthetic)

  -----------------------------------------------------------------------
  Field                               Example value
  ----------------------------------- -----------------------------------
  Consultation ID                     CW-DEMO-001

  Patient reference ID                PAT-DEMO-1024

  Age                                 45 years

  Village                             Sample Village

  Main complaint                      Fever and cough

  Symptom duration                    Fever for 3 days; cough for 2 days

  Additional symptom                  Patient reports difficulty
                                      breathing since morning

  Temperature                         38.2 °C (sample value)

  Heart rate                          96 bpm (sample value)

  Blood pressure                      120/80 mmHg (sample value)

  SpO₂                                94% (sample value, if measured)

  Medical history                     Example: no relevant history
                                      reported

  Current medication                  Example: not reported

  Allergies                           Example: not reported

  Healthcare worker ID                HW-DEMO-01

  Notes                               Synthetic example for software
                                      testing only
  -----------------------------------------------------------------------

> This is fictional test data, not a clinical assessment or treatment
> recommendation. In a real case, the healthcare worker must follow the
> appropriate clinical and emergency-referral protocol.

------------------------------------------------------------------------

## 11. Data Handling Requirements for CareWave

For each consultation and each transmitted component, the application
should maintain:

-   A unique consultation ID and component ID
-   Component type and declared priority
-   Creation and last-updated timestamps
-   File size and checksum
-   Local storage status
-   Server receipt status
-   Doctor availability / review status
-   Upload progress and retry count
-   A clear pending, failed or completed state

Suggested end-to-end statuses:

`Created → Saved locally → Upload pending → Received by server → Available to doctor → Reviewed by doctor → Response submitted → Response received by clinic`

A successful file upload does **not** mean that the doctor has reviewed
the case. Keep delivery, availability and review as separate states.

## 12. Privacy and Safety Checklist

-   Obtain and record appropriate patient consent.
-   Collect only information needed for the consultation.
-   Use synthetic data in demonstrations.
-   Protect data in transit with HTTPS/TLS and protect stored data with
    appropriate access controls and encryption.
-   Restrict access to authorized healthcare workers and clinicians.
-   Keep an audit trail of access and changes.
-   Avoid sending sensitive medical details through ordinary SMS.
-   Clearly identify missing, unmeasured and pending information.
-   Do not present CareWave as an autonomous diagnostic system.
-   Do not delay emergency referral while waiting for network
    connectivity or a remote response.
