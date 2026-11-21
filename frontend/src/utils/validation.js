/**
 * Validation utilities for CareWave forms.
 * Each function returns either null (valid) or an error message string.
 * Composite validators return { valid: boolean, errors: Record<string, string> }.
 */

/* ============================================================
   PRIMITIVE VALIDATORS
   ============================================================ */

/**
 * Validates that a value is not empty.
 * @param {*} value
 * @param {string} fieldName - Human-readable field name for the error message.
 * @returns {string|null}
 */
export function validateRequired(value, fieldName = 'This field') {
  if (value === null || value === undefined) return `${fieldName} is required`
  if (typeof value === 'string' && value.trim() === '') return `${fieldName} is required`
  if (Array.isArray(value) && value.length === 0) return `${fieldName} is required`
  return null
}

/**
 * Validates an Indian or international phone number.
 * Accepts formats: +91-XXXXXXXXXX, 91XXXXXXXXXX, XXXXXXXXXX (10 digits)
 * @param {string} phone
 * @returns {string|null}
 */
export function validatePhone(phone) {
  if (!phone) return 'Phone number is required'
  const cleaned = phone.replace(/[\s\-().]/g, '')
  // Allow +91 prefix or bare 10-digit number
  if (!/^(\+?91)?[6-9]\d{9}$/.test(cleaned)) {
    return 'Enter a valid 10-digit mobile number'
  }
  return null
}

/**
 * Validates patient age (1–120).
 * @param {number|string} age
 * @returns {string|null}
 */
export function validateAge(age) {
  if (age === '' || age === null || age === undefined) return 'Age is required'
  const n = Number(age)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return 'Age must be a whole number'
  if (n < 1)   return 'Age must be at least 1'
  if (n > 120) return 'Age must be 120 or less'
  return null
}

/**
 * Validates blood pressure readings.
 * @param {number|string} systolic  - mmHg
 * @param {number|string} diastolic - mmHg
 * @returns {string|null}
 */
export function validateBloodPressure(systolic, diastolic) {
  const s = Number(systolic)
  const d = Number(diastolic)
  if (!Number.isFinite(s)) return 'Systolic value is invalid'
  if (!Number.isFinite(d)) return 'Diastolic value is invalid'
  if (s < 60 || s > 250)  return 'Systolic must be between 60 and 250 mmHg'
  if (d < 30 || d > 150)  return 'Diastolic must be between 30 and 150 mmHg'
  if (d >= s)             return 'Diastolic must be less than systolic'
  return null
}

/**
 * Validates heart rate (beats per minute).
 * @param {number|string} value
 * @returns {string|null}
 */
export function validateHeartRate(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 'Heart rate is invalid'
  if (n < 20 || n > 300)  return 'Heart rate must be between 20 and 300 bpm'
  return null
}

/**
 * Validates body temperature in Celsius.
 * @param {number|string} value
 * @returns {string|null}
 */
export function validateTemperature(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 'Temperature is invalid'
  if (n < 30 || n > 45)   return 'Temperature must be between 30°C and 45°C'
  return null
}

/**
 * Validates blood oxygen saturation (SpO2).
 * @param {number|string} value - percentage
 * @returns {string|null}
 */
export function validateSpO2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 'SpO2 value is invalid'
  if (n < 50 || n > 100)  return 'SpO2 must be between 50% and 100%'
  return null
}

/* ============================================================
   COMPOSITE VALIDATORS
   ============================================================ */

