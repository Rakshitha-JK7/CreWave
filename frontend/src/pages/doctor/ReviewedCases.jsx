import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Search, Eye, MessageSquare, Calendar, ArrowRight, User } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import doctorService from '../../services/doctorService';
import { formatDate, formatDateTime } from '../../utils/formatDate';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';

export default function ReviewedCases() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadReviewed() {
      try {
        const data = await doctorService.getDoctorConsultations();
        if (mounted && Array.isArray(data)) {
          setConsultations(data.filter((c) => ['response_available', 'completed', 'reviewed_by_doctor', 'response_submitted', 'response_received_by_clinic'].includes(c.status)));
        }
      } catch (err) {
        console.warn('Failed to load reviewed cases:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadReviewed();
    return () => { mounted = false; };
  }, []);

  const filtered = consultations.filter((c) => {
    const q = searchQuery.toLowerCase();
    const complaint = c.mainComplaint || c.clinicalSummary?.mainComplaint || (typeof c.symptoms === 'object' ? c.symptoms?.chiefComplaint : c.symptoms) || '';
    return (
      (c.id && c.id.toLowerCase().includes(q)) ||
      (c.patientName && c.patientName.toLowerCase().includes(q)) ||
      complaint.toLowerCase().includes(q)
    );
  });

  return (
    <DashboardLayout role="doctor">
      <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Reviewed Clinical Cases</h1>
            <p style={{ color: '#64748b', fontSize: 14 }}>
              Archive of telemedicine cases assessed with finalized prescriptions and specialist recommendations.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ padding: 16 }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: 38 }}
                placeholder="Search reviewed cases by patient name, case ID, or diagnosis..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Table / List */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={CheckCircle}
            title="No reviewed cases found"
            description="Once you review incoming consultations and submit your medical advice, they will be archived here."
            action={{
              label: 'View Incoming Cases',
              onClick: () => navigate('/doctor/incoming'),
            }}
          />
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Patient</th>
                    <th>Chief Complaint</th>
                    <th>Review Date</th>
                    <th>Urgency</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600, color: '#0284c7' }}>{c.id}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.patientName || c.patient?.name || 'Patient'}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{c.patientId || c.patient?.id || c.patientReferenceId || '—'}</div>
                      </td>
                      <td style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.chiefComplaint || c.mainComplaint || c.clinicalSummary?.mainComplaint || (typeof c.symptoms === 'object' ? c.symptoms?.chiefComplaint : c.symptoms) || 'General Consultation'}
                      </td>
                      <td style={{ fontSize: 13, color: '#64748b' }}>
                        {formatDate(c.updatedAt || c.createdAt)}
                      </td>
                      <td>
                        <StatusBadge status={c.urgency || c.priority || 'normal'} type="urgency" />
                      </td>
                      <td>
                        <StatusBadge status={c.status} type="consultation" />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => navigate(`/doctor/consultation/${c.id}`)}
                            title="View Consultation Record"
                          >
                            <Eye size={14} /> View Case
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
