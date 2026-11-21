import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User,
  Activity,
  Heart,
  Thermometer,
  Wind,
  Droplets,
  Paperclip,
  CheckCircle,
  Clock,
  AlertTriangle,
  AlertCircle,
  FileText,
  MessageSquare,
  ArrowLeft,
  Download,
  Eye,
  Send,
  X,
  ShieldAlert,
  Calendar,
  Building,
  Phone,
  CheckSquare,
} from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useApp } from '../../context/AppContext';
import doctorService from '../../services/doctorService';
import patientService from '../../services/patientService';
import VitalCard from '../../components/VitalCard';
import StatusBadge from '../../components/StatusBadge';
import { formatDate, formatDateTime, formatRelative } from '../../utils/formatDate';

function safeString(val, fallback = '—') {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') {
    if (val.text) return String(val.text);
    if (val.description) return String(val.description);
    if (val.name) return String(val.name);
    return fallback;
  }
  return String(val);
}

export default function ConsultationDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addNotification } = useApp() || {};

  const [dbConsultation, setDbConsultation] = useState(null);
  const [dbPatient, setDbPatient] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function fetchRecord() {
      try {
        const c = await doctorService.getDoctorConsultation(id);
        if (mounted && c) {
          setDbConsultation(c);
          if (c.patientId) {
            const p = await patientService.getPatient(c.patientId).catch(() => null);
            if (mounted && p) setDbPatient(p);
          }
        }
      } catch (err) {
        console.warn('Could not load consultation from API:', err);
      }
    }
    fetchRecord();
    return () => { mounted = false; };
  }, [id]);

  // Find consultation from loaded API record or localStorage
  const consultation = useMemo(() => {
    if (dbConsultation) return dbConsultation;
    try {
      const stored = localStorage.getItem('carewave_consultations');
      if (stored) {
        const list = JSON.parse(stored);
        const match = list.find((c) => c.id === id);
        if (match) return match;
      }
    } catch (e) {
      // ignore
    }
    return {
      id,
      patientId: 'PAT-LOCAL',
      patientName: 'Patient Record',
      status: 'pending',
      urgency: 'routine',
      vitals: {},
      symptoms: {},
      attachments: [],
    };
  }, [id, dbConsultation]);

  // Patient details
  const patient = useMemo(() => {
    if (dbPatient) return dbPatient;
    return {
      id: consultation.patientId || 'PAT001',
      name: consultation.patientName || 'Patient',
      age: consultation.patientAge || 45,
      sex: consultation.patientSex || 'Male',
      village: consultation.patientVillage || 'Rural Center',
      bloodGroup: consultation.bloodGroup || 'B+',
      emergencyContact: {
        name: 'Family Contact',
        phone: '+91-9876543211',
        relation: 'Relative',
      },
      conditions: [],
      allergies: [],
      medications: [],
    };
  }, [consultation, dbPatient]);

  // Modals state
  const [previewImage, setPreviewImage] = useState(null);
  const [requestInfoModalOpen, setRequestInfoModalOpen] = useState(false);
  const [requestInfoText, setRequestInfoText] = useState('');
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [requestSentSuccess, setRequestSentSuccess] = useState(false);

  // Vitals helper
  const vitals = consultation.vitals || {};
  const progress =
    consultation.transferProgress ||
    (consultation.status === 'delivered'
      ? 100
      : consultation.status === 'partially_uploaded'
        ? 65
        : 100);

  const hasPendingAttachments = consultation.attachments?.some(
    (a) => a.status === 'pending' || a.status === 'partial'
  );

  const isReviewed = ['response_available', 'completed'].includes(consultation.status);

  // Send request info to health worker
  const handleSendInfoRequest = (e) => {
    e.preventDefault();
    if (!requestInfoText.trim()) return;

    setIsSendingRequest(true);
    setTimeout(() => {
      setIsSendingRequest(false);
      setRequestSentSuccess(true);
      if (addNotification) {
        addNotification(`Information request sent to ${consultation.healthWorkerName || 'clinic'}.`, 'success');
      }
      setTimeout(() => {
        setRequestSentSuccess(false);
        setRequestInfoModalOpen(false);
        setRequestInfoText('');
      }, 1500);
    }, 600);
  };

  return (
    <DashboardLayout role="doctor">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Top Back Navigation Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'none',
              border: 'none',
              color: '#0284c7',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <ArrowLeft size={18} />
            Back to Consultations
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Consultation Reference:</span>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                fontWeight: 700,
                color: '#0f172a',
                backgroundColor: '#e2e8f0',
                padding: '3px 10px',
                borderRadius: 6,
              }}
            >
              {consultation.id}
            </span>
          </div>
        </div>

        {/* Pending Transfer Notice if attachments incomplete */}
        {hasPendingAttachments && (
          <div
            style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderLeft: '5px solid #f59e0b',
              borderRadius: 8,
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              color: '#92400e',
              fontSize: '0.875rem',
            }}
          >
            <Clock size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
            <div>
              <strong>Transfer In Progress:</strong> Some medical attachments are still being uploaded from the rural clinic over low bandwidth. You may review the available clinical data and symptoms while transfer completes.
            </div>
          </div>
        )}

        {/* Main Two-Column Layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 2.2fr) minmax(320px, 1fr)',
            gap: 24,
            alignItems: 'start',
          }}
        >
          {/* ================= LEFT COLUMN (Clinical Info) ================= */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* SECTION 1: Patient Information */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 12,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                border: '1px solid #e2e8f0',
                padding: '22px 24px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                  borderBottom: '1px solid #f1f5f9',
                  paddingBottom: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ backgroundColor: '#e0f2fe', padding: 8, borderRadius: 8 }}>
                    <User size={20} color="#0284c7" />
                  </div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                    Patient Information
                  </h2>
                </div>
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#0284c7',
                    backgroundColor: '#e0f2fe',
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}
                >
                  {patient.id}
                </span>
              </div>

              {/* Patient Attributes Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 16,
                  marginBottom: 20,
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>FULL NAME</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{patient.name}</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>AGE / SEX</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1e293b' }}>
                    {patient.age} years / {patient.sex}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>BLOOD GROUP</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#dc2626' }}>
                    {patient.bloodGroup || '—'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>VILLAGE / DISTRICT</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#1e293b' }}>
                    {patient.village}, {patient.district || 'Sitapur'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>EMERGENCY CONTACT</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500, color: '#1e293b' }}>
                    {typeof patient.emergencyContact === 'string'
                      ? patient.emergencyContact
                      : patient.emergencyContact?.name
                        ? `${patient.emergencyContact.name} (${patient.emergencyContact.relation || 'Kin'})`
                        : 'None documented'}
                    {typeof patient.emergencyContact === 'object' && patient.emergencyContact?.phone && (
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {patient.emergencyContact.phone}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Medical History Tags */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginRight: 8 }}>
                    Pre-existing Conditions:
                  </span>
                  {(Array.isArray(patient.conditions) ? patient.conditions : typeof patient.conditions === 'string' && patient.conditions ? patient.conditions.split(', ') : []).length > 0 ? (
                    (Array.isArray(patient.conditions) ? patient.conditions : patient.conditions.split(', ')).map((cond, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: 'inline-block',
                          backgroundColor: '#f1f5f9',
                          color: '#334155',
                          fontSize: '0.775rem',
                          fontWeight: 600,
                          padding: '3px 9px',
                          borderRadius: 999,
                          marginRight: 6,
                          marginBottom: 4,
                        }}
                      >
                        {typeof cond === 'object' ? JSON.stringify(cond) : String(cond)}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>None documented</span>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#dc2626', marginRight: 8 }}>
                    Known Allergies:
                  </span>
                  {(Array.isArray(patient.allergies) ? patient.allergies : typeof patient.allergies === 'string' && patient.allergies ? patient.allergies.split(', ') : []).length > 0 ? (
                    (Array.isArray(patient.allergies) ? patient.allergies : patient.allergies.split(', ')).map((alg, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: 'inline-block',
                          backgroundColor: '#fee2e2',
                          color: '#991b1b',
                          fontSize: '0.775rem',
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: 999,
                          marginRight: 6,
                          marginBottom: 4,
                        }}
                      >
                        ⚠️ {typeof alg === 'object' ? JSON.stringify(alg) : String(alg)}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>No known drug allergies</span>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginRight: 8 }}>
                    Current Medications:
                  </span>
                  {(Array.isArray(patient.medications) ? patient.medications : typeof patient.medications === 'string' && patient.medications ? patient.medications.split(', ') : []).length > 0 ? (
                    (Array.isArray(patient.medications) ? patient.medications : patient.medications.split(', ')).map((med, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: 'inline-block',
                          backgroundColor: '#e0f2fe',
                          color: '#0369a1',
                          fontSize: '0.775rem',
                          fontWeight: 600,
                          padding: '3px 9px',
                          borderRadius: 999,
                          marginRight: 6,
                          marginBottom: 4,
                        }}
                      >
                        💊 {typeof med === 'object' ? JSON.stringify(med) : String(med)}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>None</span>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 2: Clinical Information */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 12,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                border: '1px solid #e2e8f0',
                padding: '22px 24px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 16,
                  borderBottom: '1px solid #f1f5f9',
                  paddingBottom: 12,
                }}
              >
                <div style={{ backgroundColor: '#fef3c7', padding: 8, borderRadius: 8 }}>
                  <FileText size={20} color="#d97706" />
                </div>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                  Clinical Presentation
                </h2>
              </div>

              {/* Chief Complaint Highlight */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderLeft: '5px solid #0284c7',
                  borderRadius: 8,
                  padding: '16px 20px',
                  marginBottom: 18,
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Chief Complaint
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                  {typeof consultation.chiefComplaint === 'object' && consultation.chiefComplaint !== null
                    ? (consultation.chiefComplaint.text || JSON.stringify(consultation.chiefComplaint))
                    : (consultation.chiefComplaint || 'Consultation Review')}
                </div>
              </div>

              {/* Symptoms Details */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Symptoms Description
                </div>
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '14px 16px',
                    fontSize: '0.9rem',
                    color: '#334155',
                    lineHeight: 1.6,
                  }}
                >
                  {typeof consultation.symptoms === 'object' && consultation.symptoms !== null
                    ? (consultation.symptoms.description || consultation.symptoms.text || (JSON.stringify(consultation.symptoms) === '{}' ? 'No specific symptom description recorded.' : JSON.stringify(consultation.symptoms)))
                    : (consultation.symptoms || 'No specific symptom description recorded.')}
                </div>
              </div>

              {/* Onset, Duration, Severity row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 14,
                  marginBottom: 18,
                }}
              >
                <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>DURATION</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1e293b', marginTop: 2 }}>
                    {safeString(consultation.duration, '—')}
                  </div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>ONSET</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1e293b', marginTop: 2 }}>
                    {safeString(consultation.onset, '—')}
                  </div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>SEVERITY</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#d97706', marginTop: 2 }}>
                    {safeString(consultation.severity, '—')}
                  </div>
                </div>
              </div>

              {/* Healthcare worker field observations */}
              {Boolean(consultation.notes) && (
                <div>
                  <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                    Healthcare Worker Observations ({safeString(consultation.healthWorkerName, 'Clinic Staff')})
                  </div>
                  <div
                    style={{
                      backgroundColor: '#f1f5f9',
                      borderRadius: 8,
                      padding: '12px 16px',
                      fontSize: '0.875rem',
                      color: '#334155',
                      fontStyle: 'italic',
                      lineHeight: 1.5,
                    }}
                  >
                    "{safeString(consultation.notes, 'Observations recorded at clinic')}"
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 3: Vitals */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 12,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                border: '1px solid #e2e8f0',
                padding: '22px 24px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                  borderBottom: '1px solid #f1f5f9',
                  paddingBottom: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ backgroundColor: '#ccfbf1', padding: 8, borderRadius: 8 }}>
                    <Activity size={20} color="#0f766e" />
                  </div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                    Vital Signs
                  </h2>
                </div>
                {vitals.measuredAt && (
                  <span style={{ fontSize: '0.775rem', color: '#64748b' }}>
                    Recorded: {formatTimeOrDateTime(vitals.measuredAt)}
                  </span>
                )}
              </div>

              {/* Vitals Grid with built-in normal ranges */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 16,
                }}
              >
                {/* Heart Rate */}
                <VitalCard
                  label="Heart Rate"
                  value={vitals.heartRate}
                  unit="bpm"
                  isAvailable={vitals.heartRate !== undefined && vitals.heartRate !== null}
                  icon={Heart}
                  normalRange={{ min: 60, max: 100 }}
                  timestamp={vitals.measuredAt}
                />

                {/* Blood Pressure Systolic / Diastolic */}
                <VitalCard
                  label="Blood Pressure"
                  value={
                    typeof vitals.bloodPressure === 'object' && vitals.bloodPressure !== null
                      ? (vitals.bloodPressure.systolic ? `${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic}` : '—')
                      : (vitals.bloodPressure || (vitals.bpSystolic ? `${vitals.bpSystolic}/${vitals.bpDiastolic}` : null))
                  }
                  unit="mmHg"
                  isAvailable={Boolean(vitals.bloodPressure || vitals.bpSystolic)}
                  icon={Activity}
                  normalRange={vitals.bpSystolic ? { min: 90, max: 120 } : null}
                  timestamp={vitals.measuredAt}
                />

                {/* Temperature */}
                <VitalCard
                  label="Temperature"
                  value={vitals.temperature}
                  unit="°C"
                  isAvailable={vitals.temperature !== undefined && vitals.temperature !== null}
                  icon={Thermometer}
                  normalRange={{ min: 36.1, max: 37.2 }}
                  timestamp={vitals.measuredAt}
                />

                {/* SpO2 */}
                <VitalCard
                  label="Oxygen Saturation (SpO2)"
                  value={vitals.spo2}
                  unit="%"
                  isAvailable={vitals.spo2 !== undefined && vitals.spo2 !== null}
                  icon={Activity}
                  normalRange={{ min: 95, max: 100 }}
                  timestamp={vitals.measuredAt}
                />

                {/* Respiratory Rate */}
                <VitalCard
                  label="Respiratory Rate"
                  value={vitals.respiratoryRate}
                  unit="/min"
                  isAvailable={vitals.respiratoryRate !== undefined && vitals.respiratoryRate !== null}
                  icon={Wind}
                  normalRange={{ min: 12, max: 20 }}
                  timestamp={vitals.measuredAt}
                />

                {/* Blood Glucose */}
                <VitalCard
                  label="Blood Glucose (Random)"
                  value={vitals.bloodGlucose}
                  unit="mg/dL"
                  isAvailable={vitals.bloodGlucose !== undefined && vitals.bloodGlucose !== null}
                  icon={Droplets}
                  normalRange={{ min: 70, max: 140 }}
                  timestamp={vitals.measuredAt}
                />
              </div>
            </div>

            {/* SECTION 4: Attachments */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 12,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                border: '1px solid #e2e8f0',
                padding: '22px 24px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                  borderBottom: '1px solid #f1f5f9',
                  paddingBottom: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ backgroundColor: '#f1f5f9', padding: 8, borderRadius: 8 }}>
                    <Paperclip size={20} color="#475569" />
                  </div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                    Diagnostic Attachments ({consultation.attachments?.length || 0})
                  </h2>
                </div>
              </div>

              {!consultation.attachments || consultation.attachments.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                  No attachments in this consultation.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {consultation.attachments.map((att) => {
                    const fileName = att.name || att.fileName || '';
                    const isImg = att.type === 'image' || fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.png');
                    const isUploaded = att.status === 'uploaded';

                    return (
                      <div
                        key={att.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          backgroundColor: '#fafbfc',
                          flexWrap: 'wrap',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              backgroundColor: '#e0f2fe',
                              padding: 8,
                              borderRadius: 6,
                              color: '#0284c7',
                              display: 'flex',
                            }}
                          >
                            <FileText size={18} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.875rem' }}>
                              {fileName || 'Attachment'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {att.size || 'Unknown size'} · {String(att.type || 'FILE').toUpperCase()}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <StatusBadge status={att.status} type="attachment" />

                          {isImg && isUploaded && (
                            <button
                              onClick={() => setPreviewImage(att)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '6px 12px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                backgroundColor: '#f1f5f9',
                                color: '#0f172a',
                                border: '1px solid #cbd5e1',
                                borderRadius: 6,
                                cursor: 'pointer',
                              }}
                            >
                              <Eye size={14} />
                              Preview
                            </button>
                          )}

                          <button
                            onClick={() => {
                              if (isUploaded) {
                                alert(`Downloading ${fileName}...`);
                              } else {
                                alert('Download available after full upload completes from clinic.');
                              }
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '6px 12px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              backgroundColor: isUploaded ? '#0284c7' : '#f8fafc',
                              color: isUploaded ? '#ffffff' : '#94a3b8',
                              border: isUploaded ? 'none' : '1px solid #e2e8f0',
                              borderRadius: 6,
                              cursor: isUploaded ? 'pointer' : 'not-allowed',
                            }}
                          >
                            <Download size={14} />
                            Download
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECTION 5: Transfer Status / Completeness */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 12,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                border: '1px solid #e2e8f0',
                padding: '22px 24px',
              }}
            >
              <h2 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                Data Transfer & Packet Completeness
              </h2>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Overall Packet Transfer</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: progress === 100 ? '#16a34a' : '#d97706' }}>
                    {progress}% Complete
                  </span>
                </div>
                <div style={{ width: '100%', height: 8, backgroundColor: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${progress}%`,
                      height: '100%',
                      backgroundColor: progress === 100 ? '#22c55e' : '#f59e0b',
                    }}
                  />
                </div>
              </div>

              {/* Checklist */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 12,
                  marginTop: 16,
                  padding: '14px',
                  backgroundColor: '#f8fafc',
                  borderRadius: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: '#166534', fontWeight: 600 }}>
                  <CheckCircle size={16} color="#16a34a" /> Patient Demographics
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: '#166534', fontWeight: 600 }}>
                  <CheckCircle size={16} color="#16a34a" /> Symptoms & Complaints
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: '#166534', fontWeight: 600 }}>
                  <CheckCircle size={16} color="#16a34a" /> Baseline Vitals
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: hasPendingAttachments ? '#b45309' : '#166534', fontWeight: 600 }}>
                  {hasPendingAttachments ? (
                    <>
                      <Clock size={16} color="#d97706" /> Attachments (Partial)
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} color="#16a34a" /> Attachments Verified
                    </>
                  )}
                </div>
              </div>

              {consultation.missingInfo && consultation.missingInfo.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>
                    Pending Sync Components:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.825rem', color: '#b91c1c' }}>
                    {consultation.missingInfo.map((m, i) => (
                      <li key={i}>{typeof m === 'object' ? JSON.stringify(m) : String(m)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

          </div>

          {/* ================= RIGHT PANEL (Actions + Metadata) ================= */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Quick Action Card */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 12,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                border: '1px solid #e2e8f0',
                padding: '22px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                Doctor Review Actions
              </h3>

              {isReviewed ? (
                <div
                  style={{
                    backgroundColor: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    borderRadius: 8,
                    padding: '12px 14px',
                    fontSize: '0.85rem',
                    color: '#065f46',
                  }}
                >
                  ✓ Clinical assessment and prescription has already been submitted for this consultation.
                </div>
              ) : (
                <button
                  onClick={() => navigate(`/doctor/response/${consultation.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    width: '100%',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '12px 18px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
                  }}
                >
                  <Activity size={18} />
                  Start / Edit Review
                </button>
              )}

              <button
                onClick={() => setRequestInfoModalOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  padding: '10px 18px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <MessageSquare size={16} />
                Request More Information
              </button>
            </div>

            {/* Case Metadata Card */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 12,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                border: '1px solid #e2e8f0',
                padding: '22px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                Case Metadata
              </h3>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.825rem', color: '#64748b' }}>Urgency Level</span>
                <StatusBadge status={consultation.urgency} type="urgency" />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.825rem', color: '#64748b' }}>Review Status</span>
                <StatusBadge status={consultation.status} type="consultation" />
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>RECEIVED AT</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b', marginTop: 2 }}>
                  {formatDateTime(consultation.receivedAt || consultation.createdAt)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>ORIGINATING CLINIC</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b', marginTop: 2 }}>
                  {safeString(consultation.clinicName, 'Rampur Primary Health Center')}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>HEALTHCARE WORKER</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b', marginTop: 2 }}>
                  {safeString(consultation.healthWorkerName, 'Community Health Staff')}
                </div>
                {consultation.healthWorkerPhone && (
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {safeString(consultation.healthWorkerPhone)}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* IMAGE PREVIEW MODAL */}
        {previewImage && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.75)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}
            onClick={() => setPreviewImage(null)}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 12,
                maxWidth: 700,
                width: '100%',
                overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 20px',
                  borderBottom: '1px solid #e2e8f0',
                }}
              >
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{previewImage.name || previewImage.fileName || 'Attachment'}</div>
                <button
                  onClick={() => setPreviewImage(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={20} />
                </button>
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: '100%',
                    height: 320,
                    backgroundColor: '#f1f5f9',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                    border: '1px dashed #cbd5e1',
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <Activity size={48} color="#0284c7" style={{ marginBottom: 12 }} />
                    <div style={{ fontWeight: 600 }}>Diagnostic Image Preview</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>
                      {previewImage.name || previewImage.fileName || 'Attachment'} ({previewImage.size || 'Diagnostic Media'})
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ padding: '12px 20px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setPreviewImage(null)}
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 16px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* REQUEST MORE INFORMATION MODAL */}
        {requestInfoModalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 12,
                maxWidth: 550,
                width: '100%',
                padding: '24px',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                  Request More Information
                </h3>
                <button
                  onClick={() => setRequestInfoModalOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={20} />
                </button>
              </div>

              {requestSentSuccess ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#16a34a' }}>
                  <CheckCircle size={48} style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Request Dispatched</div>
                  <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: 4 }}>
                    The healthcare worker at {safeString(consultation.clinicName, 'the clinic')} has been queued for sync notification.
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSendInfoRequest}>
                  <p style={{ margin: '0 0 12px 0', fontSize: '0.875rem', color: '#64748b' }}>
                    Send an urgent inquiry or request additional vital measurements / imaging from the health worker:
                  </p>
                  <textarea
                    rows={4}
                    placeholder="E.g. Please re-check BP after 15 mins of rest, and capture a clearer photograph of the rashes on both inner forearms..."
                    value={requestInfoText}
                    onChange={(e) => setRequestInfoText(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: '0.875rem',
                      color: '#1e293b',
                      boxSizing: 'border-box',
                      outline: 'none',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                    }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                    <button
                      type="button"
                      onClick={() => setRequestInfoModalOpen(false)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSendingRequest || !requestInfoText.trim()}
                      style={{
                        padding: '8px 18px',
                        backgroundColor: '#0284c7',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 6,
                        fontWeight: 600,
                        cursor: isSendingRequest || !requestInfoText.trim() ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Send size={15} />
                      {isSendingRequest ? 'Sending...' : 'Send Request'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}

function formatTimeOrDateTime(d) {
  if (!d) return '—';
  try {
    const date = new Date(d);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}
