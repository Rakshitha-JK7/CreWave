import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  User, FileText, Activity, Paperclip, ClipboardList, ChevronDown,
  CheckCircle, AlertTriangle, AlertCircle, XCircle, Info, X,
  Upload, Image as ImageIcon, File, Clock, Tag, Plus, Eye,
  Save, Send, ArrowLeft, Zap, Thermometer, Heart, Wind, Droplets,
  CheckSquare, Square, Bell, Loader2, Stethoscope
} from 'lucide-react'
import DashboardLayout from '../../layouts/DashboardLayout'
import { useApp } from '../../context/AppContext'
import patientService from '../../services/patientService'
import consultationService from '../../services/consultationService'
import { validateConsultation } from '../../utils/validation'
import { enqueueConsultation } from '../../offline/offlineQueue'
import { saveConsultation, saveDraft, getDraftConsultations, deleteDraft } from '../../offline/indexedDB'

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'section-a', label: 'A', title: 'Patient', icon: User },
  { id: 'section-b', label: 'B', title: 'Symptoms', icon: FileText },
  { id: 'section-c', label: 'C', title: 'History', icon: ClipboardList },
  { id: 'section-d', label: 'D', title: 'Vitals', icon: Activity },
  { id: 'section-e', label: 'E', title: 'Attachments', icon: Paperclip },
  { id: 'section-f', label: 'F', title: 'Notes', icon: ClipboardList },
]

const URGENCY_OPTIONS = [
  {
    value: 'low',
    label: 'Low',
    description: 'Routine, non-urgent case',
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#86efac',
    activeBg: '#dcfce7',
  },
  {
    value: 'normal',
    label: 'Normal',
    description: 'Standard consultation',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#93c5fd',
    activeBg: '#dbeafe',
  },
  {
    value: 'high',
    label: 'High',
    description: 'Requires prompt attention',
    color: '#ea580c',
    bg: '#fff7ed',
    border: '#fdba74',
    activeBg: '#ffedd5',
  },
  {
    value: 'urgent',
    label: 'Urgent',
    description: 'Immediate response needed',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fca5a5',
    activeBg: '#fee2e2',
  },
  {
    value: 'critical',
    label: 'Critical',
    description: 'Emergency — contact doctor immediately',
    color: '#7f1d1d',
    bg: '#fff1f2',
    border: '#fda4af',
    activeBg: '#ffe4e6',
  },
]

const MAX_FILES = 10
const MAX_FILE_SIZE_MB = 20
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024

const SEVERITY_OPTIONS = [
  { value: 'mild', label: 'Mild', color: '#16a34a' },
  { value: 'moderate', label: 'Moderate', color: '#ca8a04' },
  { value: 'severe', label: 'Severe', color: '#ea580c' },
  { value: 'very_severe', label: 'Very Severe', color: '#dc2626' },
]

// ─── Utility Functions ────────────────────────────────────────────────────────

