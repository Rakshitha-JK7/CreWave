import { useState, useEffect, useMemo } from 'react';
import { Activity, Heart, Thermometer, Wind, Droplets, Paperclip, FileText, Download, Calendar, Shield } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import consultationService from '../../services/consultationService';
import { formatDate } from '../../utils/formatDate';

export default function MedicalRecords() {
  const { currentUser } = useAuth();
  const patientId = currentUser?.patientId || currentUser?.referenceId || currentUser?.id || 'PAT001';
  const patientName = currentUser?.name || '';

  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadRecords() {
      try {
        const data = await consultationService.getConsultations();
        if (mounted && Array.isArray(data)) {
          const myCons = data.filter(
            (c) => c.patientId === patientId || (patientName && c.patientName?.toLowerCase().includes(patientName.toLowerCase()))
          );
          setConsultations(myCons);
        }
      } catch (err) {
        console.warn('Failed to load medical records:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadRecords();
    return () => { mounted = false; };
  }, [patientId, patientName]);

  const myConsultations = consultations;

  // Aggregate vitals across consultations
  const vitalsHistory = myConsultations.map((c) => ({
    date: c.createdAt,
    clinic: c.clinicName || 'Rampur Primary Health Center',
    caseId: c.id,
    bp: c.vitals?.bloodPressure?.systolic && c.vitals?.bloodPressure?.diastolic
      ? `${c.vitals.bloodPressure.systolic}/${c.vitals.bloodPressure.diastolic} mmHg`
      : 'Not Measured',
    hr: c.vitals?.heartRate?.value ? `${c.vitals.heartRate.value} bpm` : 'Not Measured',
    temp: c.vitals?.temperature?.value ? `${c.vitals.temperature.value} °C` : 'Not Measured',
    spo2: c.vitals?.spo2?.value ? `${c.vitals.spo2.value} %` : 'Not Measured',
    rr: c.vitals?.respiratoryRate?.value ? `${c.vitals.respiratoryRate.value} /min` : 'Not Measured',
    bg: c.vitals?.bloodGlucose?.value ? `${c.vitals.bloodGlucose.value} mg/dL` : 'Not Measured',
  }));

  // Attachments
  const allAttachments = myConsultations.flatMap((c) =>
    (c.attachments || []).map((att) => ({
      ...att,
      consultationId: c.id,
      date: c.createdAt,
    }))
  );

  return (
    <DashboardLayout role="patient">
      <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>My Medical Records & Vitals</h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>
            Historical biometric measurements, clinical vitals, and diagnostic attachments collected during telemedicine sessions.
          </p>
        </div>

        {/* Notice */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
          <Shield size={20} color="#0284c7" flexShrink={0} />
          <span style={{ fontSize: 13, color: '#475569' }}>
            All physiological data below represents genuine measurements taken by rural healthcare workers using calibrated diagnostic tools.
          </span>
        </div>

        {/* Vitals History Table */}
        <div className="card" style={{ marginBottom: 28, overflow: 'hidden' }}>
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Activity size={18} color="#0284c7" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Physiological Measurements & Vitals History</h3>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Clinic Source</th>
                    <th>Blood Pressure</th>
                    <th>Heart Rate</th>
                    <th>Temperature</th>
                    <th>SpO2</th>
                    <th>Resp. Rate</th>
                    <th>Blood Glucose</th>
                  </tr>
                </thead>
                <tbody>
                  {vitalsHistory.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{formatDate(row.date)}</td>
                      <td style={{ fontSize: 12, color: '#64748b' }}>{row.clinic}</td>
                      <td>
                        <strong style={{ color: row.bp.includes('Not') ? '#94a3b8' : '#0f172a' }}>{row.bp}</strong>
                      </td>
                      <td>
                        <span style={{ color: row.hr.includes('Not') ? '#94a3b8' : '#0f172a' }}>{row.hr}</span>
                      </td>
                      <td>
                        <span style={{ color: row.temp.includes('Not') ? '#94a3b8' : '#0f172a' }}>{row.temp}</span>
                      </td>
                      <td>
                        <span style={{ color: row.spo2.includes('Not') ? '#94a3b8' : '#16a34a', fontWeight: 600 }}>
                          {row.spo2}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: row.rr.includes('Not') ? '#94a3b8' : '#0f172a' }}>{row.rr}</span>
                      </td>
                      <td>
                        <span style={{ color: row.bg.includes('Not') ? '#94a3b8' : '#0f172a' }}>{row.bg}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Diagnostic Attachments / Reports */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Paperclip size={18} color="#0d9488" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Diagnostic Attachments & Reports</h3>
          </div>
          <div className="card-body">
            {allAttachments.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>No file attachments on record.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                {allAttachments.map((att, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#f8fafc',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
                        {att.name || `Medical File #${idx + 1}`}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        Case #{att.consultationId} • {formatDate(att.date)}
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => alert(`Attachment "${att.name || 'document'}" download simulated.`)}
                      title="Download file"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
