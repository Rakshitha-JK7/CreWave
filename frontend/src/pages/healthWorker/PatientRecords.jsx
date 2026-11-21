import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, Users, FilePlus, Eye, Clock, Phone, MapPin, X } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import patientService from '../../services/patientService';
import { formatDate } from '../../utils/formatDate';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function PatientRecords() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sexFilter, setSexFilter] = useState('All');
  const [selectedPatient, setSelectedPatient] = useState(null);

  useEffect(() => {
    async function loadPatients() {
      setLoading(true);
      try {
        const data = await patientService.getPatients();
        setPatients(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadPatients();
  }, []);

  const filteredPatients = patients.filter((p) => {
    const matchesSearch =
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.village?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone?.includes(searchQuery);

    const matchesSex = sexFilter === 'All' || p.sex === sexFilter;

    return matchesSearch && matchesSex;
  });

  return (
    <DashboardLayout role="healthWorker">
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 40 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Patient Records</h1>
            <p style={{ color: '#64748b', fontSize: 14 }}>Search, view medical history, and initiate telemedicine consultations</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/health-worker/register-patient')}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <UserPlus size={18} /> Register New Patient
          </button>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
                <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: 38 }}
                  placeholder="Search by Patient ID, Name, Phone, or Village..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div style={{ width: 160 }}>
                <select className="form-control" value={sexFilter} onChange={(e) => setSexFilter(e.target.value)}>
                  <option value="All">All Sexes</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Table / Content */}
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <LoadingSpinner size="lg" text="Loading patient directory..." />
          </div>
        ) : filteredPatients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No patients found"
            description={searchQuery ? 'Try adjusting your search query or filter criteria' : 'Register the first patient in your rural clinic'}
            action={
              searchQuery
                ? { label: 'Clear Search', onClick: () => setSearchQuery('') }
                : { label: 'Register Patient', onClick: () => navigate('/health-worker/register-patient') }
            }
          />
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Patient ID</th>
                    <th>Name</th>
                    <th>Age / Sex</th>
                    <th>Village</th>
                    <th>Phone</th>
                    <th>Last Visit</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map((patient) => (
                    <tr key={patient.id}>
                      <td style={{ fontWeight: 600, color: '#0284c7' }}>{patient.referenceId || patient.id}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{patient.name}</div>
                        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, color: '#b91c1c', background: '#fef2f2', padding: '1px 6px', borderRadius: 4 }}>
                            Blood: {patient.bloodGroup || patient.blood_group || 'Unknown'}
                          </span>
                          {patient.conditions?.length > 0 && (
                            <span>• {patient.conditions.slice(0, 2).join(', ')}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {patient.age} yrs / {patient.sex}
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={14} color="#94a3b8" />
                          {patient.village}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Phone size={14} color="#94a3b8" />
                          {patient.phone || '—'}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: '#64748b' }}>
                        {patient.lastConsultation ? formatDate(patient.lastConsultation) : 'Never'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedPatient(patient)}
                            title="View Profile Details"
                          >
                            <Eye size={14} /> Profile
                          </button>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() =>
                              navigate('/health-worker/new-consultation', {
                                state: { patientId: patient.referenceId || patient.id },
                              })
                            }
                            title="Start New Consultation"
                          >
                            <FilePlus size={14} /> Consult
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

        {/* Patient Profile Modal */}
        {selectedPatient && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: 20,
            }}
          >
            <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Patient Summary</h3>
                <button
                  onClick={() => setSelectedPatient(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: 24 }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>
                    {selectedPatient.name?.charAt(0)}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>{selectedPatient.name}</h4>
                    <span style={{ fontSize: 13, color: '#64748b' }}>
                      {selectedPatient.referenceId || selectedPatient.id} • {selectedPatient.age} yrs • {selectedPatient.sex} • <strong style={{ color: '#b91c1c' }}>Blood: {selectedPatient.bloodGroup || selectedPatient.blood_group || 'Unknown'}</strong>
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20, fontSize: 14 }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: 12 }}>Phone</span>
                    <strong>{selectedPatient.phone || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: 12 }}>Village & District</span>
                    <strong>{selectedPatient.village}, {selectedPatient.district || 'Sitapur'}</strong>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: 12, marginBottom: 6 }}>Known Conditions</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selectedPatient.conditions?.map((c) => (
                      <span key={c} className="tag">{c}</span>
                    ))}
                    {(!selectedPatient.conditions || selectedPatient.conditions.length === 0) && (
                      <span style={{ color: '#94a3b8', fontSize: 13 }}>None recorded</span>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: 12, marginBottom: 6 }}>Known Allergies</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selectedPatient.allergies?.map((a) => (
                      <span key={a} className="tag" style={{ background: '#fee2e2', color: '#991b1b' }}>{a}</span>
                    ))}
                    {(!selectedPatient.allergies || selectedPatient.allergies.length === 0) && (
                      <span style={{ color: '#94a3b8', fontSize: 13 }}>No known allergies</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={() => setSelectedPatient(null)}>
                    Close
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      const id = selectedPatient.id;
                      setSelectedPatient(null);
                      navigate('/health-worker/new-consultation', { state: { patientId: id } });
                    }}
                  >
                    Start Consultation
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