function generateId() {
  return 'CW' + Date.now()
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

function getPatientAge(dob) {
  if (!dob) return 'N/A'
  const birth = new Date(dob)
  const now = new Date()
  const age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) return age - 1
  return age
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TagInput({ tags, onChange, placeholder, color = '#2563eb' }) {
  const [input, setInput] = useState('')

  const addTag = () => {
    const val = input.trim()
    if (val && !tags.includes(val)) {
      onChange([...tags, val])
    }
    setInput('')
  }

  const removeTag = (tag) => onChange(tags.filter(t => t !== tag))

  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && !input && tags.length) {
      removeTag(tags[tags.length - 1])
    }
  }

  return (
    <div style={styles.tagInputWrapper}>
      <div style={styles.tagInputInner}>
        {tags.map(tag => (
          <span key={tag} style={{ ...styles.tag, background: color + '20', borderColor: color + '50', color }}>
            {tag}
            <button type="button" onClick={() => removeTag(tag)} style={styles.tagRemove}>
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={addTag}
          placeholder={tags.length === 0 ? placeholder : ''}
          style={styles.tagInput}
        />
      </div>
      <span style={styles.tagHint}>Press Enter or comma to add</span>
    </div>
  )
}

function SectionHeader({ id, icon: Icon, label, title, completed }) {
  return (
    <div id={id} style={styles.sectionHeader}>
      <div style={styles.sectionHeaderLeft}>
        <div style={styles.sectionPillLarge}>
          {completed ? <CheckCircle size={18} color="#16a34a" /> : <span style={styles.sectionLabelText}>{label}</span>}
        </div>
        <div>
          <div style={styles.sectionTitle}>{title}</div>
        </div>
      </div>
      <Icon size={20} color="#94a3b8" />
    </div>
  )
}

function FormField({ label, required, error, children, hint }) {
  return (
    <div style={styles.fieldGroup}>
      <label style={styles.fieldLabel}>
        {label}
        {required && <span style={styles.required}> *</span>}
      </label>
      {children}
      {hint && <span style={styles.fieldHint}>{hint}</span>}
      {error && (
        <div style={styles.fieldError}>
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

function VitalInput({ label, unit, value, onChange, unavailable, onToggleUnavailable, children, optional }) {
  return (
    <div style={{ ...styles.vitalCard, opacity: unavailable ? 0.7 : 1 }}>
      <div style={styles.vitalCardHeader}>
        <span style={styles.vitalLabel}>
          {label}
          {optional && <span style={styles.optionalBadge}>Optional</span>}
        </span>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={unavailable}
            onChange={() => onToggleUnavailable()}
            style={{ marginRight: 4 }}
          />
          <span style={{ fontSize: 11, color: '#64748b' }}>Not Measured</span>
        </label>
      </div>
      {unavailable ? (
        <div style={styles.notMeasuredBadge}>Not Measured</div>
      ) : (
        children || (
          <div style={styles.vitalInputRow}>
            <input
              type="number"
              value={value}
              onChange={e => onChange(e.target.value)}
              style={styles.vitalInput}
              disabled={unavailable}
              min="0"
            />
            <span style={styles.vitalUnit}>{unit}</span>
          </div>
        )
      )}
    </div>
  )
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({ formData, selectedPatient, onClose, onSubmit, isSubmitting }) {
  const urgency = URGENCY_OPTIONS.find(u => u.value === formData.urgency) || URGENCY_OPTIONS[1]

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Consultation Preview</h2>
          <button onClick={onClose} style={styles.modalClose}><X size={20} /></button>
        </div>
        <div style={styles.modalBody}>

          {/* Patient */}
          <div style={styles.previewSection}>
            <h3 style={styles.previewSectionTitle}>Patient</h3>
            {selectedPatient ? (
              <div style={styles.previewRow}>
                <span style={styles.previewLabel}>Name</span>
                <span style={styles.previewValue}>{selectedPatient.name || selectedPatient.firstName + ' ' + selectedPatient.lastName}</span>
              </div>
            ) : (
              <span style={styles.previewEmpty}>No patient selected</span>
            )}
            {selectedPatient && (
              <>
                <div style={styles.previewRow}>
                  <span style={styles.previewLabel}>ID</span>
                  <span style={styles.previewValue}>{selectedPatient.id || selectedPatient.patientId}</span>
                </div>
                <div style={styles.previewRow}>
                  <span style={styles.previewLabel}>Age / Sex</span>
                  <span style={styles.previewValue}>{getPatientAge(selectedPatient.dateOfBirth)} yrs / {selectedPatient.gender || selectedPatient.sex}</span>
                </div>
              </>
            )}
          </div>

          {/* Symptoms */}
          <div style={styles.previewSection}>
            <h3 style={styles.previewSectionTitle}>Symptoms</h3>
            <div style={styles.previewRow}>
              <span style={styles.previewLabel}>Chief Complaint</span>
              <span style={styles.previewValue}>{formData.symptoms.chiefComplaint || '—'}</span>
            </div>
            <div style={styles.previewRow}>
              <span style={styles.previewLabel}>Duration</span>
              <span style={styles.previewValue}>{formData.symptoms.duration || '—'}</span>
            </div>
            <div style={styles.previewRow}>
              <span style={styles.previewLabel}>Onset</span>
              <span style={styles.previewValue}>{formData.symptoms.onset}</span>
            </div>
            <div style={styles.previewRow}>
              <span style={styles.previewLabel}>Severity</span>
              <span style={styles.previewValue}>{SEVERITY_OPTIONS.find(s => s.value === formData.symptoms.severity)?.label}</span>
            </div>
            {formData.symptoms.description && (
              <div style={styles.previewRow}>
                <span style={styles.previewLabel}>Description</span>
                <span style={styles.previewValue}>{formData.symptoms.description}</span>
              </div>
            )}
          </div>

          {/* Medical History */}
          <div style={styles.previewSection}>
            <h3 style={styles.previewSectionTitle}>Medical History</h3>
            <div style={styles.previewRow}>
              <span style={styles.previewLabel}>Conditions</span>
              <span style={styles.previewValue}>{formData.medicalHistory.existingConditions.join(', ') || '—'}</span>
            </div>
            <div style={styles.previewRow}>
              <span style={styles.previewLabel}>Medications</span>
              <span style={styles.previewValue}>{formData.medicalHistory.currentMedications.join(', ') || '—'}</span>
            </div>
            <div style={styles.previewRow}>
              <span style={styles.previewLabel}>Allergies</span>
              <span style={styles.previewValue}>{formData.medicalHistory.knownAllergies.join(', ') || '—'}</span>
            </div>
          </div>

          {/* Vitals */}
          <div style={styles.previewSection}>
            <h3 style={styles.previewSectionTitle}>Vitals</h3>
            {[
              { label: 'Blood Pressure', val: formData.vitals.bloodPressure.unavailable ? 'Not Measured' : `${formData.vitals.bloodPressure.systolic}/${formData.vitals.bloodPressure.diastolic} mmHg` },
              { label: 'Heart Rate', val: formData.vitals.heartRate.unavailable ? 'Not Measured' : `${formData.vitals.heartRate.value} bpm` },
              { label: 'Temperature', val: formData.vitals.temperature.unavailable ? 'Not Measured' : `${formData.vitals.temperature.value} °C` },
              { label: 'SpO2', val: formData.vitals.spo2.unavailable ? 'Not Measured' : `${formData.vitals.spo2.value} %` },
              { label: 'Respiratory Rate', val: formData.vitals.respiratoryRate.unavailable ? 'Not Measured' : `${formData.vitals.respiratoryRate.value} breaths/min` },
              { label: 'Blood Glucose', val: formData.vitals.bloodGlucose.unavailable ? 'Not Measured' : `${formData.vitals.bloodGlucose.value} mg/dL (${formData.vitals.bloodGlucose.fasting ? 'Fasting' : 'Random'})` },
            ].map(v => (
              <div key={v.label} style={styles.previewRow}>
                <span style={styles.previewLabel}>{v.label}</span>
                <span style={{ ...styles.previewValue, color: v.val === 'Not Measured' ? '#94a3b8' : '#1e293b' }}>{v.val || '—'}</span>
              </div>
            ))}
          </div>

          {/* Attachments */}
          <div style={styles.previewSection}>
            <h3 style={styles.previewSectionTitle}>Attachments</h3>
            {formData.attachments.length === 0 ? (
              <span style={styles.previewEmpty}>None</span>
            ) : (
              formData.attachments.map(a => (
                <div key={a.localId} style={styles.previewAttachment}>
                  <File size={14} />
                  <span>{a.name}</span>
                  <span style={{ color: '#94a3b8', fontSize: 11 }}>{formatFileSize(a.size)}</span>
                </div>
              ))
            )}
          </div>

          {/* Notes & Urgency */}
          <div style={styles.previewSection}>
            <h3 style={styles.previewSectionTitle}>Notes & Urgency</h3>
            {formData.healthWorkerNotes && (
              <div style={styles.previewRow}>
                <span style={styles.previewLabel}>HW Notes</span>
                <span style={styles.previewValue}>{formData.healthWorkerNotes}</span>
              </div>
            )}
            {formData.clinicalNotes && (
              <div style={styles.previewRow}>
                <span style={styles.previewLabel}>Clinical Notes</span>
                <span style={styles.previewValue}>{formData.clinicalNotes}</span>
              </div>
            )}
            <div style={styles.previewRow}>
              <span style={styles.previewLabel}>Urgency</span>
              <span style={{ ...styles.previewValue, color: urgency.color, fontWeight: 600 }}>
                {urgency.label}
              </span>
            </div>
            <div style={styles.previewRow}>
              <span style={styles.previewLabel}>Specialization</span>
              <span style={styles.previewValue}>{formData.specialization || 'General Medicine'}</span>
            </div>
            {formData.doctorName && (
              <div style={styles.previewRow}>
                <span style={styles.previewLabel}>Assigned Doctor</span>
                <span style={{ ...styles.previewValue, color: '#0284c7', fontWeight: 600 }}>{formData.doctorName}</span>
              </div>
            )}
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button onClick={onClose} style={styles.btnOutline}>Edit</button>
          <button onClick={onSubmit} disabled={isSubmitting} style={styles.btnPrimary}>
            {isSubmitting ? <><Loader2 size={14} style={styles.spin} /> Submitting…</> : <><Send size={14} /> Submit Consultation</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NewConsultation() {
  const navigate = useNavigate()
  const location = useLocation()
  const { addNotification } = useApp?.() || {}

  const consultationIdRef = useRef(null)
  const fileInputRef = useRef(null)
  const dragCounter = useRef(0)

  const [formData, setFormData] = useState({
    patientId: '',
    specialization: 'General Medicine',
    doctorId: '',
    doctorName: '',
    symptoms: {
      chiefComplaint: '',
      description: '',
      duration: '',
      onset: 'gradual',
      severity: 'moderate',
      additionalObservations: '',
    },
    medicalHistory: {
      existingConditions: [],
      currentMedications: [],
      knownAllergies: [],
      previousHistory: '',
    },
    vitals: {
      bloodPressure: { systolic: '', diastolic: '', unavailable: false },
      heartRate: { value: '', unavailable: false },
      temperature: { value: '', unavailable: false },
      spo2: { value: '', unavailable: false },
      respiratoryRate: { value: '', unavailable: false },
      bloodGlucose: { value: '', fasting: true, unavailable: false },
    },
    attachments: [],
    healthWorkerNotes: '',
    clinicalNotes: '',
    urgency: 'normal',
  })

  const [selectedPatient, setSelectedPatient] = useState(null)
  const [availableDoctors, setAvailableDoctors] = useState([])
  const [errors, setErrors] = useState({})
  const [isDraftSaved, setIsDraftSaved] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState(null)
  const [currentSection, setCurrentSection] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const [toast, setToast] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [attachmentError, setAttachmentError] = useState('')
  const [draftBanner, setDraftBanner] = useState(null) // { id, data }
  const [patients, setPatients] = useState([])

  useEffect(() => {
    async function loadDoctors() {
      try {
        const docs = await consultationService.getDoctors()
        setAvailableDoctors(docs || [])
      } catch (e) {
        console.warn('Could not load doctors:', e)
      }
    }
    loadDoctors()
  }, [])

  const selectPatient = useCallback((patient) => {
    setSelectedPatient(patient)
    const pId = patient.referenceId || patient.reference_id || patient.id || patient.patientId;
    setFormData(prev => ({
      ...prev,
      patientId: pId,
      patientName: patient.name || `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
      medicalHistory: {
        ...prev.medicalHistory,
        existingConditions: patient.medicalHistory?.conditions || patient.conditions || [],
        knownAllergies: patient.medicalHistory?.allergies || patient.allergies || [],
        currentMedications: patient.medicalHistory?.medications || patient.medications || [],
      },
    }))
  }, [])

  // On mount: fetch real patients, check for draft, and auto-select patient from route state
  useEffect(() => {
    let mounted = true
    async function loadPatientsList() {
      try {
        const pts = await patientService.getPatients()
        if (mounted && Array.isArray(pts)) setPatients(pts)
      } catch (err) {
        console.warn('Failed to load patients for new consultation:', err)
      }
    }
    loadPatientsList()

    // Check for draft in IndexedDB or localStorage
    const checkDraft = async () => {
      try {
        const preselectedDraftId = location.state?.draftId;
        const drafts = await getDraftConsultations();
        let localDrafts = [];
        try {
          localDrafts = JSON.parse(localStorage.getItem('carewave_drafts') || '[]');
        } catch { localDrafts = []; }
        const allDrafts = [...(drafts || []), ...localDrafts];

        if (preselectedDraftId) {
          const specificDraft = allDrafts.find((d) => d.id === preselectedDraftId);
          if (specificDraft && mounted) {
            setDraftBanner(specificDraft);
            return;
          }
        }

        if (allDrafts.length > 0 && mounted) {
          setDraftBanner(allDrafts[0]);
        }
      } catch {
        // IndexedDB not available or no drafts
      }
    }
    checkDraft()

    // Auto-select patient from navigation state
    const preselectedId = location.state?.patientId
    if (preselectedId) {
      const patient = patients.find(p => p.id === preselectedId || p.patientId === preselectedId)
      if (patient) {
        selectPatient(patient)
      }
    }

    return () => { mounted = false }
  }, [location.state, patients, selectPatient])

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const updateSymptom = (field, value) => {
    setFormData(prev => ({ ...prev, symptoms: { ...prev.symptoms, [field]: value } }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const updateHistory = (field, value) => {
    setFormData(prev => ({ ...prev, medicalHistory: { ...prev.medicalHistory, [field]: value } }))
  }

  const updateVital = (vitalKey, field, value) => {
    setFormData(prev => ({
      ...prev,
      vitals: {
        ...prev.vitals,
        [vitalKey]: { ...prev.vitals[vitalKey], [field]: value },
      },
    }))
  }

  const toggleVitalUnavailable = (vitalKey) => {
    setFormData(prev => ({
      ...prev,
      vitals: {
        ...prev.vitals,
        [vitalKey]: { ...prev.vitals[vitalKey], unavailable: !prev.vitals[vitalKey].unavailable },
      },
    }))
  }

  // ── File handling ──────────────────────────────────────────────────────────

  const processFiles = (fileList) => {
    setAttachmentError('')
    const files = Array.from(fileList)
    const remaining = MAX_FILES - formData.attachments.length

    if (remaining <= 0) {
      setAttachmentError(`Maximum ${MAX_FILES} attachments allowed.`)
      return
    }

    const toAdd = []
    for (const file of files.slice(0, remaining)) {
      if (file.size > MAX_FILE_SIZE) {
        setAttachmentError(`"${file.name}" exceeds ${MAX_FILE_SIZE_MB}MB limit and was skipped.`)
        continue
      }
      toAdd.push({
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        localId: 'att_' + Date.now() + '_' + Math.random().toString(36).slice(2),
        status: 'pending',
      })
    }

    if (toAdd.length) {
      setFormData(prev => ({ ...prev, attachments: [...prev.attachments, ...toAdd] }))
    }
  }

  const removeAttachment = (localId) => {
    setFormData(prev => ({ ...prev, attachments: prev.attachments.filter(a => a.localId !== localId) }))
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
    dragCounter.current++
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    processFiles(e.dataTransfer.files)
  }

  // ── Section completion detection ──────────────────────────────────────────

  const getSectionCompletion = () => {
    const f = formData
    return [
      !!f.patientId,  // A
      !!(f.symptoms.chiefComplaint && f.symptoms.duration), // B
      true, // C - optional
      true, // D - optional
      true, // E - optional
      true, // F - optional
    ]
  }

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = () => {
    const newErrors = {}
    if (!formData.patientId) {
      newErrors.patientId = 'Please select a patient from Section A.'
    }
    const chiefComplaint = (formData.symptoms?.chiefComplaint || '').trim()
    if (!chiefComplaint) {
      newErrors.chiefComplaint = 'Chief complaint is required in Section B.'
    } else if (chiefComplaint.length < 3) {
      newErrors.chiefComplaint = 'Chief complaint must be at least 3 characters.'
    }

    setErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      const errorList = Object.values(newErrors)
      showToast(`Cannot submit: ${errorList.join(' • ')}`, 'error')

      // Scroll to first error section
      if (newErrors.patientId) scrollToSection('section-a')
      else if (newErrors.chiefComplaint) scrollToSection('section-b')
      return false
    }
    return true
  }

  // ── Draft save ─────────────────────────────────────────────────────────────

  const handleSaveDraft = async () => {
    if (!consultationIdRef.current) {
      consultationIdRef.current = generateId()
    }
    const consultationId = consultationIdRef.current
    try {
      const draftRecord = {
        id: consultationId,
        consultationId,
        idempotencyKey: `IDEMP-${consultationId}`,
        ...formData,
        isDraft: true,
        status: 'draft',
        savedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        patientName: selectedPatient
          ? (selectedPatient.name || `${selectedPatient.firstName} ${selectedPatient.lastName}`)
          : (formData.patientName || 'Patient Draft'),
        mainComplaint: formData.symptoms?.chiefComplaint || 'Draft Consultation',
      }
      await saveConsultation(draftRecord);
      await saveDraft(draftRecord);
      try {
        const draftsList = JSON.parse(localStorage.getItem('carewave_drafts') || '[]');
        const existingIdx = draftsList.findIndex((d) => d.id === draftRecord.id);
        if (existingIdx !== -1) draftsList[existingIdx] = draftRecord;
        else draftsList.unshift(draftRecord);
        localStorage.setItem('carewave_drafts', JSON.stringify(draftsList));
      } catch (e) {
        console.warn('Could not cache draft in localStorage:', e);
      }
      setIsDraftSaved(true)
      showToast('Draft consultation saved locally and added to history', 'success')
    } catch {
      showToast('Could not save draft', 'error')
    }
  }

  // ── Draft recovery ─────────────────────────────────────────────────────────

  const handleContinueDraft = () => {
    if (!draftBanner) return
    const draft = draftBanner
    consultationIdRef.current = draft.id
    setFormData({
      patientId: draft.patientId || '',
      specialization: draft.specialization || 'General Medicine',
      doctorId: draft.doctorId || '',
      doctorName: draft.doctorName || '',
      symptoms: draft.symptoms || formData.symptoms,
      medicalHistory: draft.medicalHistory || formData.medicalHistory,
      vitals: draft.vitals || formData.vitals,
      attachments: [], // Can't restore File objects from IDB
      healthWorkerNotes: draft.healthWorkerNotes || '',
      clinicalNotes: draft.clinicalNotes || '',
      urgency: draft.urgency || 'normal',
    })
    if (draft.patientId) {
      const patient = patients.find(p => p.id === draft.patientId || p.patientId === draft.patientId)
      if (patient) selectPatient(patient)
    }
    setDraftBanner(null)
    showToast('Draft restored', 'info')
  }

  const handleDiscardDraft = async () => {
    if (draftBanner) {
      try { await deleteDraft(draftBanner.id) } catch { /* ignore */ }
    }
    setDraftBanner(null)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validate()) {
      return
    }

    if (!consultationIdRef.current) {
      consultationIdRef.current = generateId()
    }
    const consultationId = consultationIdRef.current

    setIsSubmitting(true)
    setSubmitStatus('saving')

    try {
      const selectedDoc = availableDoctors.find(d => d.id === formData.doctorId)
      const docName = selectedDoc ? selectedDoc.name : (formData.doctorName || null)

      const consultationRecord = {
        id: consultationId,
        consultationId,
        idempotencyKey: `IDEMP-${consultationId}`,
        patientId: formData.patientId,
        patientName: selectedPatient
          ? (selectedPatient.name || `${selectedPatient.firstName} ${selectedPatient.lastName}`)
          : '',
        priority: formData.urgency === 'urgent' ? 'urgent' : (formData.urgency === 'high' ? 'urgent' : 'normal'),
        urgency: formData.urgency || 'normal',
        specialization: formData.specialization || 'General Medicine',
        doctorId: formData.doctorId || null,
        doctorName: docName,
        mainComplaint: formData.symptoms?.chiefComplaint || 'Clinical Consultation',
        symptoms: formData.symptoms?.chiefComplaint || '',
        symptomOnset: formData.symptoms?.onset || '',
        symptomDuration: formData.symptoms?.duration || '',
        clinicalSummary: {
          mainComplaint: formData.symptoms?.chiefComplaint,
          symptoms: formData.symptoms?.chiefComplaint,
          onset: formData.symptoms?.onset,
          duration: formData.symptoms?.duration,
          medicalHistory: Array.isArray(formData.medicalHistory?.existingConditions)
            ? formData.medicalHistory.existingConditions.join(', ')
            : '',
          allergies: Array.isArray(formData.medicalHistory?.knownAllergies)
            ? formData.medicalHistory.knownAllergies.join(', ')
            : '',
          medications: Array.isArray(formData.medicalHistory?.currentMedications)
            ? formData.medicalHistory.currentMedications.join(', ')
            : '',
          healthWorkerObservations: formData.clinicalNotes || formData.healthWorkerNotes,
        },
        vitals: formData.vitals,
        isDraft: false,
        status: 'available_to_doctor',
        createdAt: new Date().toISOString(),
        attachments: (formData.attachments || []).map(({ file, ...rest }) => rest),
      }

      // Always save to IndexedDB and post to /api/consultations
      await consultationService.createConsultation(consultationRecord)

      // Queue file attachments for upload if any
      if (formData.attachments && formData.attachments.length > 0) {
        await enqueueConsultation(consultationId, { attachments: formData.attachments })
      }

      // Discard any existing draft record from storage
      try {
        await deleteDraft(consultationId);
        const draftsList = JSON.parse(localStorage.getItem('carewave_drafts') || '[]');
        localStorage.setItem('carewave_drafts', JSON.stringify(draftsList.filter((d) => d.id !== consultationId)));
      } catch (e) { /* ignore */ }

      setSubmitStatus('queued')

      if (addNotification) {
        addNotification({
          id: 'notif_' + Date.now(),
          type: 'consultation_queued',
          title: 'Consultation Submitted',
          message: `Consultation for ${consultationRecord.patientName || 'patient'} submitted to ${consultationRecord.specialization} queue.`,
          time: new Date().toISOString(),
          read: false,
        })
      }

      showToast(
        'Consultation submitted successfully and transmitted to doctor queue!',
        'success'
      )

      setShowPreview(false)
      setTimeout(() => navigate('/health-worker/consultations'), 1200)
    } catch (err) {
      console.error('Submission error:', err)
      setSubmitStatus('failed')
      setIsSubmitting(false)
      showToast(err.message || 'Failed to submit consultation. Saved locally for retry.', 'error')
    }
  }

  // ── Cancel ─────────────────────────────────────────────────────────────────

  const handleCancel = () => {
    const hasData = formData.patientId ||
      formData.symptoms.chiefComplaint ||
      formData.symptoms.duration ||
      formData.attachments.length > 0 ||
      formData.healthWorkerNotes

    if (hasData) {
      if (window.confirm('You have unsaved data. Are you sure you want to cancel?')) {
        navigate(-1)
      }
    } else {
      navigate(-1)
    }
  }

  const sectionCompletion = getSectionCompletion()

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout role="healthWorker">
      <div style={styles.page}>

        {/* Toast */}
        {toast && (
          <div style={{ ...styles.toast, background: toast.type === 'error' ? '#fee2e2' : toast.type === 'info' ? '#eff6ff' : '#f0fdf4', borderColor: toast.type === 'error' ? '#fca5a5' : toast.type === 'info' ? '#93c5fd' : '#86efac', color: toast.type === 'error' ? '#dc2626' : toast.type === 'info' ? '#2563eb' : '#16a34a' }}>
            {toast.type === 'error' ? <XCircle size={16} /> : toast.type === 'info' ? <Info size={16} /> : <CheckCircle size={16} />}
            <span>{toast.msg}</span>
          </div>
        )}

        {/* Draft Recovery Banner */}
        {draftBanner && (
          <div style={styles.draftBanner}>
            <div style={styles.draftBannerLeft}>
              <Save size={16} color="#ca8a04" />
              <span style={styles.draftBannerText}>You have an unsaved draft from {formatDate(draftBanner.savedAt)}.</span>
            </div>
            <div style={styles.draftBannerActions}>
              <button onClick={handleContinueDraft} style={styles.draftBtnContinue}>Continue Draft</button>
              <button onClick={handleDiscardDraft} style={styles.draftBtnDiscard}>Start New</button>
            </div>
          </div>
        )}

        {/* Page Header */}
        <div style={styles.pageHeader}>
          <div>
            <h1 style={styles.pageTitle}>New Consultation</h1>
            <p style={styles.pageSubtitle}>Complete all required sections and submit for doctor review</p>
          </div>
          {isDraftSaved && (
            <div style={styles.draftSavedBadge}>
              <Save size={12} /> Draft Saved
            </div>
          )}
        </div>

        {/* Section Progress Indicator */}
        <div style={styles.progressBar}>
          {SECTIONS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { setCurrentSection(i); scrollToSection(s.id) }}
              style={{
                ...styles.sectionPill,
                background: currentSection === i ? '#2563eb' : sectionCompletion[i] ? '#f0fdf4' : '#f8fafc',
                borderColor: currentSection === i ? '#2563eb' : sectionCompletion[i] ? '#86efac' : '#e2e8f0',
                color: currentSection === i ? '#fff' : sectionCompletion[i] ? '#16a34a' : '#64748b',
              }}
            >
              {sectionCompletion[i] && currentSection !== i
                ? <CheckCircle size={12} />
                : <span style={styles.pillLabel}>{s.label}</span>
              }
              <span style={styles.pillTitle}>{s.title}</span>
            </button>
          ))}
        </div>

        {/* Submit Status Banner */}
        {submitStatus === 'queued' && (
          <div style={styles.queuedBanner}>
            <CheckCircle size={16} color="#16a34a" />
            <span>Consultation saved locally and queued for upload. It will be sent to the doctor when connection is available.</span>
          </div>
        )}
        {submitStatus === 'saving' && (
          <div style={styles.savingBanner}>
            <Loader2 size={16} style={styles.spin} />
            <span>Saving consultation…</span>
          </div>
        )}

        {/* Validation Errors Summary Banner */}
        {Object.keys(errors).filter(k => errors[k]).length > 0 && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderLeft: '5px solid #dc2626',
              borderRadius: 8,
              padding: '12px 18px',
              marginBottom: 20,
              color: '#991b1b',
              fontSize: '0.875rem',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={18} color="#dc2626" />
              Please complete all required consultation fields before submitting:
            </div>
            <ul style={{ margin: 0, paddingLeft: 24, lineHeight: 1.5 }}>
              {Object.entries(errors).filter(([, errText]) => errText).map(([k, errText]) => (
                <li key={k}>{errText}</li>
              ))}
            </ul>
          </div>
        )}

        <div style={styles.formContainer}>

          {/* ═══ SECTION A: Patient Selection ═══════════════════════════════ */}
          <div style={styles.section}>
            <SectionHeader id="section-a" icon={User} label="A" title="Patient Selection" completed={sectionCompletion[0]} />
            <div style={styles.sectionBody}>
              <FormField label="Select Patient" required error={errors.patientId}>
                <div style={styles.selectWrapper}>
                  <select
                    value={formData.patientId}
                    onChange={e => {
                      const val = e.target.value
                      const patient = patients.find(p => (p.referenceId || p.reference_id || p.id || p.patientId) === val)
                      if (patient) selectPatient(patient)
                      else { setSelectedPatient(null); setFormData(prev => ({ ...prev, patientId: '' })) }
                      if (errors.patientId) setErrors(prev => ({ ...prev, patientId: '' }))
                    }}
                    style={{ ...styles.select, borderColor: errors.patientId ? '#dc2626' : '#e2e8f0' }}
                  >
                    <option value="">— Select a registered patient —</option>
                    {patients.map(p => {
                      const pid = p.referenceId || p.reference_id || p.id || p.patientId;
                      const bg = p.bloodGroup || p.blood_group || '';
                      return (
                        <option key={pid} value={pid}>
                          {p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim()} — {pid} {bg ? `[${bg}]` : ''}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown size={16} style={styles.selectIcon} />
                </div>
              </FormField>

              {selectedPatient && (
                <div style={styles.patientInfoBox}>
                  <div style={styles.patientInfoHeader}>
                    <div style={styles.patientAvatar}>
                      {(selectedPatient.name || selectedPatient.firstName || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={styles.patientName}>{selectedPatient.name || `${selectedPatient.firstName} ${selectedPatient.lastName}`}</div>
                      <div style={styles.patientMeta}>
                        <span>ID: {selectedPatient.id || selectedPatient.patientId}</span>
                        <span>·</span>
                        <span>Age: {getPatientAge(selectedPatient.dateOfBirth)}</span>
                        <span>·</span>
                        <span>Sex: {selectedPatient.gender || selectedPatient.sex || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div style={styles.patientTagRow}>
                    {(selectedPatient.medicalHistory?.conditions || selectedPatient.conditions || []).map(c => (
                      <span key={c} style={styles.conditionTag}>{c}</span>
                    ))}
                    {(selectedPatient.medicalHistory?.allergies || selectedPatient.allergies || []).map(a => (
                      <span key={a} style={styles.allergyTag}>{a}</span>
                    ))}
                  </div>

                  <div style={styles.lastConsult}>
                    <Clock size={12} color="#94a3b8" />
                    <span>Last consultation: {formatDate(selectedPatient.lastConsultation || selectedPatient.lastVisit)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══ SECTION B: Symptoms ════════════════════════════════════════ */}
          <div style={styles.section}>
            <SectionHeader id="section-b" icon={FileText} label="B" title="Symptoms" completed={sectionCompletion[1]} />
            <div style={styles.sectionBody}>
              <div style={styles.twoCol}>
                <FormField label="Chief Complaint" required error={errors.chiefComplaint}>
                  <input
                    type="text"
                    value={formData.symptoms.chiefComplaint}
                    onChange={e => updateSymptom('chiefComplaint', e.target.value)}
                    placeholder="e.g. Fever and headache for 2 days"
                    style={{ ...styles.input, borderColor: errors.chiefComplaint ? '#dc2626' : '#e2e8f0' }}
                  />
                </FormField>
                <FormField label="Duration" required error={errors.duration} hint='e.g. "3 days", "2 weeks"'>
                  <input
                    type="text"
                    value={formData.symptoms.duration}
                    onChange={e => updateSymptom('duration', e.target.value)}
                    placeholder='e.g. "3 days", "2 weeks"'
                    style={{ ...styles.input, borderColor: errors.duration ? '#dc2626' : '#e2e8f0' }}
                  />
                </FormField>
              </div>

              <FormField label="Symptom Description">
                <textarea
                  rows={3}
                  value={formData.symptoms.description}
                  onChange={e => updateSymptom('description', e.target.value)}
                  placeholder="Describe the symptoms in detail…"
                  style={styles.textarea}
                />
              </FormField>

              <div style={styles.twoCol}>
                <FormField label="Onset">
                  <div style={styles.selectWrapper}>
                    <select value={formData.symptoms.onset} onChange={e => updateSymptom('onset', e.target.value)} style={styles.select}>
                      <option value="gradual">Gradual</option>
                      <option value="sudden">Sudden</option>
                      <option value="unknown">Unknown</option>
                    </select>
                    <ChevronDown size={16} style={styles.selectIcon} />
                  </div>
                </FormField>

                <FormField label="Severity">
                  <div style={styles.severityRow}>
                    {SEVERITY_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateSymptom('severity', opt.value)}
                        style={{
                          ...styles.severityBtn,
                          background: formData.symptoms.severity === opt.value ? opt.color : '#f8fafc',
                          color: formData.symptoms.severity === opt.value ? '#fff' : '#64748b',
                          borderColor: formData.symptoms.severity === opt.value ? opt.color : '#e2e8f0',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </FormField>
              </div>

              <FormField label="Additional Observations">
                <textarea
                  rows={3}
                  value={formData.symptoms.additionalObservations}
                  onChange={e => updateSymptom('additionalObservations', e.target.value)}
                  placeholder="Any other relevant observations…"
                  style={styles.textarea}
                />
              </FormField>
            </div>
          </div>

          {/* ═══ SECTION C: Medical History ══════════════════════════════════ */}
          <div style={styles.section}>
            <SectionHeader id="section-c" icon={ClipboardList} label="C" title="Medical History" completed={sectionCompletion[2]} />
            <div style={styles.sectionBody}>
              <FormField label="Existing Conditions" hint="Conditions will be pre-filled from patient's profile">
                <TagInput
                  tags={formData.medicalHistory.existingConditions}
                  onChange={v => updateHistory('existingConditions', v)}
                  placeholder="Type a condition and press Enter…"
                  color="#2563eb"
                />
              </FormField>

              <FormField label="Current Medications">
                <TagInput
                  tags={formData.medicalHistory.currentMedications}
                  onChange={v => updateHistory('currentMedications', v)}
                  placeholder="Type a medication and press Enter…"
                  color="#7c3aed"
                />
              </FormField>

              <FormField label="Known Allergies" hint="Allergies pre-filled from patient profile">
                <TagInput
                  tags={formData.medicalHistory.knownAllergies}
                  onChange={v => updateHistory('knownAllergies', v)}
                  placeholder="Type an allergy and press Enter…"
                  color="#dc2626"
                />
              </FormField>

              <FormField label="Previous Medical History">
                <textarea
                  rows={3}
                  value={formData.medicalHistory.previousHistory}
                  onChange={e => updateHistory('previousHistory', e.target.value)}
                  placeholder="Any relevant past medical or surgical history…"
                  style={styles.textarea}
                />
              </FormField>
            </div>
          </div>

          {/* ═══ SECTION D: Vitals ══════════════════════════════════════════ */}
          <div style={styles.section}>
            <SectionHeader id="section-d" icon={Activity} label="D" title="Vitals" completed={sectionCompletion[3]} />
            <div style={styles.sectionBody}>
              <div style={styles.vitalsGrid}>

                {/* Blood Pressure */}
                <VitalInput
                  label="Blood Pressure"
                  unit="mmHg"
                  unavailable={formData.vitals.bloodPressure.unavailable}
                  onToggleUnavailable={() => toggleVitalUnavailable('bloodPressure')}
                >
                  {!formData.vitals.bloodPressure.unavailable && (
                    <div style={styles.vitalInputRow}>
                      <input
                        type="number"
                        value={formData.vitals.bloodPressure.systolic}
                        onChange={e => updateVital('bloodPressure', 'systolic', e.target.value)}
                        placeholder="Sys"
                        style={{ ...styles.vitalInput, flex: 1 }}
                        min="0"
                      />
                      <span style={{ color: '#94a3b8', fontWeight: 700 }}>/</span>
                      <input
                        type="number"
                        value={formData.vitals.bloodPressure.diastolic}
                        onChange={e => updateVital('bloodPressure', 'diastolic', e.target.value)}
                        placeholder="Dia"
                        style={{ ...styles.vitalInput, flex: 1 }}
                        min="0"
                      />
                      <span style={styles.vitalUnit}>mmHg</span>
                    </div>
                  )}
                </VitalInput>

                {/* Heart Rate */}
                <VitalInput
                  label="Heart Rate"
                  unit="bpm"
                  value={formData.vitals.heartRate.value}
                  onChange={v => updateVital('heartRate', 'value', v)}
                  unavailable={formData.vitals.heartRate.unavailable}
                  onToggleUnavailable={() => toggleVitalUnavailable('heartRate')}
                />

                {/* Temperature */}
                <VitalInput
                  label="Body Temperature"
                  unit="°C"
                  value={formData.vitals.temperature.value}
                  onChange={v => updateVital('temperature', 'value', v)}
                  unavailable={formData.vitals.temperature.unavailable}
                  onToggleUnavailable={() => toggleVitalUnavailable('temperature')}
                />

                {/* SpO2 */}
                <VitalInput
                  label="SpO2"
                  unit="%"
                  value={formData.vitals.spo2.value}
                  onChange={v => updateVital('spo2', 'value', v)}
                  unavailable={formData.vitals.spo2.unavailable}
                  onToggleUnavailable={() => toggleVitalUnavailable('spo2')}
                />

                {/* Respiratory Rate */}
                <VitalInput
                  label="Respiratory Rate"
                  unit="breaths/min"
                  value={formData.vitals.respiratoryRate.value}
                  onChange={v => updateVital('respiratoryRate', 'value', v)}
                  unavailable={formData.vitals.respiratoryRate.unavailable}
                  onToggleUnavailable={() => toggleVitalUnavailable('respiratoryRate')}
                />

                {/* Blood Glucose */}
                <VitalInput
                  label="Blood Glucose"
                  unit="mg/dL"
                  unavailable={formData.vitals.bloodGlucose.unavailable}
                  onToggleUnavailable={() => toggleVitalUnavailable('bloodGlucose')}
                  optional
                >
                  {!formData.vitals.bloodGlucose.unavailable && (
                    <div>
                      <div style={styles.vitalInputRow}>
                        <input
                          type="number"
                          value={formData.vitals.bloodGlucose.value}
                          onChange={e => updateVital('bloodGlucose', 'value', e.target.value)}
                          placeholder="0"
                          style={styles.vitalInput}
                          min="0"
                        />
                        <span style={styles.vitalUnit}>mg/dL</span>
                      </div>
                      <div style={styles.glucoseToggle}>
                        <button
                          type="button"
                          onClick={() => updateVital('bloodGlucose', 'fasting', true)}
                          style={{ ...styles.toggleBtn, background: formData.vitals.bloodGlucose.fasting ? '#2563eb' : '#f1f5f9', color: formData.vitals.bloodGlucose.fasting ? '#fff' : '#64748b' }}
                        >
                          Fasting
                        </button>
                        <button
                          type="button"
                          onClick={() => updateVital('bloodGlucose', 'fasting', false)}
                          style={{ ...styles.toggleBtn, background: !formData.vitals.bloodGlucose.fasting ? '#2563eb' : '#f1f5f9', color: !formData.vitals.bloodGlucose.fasting ? '#fff' : '#64748b' }}
                        >
                          Random
                        </button>
                      </div>
                    </div>
                  )}
                </VitalInput>

              </div>
            </div>
          </div>

          {/* ═══ SECTION E: Attachments ════════════════════════════════════ */}
          <div style={styles.section}>
            <SectionHeader id="section-e" icon={Paperclip} label="E" title="Attachments" completed={sectionCompletion[4]} />
            <div style={styles.sectionBody}>
              {/* Drop Zone */}
              <div
                style={{
                  ...styles.dropZone,
                  borderColor: isDragging ? '#2563eb' : '#cbd5e1',
                  background: isDragging ? '#eff6ff' : '#f8fafc',
                }}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,image/*,application/pdf,.ecg,.edf"
                  onChange={e => processFiles(e.target.files)}
                  style={{ display: 'none' }}
                />
                <Upload size={28} color={isDragging ? '#2563eb' : '#94a3b8'} />
                <div style={styles.dropZoneText}>
                  <span style={{ fontWeight: 600, color: isDragging ? '#2563eb' : '#1e293b' }}>
                    {isDragging ? 'Drop files here' : 'Click to upload or drag & drop'}
                  </span>
                  <span style={styles.dropZoneHint}>
                    PDF, JPG, PNG, ECG, EDF — Max {MAX_FILE_SIZE_MB}MB per file, {MAX_FILES} files total
                  </span>
                </div>
              </div>

              {attachmentError && (
                <div style={styles.fieldError}>
                  <AlertCircle size={12} /> {attachmentError}
                </div>
              )}

              {/* File List */}
              {formData.attachments.length > 0 && (
                <div style={styles.fileList}>
                  {formData.attachments.map(att => (
                    <div key={att.localId} style={styles.fileItem}>
                      <div style={styles.fileItemIcon}>
                        {att.type.startsWith('image/') ? <ImageIcon size={18} color="#2563eb" /> : <File size={18} color="#64748b" />}
                      </div>
                      <div style={styles.fileItemInfo}>
                        <span style={styles.fileName} title={att.name}>{att.name.length > 40 ? att.name.slice(0, 37) + '…' : att.name}</span>
                        <span style={styles.fileSize}>{formatFileSize(att.size)}</span>
                      </div>
                      <button type="button" onClick={() => removeAttachment(att.localId)} style={styles.fileRemove}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={styles.attachmentCount}>
                {formData.attachments.length}/{MAX_FILES} files attached
              </div>
            </div>
          </div>

          {/* ═══ SECTION F: HW Notes ════════════════════════════════════════ */}
          <div style={styles.section}>
            <SectionHeader id="section-f" icon={ClipboardList} label="F" title="Healthcare Worker Notes" completed={sectionCompletion[5]} />
            <div style={styles.sectionBody}>

              <FormField label="Additional Observations">
                <textarea
                  rows={4}
                  value={formData.healthWorkerNotes}
                  onChange={e => setFormData(prev => ({ ...prev, healthWorkerNotes: e.target.value }))}
                  placeholder="Clinical observations, general appearance, behavior…"
                  style={styles.textarea}
                />
              </FormField>

              <FormField label="Clinical Notes">
                <textarea
                  rows={3}
                  value={formData.clinicalNotes}
                  onChange={e => setFormData(prev => ({ ...prev, clinicalNotes: e.target.value }))}
                  placeholder="Differential diagnosis considerations, protocol notes…"
                  style={styles.textarea}
                />
              </FormField>

              <div style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>Urgency Level</label>
                <div style={styles.urgencyGrid}>
                  {URGENCY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, urgency: opt.value }))}
                      style={{
                        ...styles.urgencyCard,
                        background: formData.urgency === opt.value ? opt.activeBg : opt.bg,
                        borderColor: formData.urgency === opt.value ? opt.color : opt.border,
                        boxShadow: formData.urgency === opt.value ? `0 0 0 2px ${opt.color}40` : 'none',
                      }}
                    >
                      <div style={{ ...styles.urgencyDot, background: opt.color }} />
                      <div style={styles.urgencyInfo}>
                        <span style={{ ...styles.urgencyLabel, color: opt.color }}>{opt.label}</span>
                        <span style={styles.urgencyDesc}>{opt.description}</span>
                      </div>
                      {formData.urgency === opt.value && <CheckCircle size={16} color={opt.color} style={{ flexShrink: 0 }} />}
                    </button>
                  ))}
                </div>

                <div style={styles.urgencyNote}>
                  <Info size={12} color="#94a3b8" />
                  <span>Urgency is set by the healthcare worker based on clinical judgment and protocol. CareWave does not automatically determine urgency.</span>
                </div>

                {/* Doctor & Specialization Routing */}
                <div style={{ marginTop: 24, padding: 18, background: '#f8fafc', borderRadius: 12, border: '1px solid #cbd5e1' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Stethoscope size={18} color="#0284c7" /> Doctor & Medical Specialization Routing
                  </h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                        Clinical Specialization Required
                      </label>
                      <select
                        value={formData.specialization || 'General Medicine'}
                        onChange={(e) => setFormData((prev) => ({ ...prev, specialization: e.target.value }))}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, background: '#fff' }}
                      >
                        <option value="General Medicine">General Medicine</option>
                        <option value="Cardiology">Cardiology</option>
                        <option value="Pediatrics">Pediatrics</option>
                        <option value="Pulmonology">Pulmonology</option>
                        <option value="Dermatology">Dermatology</option>
                        <option value="Orthopedics">Orthopedics</option>
                        <option value="Gynecology & Obstetrics">Gynecology & Obstetrics</option>
                        <option value="Neurology">Neurology</option>
                        <option value="Emergency Care">Emergency Care</option>
                      </select>
                      <span style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'block' }}>
                        Directs case to specialists in this discipline
                      </span>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                        Consulting Tele-Specialist Doctor
                      </label>
                      <select
                        value={formData.doctorId || ''}
                        onChange={(e) => {
                          const docId = e.target.value;
                          const doc = availableDoctors.find((d) => d.id === docId);
                          setFormData((prev) => ({
                            ...prev,
                            doctorId: docId,
                            doctorName: doc ? doc.name : '',
                          }));
                        }}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, background: '#fff' }}
                      >
                        <option value="">⚡ Any Available Tele-Specialist (Fastest Response)</option>
                        {availableDoctors.map((doc) => (
                          <option key={doc.id} value={doc.id}>
                            {doc.name} — {doc.specialization || 'Specialist'}
                          </option>
                        ))}
                      </select>
                      <span style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'block' }}>
                        Optionally assign to a specific verified doctor
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Validation Errors Notice */}
        {Object.keys(errors).length > 0 && (
          <div
            style={{
              maxWidth: 900,
              margin: '0 auto 16px',
              padding: '12px 18px',
              backgroundColor: '#fef2f2',
              border: '1.5px solid #fecaca',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              color: '#991b1b',
              fontSize: '0.875rem',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)',
            }}
          >
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 2, color: '#dc2626' }} />
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: '0.9rem' }}>Please complete the following required fields:</strong>
              <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                {Object.entries(errors).map(([key, msg]) => (
                  <li key={key} style={{ marginTop: 2 }}>{msg}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ── Sticky Bottom Action Bar ────────────────────────────────────── */}
        <div style={styles.actionBar}>
          <div style={styles.actionBarInner}>
            <button type="button" onClick={handleCancel} style={styles.btnGhost}>
              <ArrowLeft size={14} /> Cancel
            </button>

            <div style={styles.actionBarRight}>
              <button type="button" onClick={handleSaveDraft} style={styles.btnSecondary}>
                <Save size={14} /> Save Draft
              </button>
              <button type="button" onClick={() => setShowPreview(true)} style={styles.btnOutline}>
                <Eye size={14} /> Preview
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{ ...styles.btnPrimary, opacity: isSubmitting ? 0.7 : 1 }}
              >
                {isSubmitting
                  ? <><Loader2 size={14} style={styles.spin} /> Submitting…</>
                  : <><Send size={14} /> Submit Consultation</>
                }
              </button>
            </div>
          </div>
        </div>

        {/* Preview Modal */}
        {showPreview && (
          <PreviewModal
            formData={formData}
            selectedPatient={selectedPatient}
            onClose={() => setShowPreview(false)}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </DashboardLayout>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f8fafc',
    paddingBottom: 100,
  },
  // Toast
  toast: {
    position: 'fixed',
    top: 20,
    right: 20,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 18px',
    borderRadius: 10,
    border: '1px solid',
    fontSize: 14,
    fontWeight: 500,
    maxWidth: 500,
    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
    animation: 'slideIn 0.2s ease',
  },
  // Draft banner
  draftBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 24px',
    background: '#fefce8',
    borderBottom: '1px solid #fef08a',
    flexWrap: 'wrap',
  },
  draftBannerLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  draftBannerText: { fontSize: 14, color: '#854d0e' },
  draftBannerActions: { display: 'flex', gap: 8 },
  draftBtnContinue: {
    padding: '6px 14px',
    borderRadius: 6,
    border: '1px solid #ca8a04',
    background: '#ca8a04',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  draftBtnDiscard: {
    padding: '6px 14px',
    borderRadius: 6,
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    fontSize: 13,
    cursor: 'pointer',
  },
  // Page header
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '28px 24px 12px',
    flexWrap: 'wrap',
    gap: 12,
  },
  pageTitle: { fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 },
  pageSubtitle: { fontSize: 14, color: '#64748b', margin: '4px 0 0' },
  draftSavedBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 12px',
    background: '#f0fdf4',
    border: '1px solid #86efac',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    color: '#16a34a',
  },
  // Progress bar
  progressBar: {
    display: 'flex',
    gap: 8,
    padding: '0 24px 20px',
    overflowX: 'auto',
    flexWrap: 'wrap',
  },
  sectionPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    borderRadius: 24,
    border: '1.5px solid',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
    background: 'none',
  },
  pillLabel: { fontSize: 13, fontWeight: 700 },
  pillTitle: { fontSize: 12, fontWeight: 500 },
  // Status banners
  queuedBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 24px',
    background: '#f0fdf4',
    borderBottom: '1px solid #86efac',
    fontSize: 14,
    color: '#166534',
  },
  savingBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 24px',
    background: '#eff6ff',
    borderBottom: '1px solid #93c5fd',
    fontSize: 14,
    color: '#1e40af',
  },
  spin: { animation: 'spin 1s linear infinite' },
  // Form container
  formContainer: { padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 20 },
  // Section
  section: {
    background: '#fff',
    borderRadius: 14,
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 20px',
    borderBottom: '1px solid #f1f5f9',
    background: '#fafafa',
  },
  sectionHeaderLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  sectionPillLarge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: '#eff6ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sectionLabelText: { fontSize: 16, fontWeight: 800, color: '#2563eb' },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#0f172a' },
  sectionBody: { padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 },
  // Form fields
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: 600, color: '#374151' },
  required: { color: '#dc2626' },
  fieldHint: { fontSize: 11, color: '#94a3b8' },
  fieldError: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#dc2626' },
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1.5px solid #e2e8f0',
    fontSize: 14,
    color: '#1e293b',
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
    fontFamily: 'inherit',
  },
  textarea: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1.5px solid #e2e8f0',
    fontSize: 14,
    color: '#1e293b',
    background: '#fff',
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    lineHeight: 1.6,
  },
  selectWrapper: { position: 'relative' },
  select: {
    width: '100%',
    padding: '10px 36px 10px 14px',
    borderRadius: 8,
    border: '1.5px solid #e2e8f0',
    fontSize: 14,
    color: '#1e293b',
    background: '#fff',
    outline: 'none',
    appearance: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  selectIcon: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#94a3b8',
    pointerEvents: 'none',
  },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 },
  severityRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  severityBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: '1.5px solid',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
    background: 'none',
  },
  // Tag input
  tagInputWrapper: { display: 'flex', flexDirection: 'column', gap: 4 },
  tagInputInner: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    padding: '8px 12px',
    border: '1.5px solid #e2e8f0',
    borderRadius: 8,
    minHeight: 44,
    background: '#fff',
    cursor: 'text',
    alignItems: 'center',
  },
  tag: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 10px',
    borderRadius: 20,
    border: '1px solid',
    fontSize: 12,
    fontWeight: 600,
  },
  tagRemove: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    color: 'inherit',
    opacity: 0.7,
  },
  tagInput: {
    border: 'none',
    outline: 'none',
    fontSize: 13,
    color: '#1e293b',
    minWidth: 120,
    flex: 1,
    background: 'transparent',
    fontFamily: 'inherit',
  },
  tagHint: { fontSize: 11, color: '#94a3b8' },
  // Patient info box
  patientInfoBox: {
    padding: 16,
    background: '#eff6ff',
    borderRadius: 10,
    border: '1px solid #bfdbfe',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  patientInfoHeader: { display: 'flex', alignItems: 'center', gap: 12 },
  patientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    background: '#2563eb',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    fontWeight: 700,
    flexShrink: 0,
  },
  patientName: { fontSize: 16, fontWeight: 700, color: '#1e40af' },
  patientMeta: { display: 'flex', gap: 8, fontSize: 13, color: '#3b82f6', marginTop: 2 },
  patientTagRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  conditionTag: {
    padding: '3px 10px',
    background: '#dbeafe',
    color: '#1d4ed8',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    border: '1px solid #93c5fd',
  },
  allergyTag: {
    padding: '3px 10px',
    background: '#fee2e2',
    color: '#dc2626',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    border: '1px solid #fca5a5',
  },
  lastConsult: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#64748b' },
  // Vitals
  vitalsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 },
  vitalCard: {
    padding: 16,
    background: '#f8fafc',
    border: '1.5px solid #e2e8f0',
    borderRadius: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    transition: 'opacity 0.2s',
  },
  vitalCardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  vitalLabel: { fontSize: 13, fontWeight: 700, color: '#374151' },
  optionalBadge: {
    marginLeft: 6,
    fontSize: 10,
    fontWeight: 500,
    color: '#94a3b8',
    background: '#f1f5f9',
    padding: '1px 6px',
    borderRadius: 10,
  },
  checkboxLabel: { display: 'flex', alignItems: 'center', cursor: 'pointer' },
  notMeasuredBadge: {
    padding: '6px 12px',
    background: '#f1f5f9',
    borderRadius: 6,
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  vitalInputRow: { display: 'flex', alignItems: 'center', gap: 6 },
  vitalInput: {
    flex: 1,
    padding: '8px 10px',
    borderRadius: 7,
    border: '1.5px solid #e2e8f0',
    fontSize: 15,
    fontWeight: 600,
    color: '#1e293b',
    background: '#fff',
    outline: 'none',
    fontFamily: 'inherit',
    minWidth: 0,
  },
  vitalUnit: { fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', fontWeight: 500 },
  glucoseToggle: { display: 'flex', gap: 6, marginTop: 8 },
  toggleBtn: {
    flex: 1,
    padding: '5px 0',
    borderRadius: 6,
    border: 'none',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  // Attachments
  dropZone: {
    border: '2px dashed',
    borderRadius: 12,
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer',
    transition: 'all 0.15s',
    userSelect: 'none',
  },
  dropZoneText: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textAlign: 'center' },
  dropZoneHint: { fontSize: 12, color: '#94a3b8' },
  fileList: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
  },
  fileItemIcon: { flexShrink: 0 },
  fileItemInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  fileName: { fontSize: 13, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  fileSize: { fontSize: 11, color: '#94a3b8' },
  fileRemove: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    transition: 'color 0.1s',
  },
  attachmentCount: { fontSize: 12, color: '#94a3b8', textAlign: 'right', marginTop: 4 },
  // Urgency
  urgencyGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 8 },
  urgencyCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    borderRadius: 10,
    border: '2px solid',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'left',
    background: 'none',
  },
  urgencyDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  urgencyInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  urgencyLabel: { fontSize: 14, fontWeight: 700 },
  urgencyDesc: { fontSize: 11, color: '#64748b' },
  urgencyNote: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    padding: '10px 14px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 12,
    color: '#64748b',
    lineHeight: 1.5,
  },
  // Action bar
  actionBar: {
    position: 'fixed',
    bottom: 0,
    left: 'var(--sidebar-width, 260px)',
    right: 0,
    background: '#fff',
    borderTop: '1px solid #e2e8f0',
    zIndex: 100,
    boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
  },
  actionBarInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 24px',
    gap: 10,
    flexWrap: 'wrap',
    maxWidth: 1200,
    margin: '0 auto',
  },
  actionBarRight: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  btnGhost: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 18px',
    borderRadius: 8,
    border: '1.5px solid #e2e8f0',
    background: 'transparent',
    color: '#64748b',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  btnSecondary: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 18px',
    borderRadius: 8,
    border: '1.5px solid #e2e8f0',
    background: '#f8fafc',
    color: '#374151',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  btnOutline: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 18px',
    borderRadius: 8,
    border: '1.5px solid #2563eb',
    background: 'transparent',
    color: '#2563eb',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  btnPrimary: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 22px',
    borderRadius: 8,
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s',
    boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
  },
  // Modal
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.6)',
    backdropFilter: 'blur(4px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    background: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 700,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid #f1f5f9',
  },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 },
  modalClose: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' },
  modalBody: { padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 },
  modalFooter: { display: 'flex', gap: 10, padding: '16px 24px', borderTop: '1px solid #f1f5f9', justifyContent: 'flex-end' },
  // Preview
  previewSection: {
    padding: 16,
    background: '#f8fafc',
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  previewSectionTitle: { fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 },
  previewRow: { display: 'flex', gap: 12 },
  previewLabel: { fontSize: 13, color: '#94a3b8', fontWeight: 500, minWidth: 130, flexShrink: 0 },
  previewValue: { fontSize: 13, color: '#1e293b', fontWeight: 500 },
  previewEmpty: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic' },
  previewAttachment: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' },
}