/**
 * Validates all fields of a patient registration form.
 * @param {object} data
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validatePatientForm(data) {
  const errors = {}

  const reqName    = validateRequired(data.name, 'Name')
  if (reqName) errors.name = reqName

  const reqVillage = validateRequired(data.village, 'Village')
  if (reqVillage) errors.village = reqVillage

  const reqAge = validateAge(data.age)
  if (reqAge) errors.age = reqAge

  const reqSex = validateRequired(data.sex, 'Sex')
  if (reqSex) errors.sex = reqSex

  if (data.phone) {
    const phoneErr = validatePhone(data.phone)
    if (phoneErr) errors.phone = phoneErr
  }

  if (data.guardianPhone) {
    const gpErr = validatePhone(data.guardianPhone)
    if (gpErr) errors.guardianPhone = gpErr
  }

  // Validate vitals if provided (non-empty strings)
  if (data.systolic || data.diastolic) {
    const bpErr = validateBloodPressure(data.systolic, data.diastolic)
    if (bpErr) errors.bloodPressure = bpErr
  }
  if (data.heartRate && data.heartRate !== '') {
    const hrErr = validateHeartRate(data.heartRate)
    if (hrErr) errors.heartRate = hrErr
  }
  if (data.temperature && data.temperature !== '') {
    const tempErr = validateTemperature(data.temperature)
    if (tempErr) errors.temperature = tempErr
  }
  if (data.spO2 && data.spO2 !== '') {
    const spo2Err = validateSpO2(data.spO2)
    if (spo2Err) errors.spO2 = spo2Err
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

/**
 * Validates a consultation submission form.
 * @param {object} data
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validateConsultationForm(data) {
  const errors = {}

  const reqPatient = validateRequired(data.patientId, 'Patient')
  if (reqPatient) errors.patientId = reqPatient

  const reqChief = validateRequired(data.chiefComplaint, 'Chief complaint')
  if (reqChief) errors.chiefComplaint = reqChief

  if (data.chiefComplaint && data.chiefComplaint.trim().length < 10) {
    errors.chiefComplaint = 'Chief complaint must be at least 10 characters'
  }

  const reqUrgency = validateRequired(data.urgency, 'Urgency level')
  if (reqUrgency) errors.urgency = reqUrgency

  // Vitals — only validate if supplied
  if (data.systolicBP && data.diastolicBP) {
    const bpErr = validateBloodPressure(data.systolicBP, data.diastolicBP)
    if (bpErr) errors.bloodPressure = bpErr
  }
  if (data.heartRate && data.heartRate !== '') {
    const hrErr = validateHeartRate(data.heartRate)
    if (hrErr) errors.heartRate = hrErr
  }
  if (data.temperature && data.temperature !== '') {
    const tempErr = validateTemperature(data.temperature)
    if (tempErr) errors.temperature = tempErr
  }
  if (data.spO2 && data.spO2 !== '') {
    const spo2Err = validateSpO2(data.spO2)
    if (spo2Err) errors.spO2 = spo2Err
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

/**
 * Validates a doctor's response form.
 * @param {object} data
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validateResponseForm(data) {
  const errors = {}

  const reqDiagnosis = validateRequired(data.diagnosis, 'Diagnosis')
  if (reqDiagnosis) errors.diagnosis = reqDiagnosis

  if (data.diagnosis && data.diagnosis.trim().length < 5) {
    errors.diagnosis = 'Diagnosis must be at least 5 characters'
  }

  const reqPlan = validateRequired(data.treatmentPlan, 'Treatment plan')
  if (reqPlan) errors.treatmentPlan = reqPlan

  if (data.treatmentPlan && data.treatmentPlan.trim().length < 10) {
    errors.treatmentPlan = 'Treatment plan must be at least 10 characters'
  }

  if (data.followUpDate) {
    const followUp = new Date(data.followUpDate)
    const today    = new Date()
    today.setHours(0, 0, 0, 0)
    if (isNaN(followUp.getTime())) {
      errors.followUpDate = 'Follow-up date is invalid'
    } else if (followUp < today) {
      errors.followUpDate = 'Follow-up date must be today or in the future'
    }
  }

  // Validate each prescription if present
  if (data.prescriptions && Array.isArray(data.prescriptions)) {
    data.prescriptions.forEach((rx, i) => {
      if (!rx.medicineName || !rx.medicineName.trim()) {
        errors[`prescription_${i}_name`] = `Prescription ${i + 1}: medicine name is required`
      }
      if (!rx.dosage || !rx.dosage.trim()) {
        errors[`prescription_${i}_dosage`] = `Prescription ${i + 1}: dosage is required`
      }
      if (!rx.duration || !rx.duration.trim()) {
        errors[`prescription_${i}_duration`] = `Prescription ${i + 1}: duration is required`
      }
    })
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

export const validateConsultation = validateConsultationForm;
export const validateResponse = validateResponseForm;
export const validatePatient = validatePatientForm;

