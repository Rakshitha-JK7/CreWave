import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Eye, Phone, MapPin, X, FileText } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { mockPatients, mockConsultations } from '../../data/mockData';
import { formatDate } from '../../utils/formatDate';
import EmptyState from '../../components/EmptyState';

export default function DoctorPatientRecords() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);

  const filteredPatients = mockPatients.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.id?.toLowerCase().includes(q) ||
      p.village?.toLowerCase().includes(q)
    );
  });

  return (
    <DashboardLayout role="doctor">
      <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 40 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Rural Patient Clinical Directory</h1>
            <p style={{ color: '#64748b', fontSize: 14 }}>
              Cross-clinic patient registry with longitudinal medical history and past telemedicine sessions.
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
                placeholder="Search patients by name, ID, or village..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Patients Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Name</th>
                  <th>Age / Sex</th>
                  <th>Village & District</th>
                  <th>Chronic Conditions</th>
                  <th>Consultations</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map((patient) => (
                  <tr key={patient.id}>
                    <td style={{ fontWeight: 600, color: '#0284c7' }}>{patient.id}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{patient.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>Blood: {patient.bloodGroup || 'Unknown'}</div>
                    </td>
                    <td>{patient.age} yrs / {patient.sex}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={14} color="#94a3b8" />
                        {patient.village}, {patient.district || 'Sitapur'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {patient.conditions?.map((c) => (
                          <span key={c} className="tag" style={{ fontSize: 11 }}>{c}</span>
                        ))}
                        {(!patient.conditions || patient.conditions.length === 0) && (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>None</span>
                        )}
                      </div>
                    </td>
                    <td>{patient.consultationCount || 1} visits</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedPatient(patient)}
                        >
                          <Eye size={14} /> Full History
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Patient Details Modal */}
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
            <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{selectedPatient.name}</h3>
                  <span style={{ fontSize: 13, color: '#64748b' }}>
                    {selectedPatient.id} • {selectedPatient.age} yrs / {selectedPatient.sex} • Blood Group: {selectedPatient.bloodGroup || 'Unknown'}
                  </span>
                </div>
                <button onClick={() => setSelectedPatient(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: 24 }}>
                <div style={{ marginBottom: 18 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 13, color: '#64748b', textTransform: 'uppercase' }}>Baseline Chronic Illnesses</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selectedPatient.conditions?.map((c) => (
                      <span key={c} className="tag">{c}</span>
                    ))}
                    {(!selectedPatient.conditions || selectedPatient.conditions.length === 0) && (
                      <span style={{ color: '#94a3b8', fontSize: 13 }}>No chronic conditions recorded</span>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 13, color: '#64748b', textTransform: 'uppercase' }}>Known Allergies</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selectedPatient.allergies?.map((a) => (
                      <span key={a} className="tag" style={{ background: '#fee2e2', color: '#991b1b' }}>{a}</span>
                    ))}
                    {(!selectedPatient.allergies || selectedPatient.allergies.length === 0) && (
                      <span style={{ color: '#94a3b8', fontSize: 13 }}>No drug allergies known</span>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 13, color: '#64748b', textTransform: 'uppercase' }}>Consultations on Record</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {mockConsultations
                      .filter((c) => c.patientId === selectedPatient.id)
                      .map((c) => (
                        <div key={c.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{c.symptoms?.chiefComplaint || 'Consultation'}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>Case #{c.id} • {formatDate(c.createdAt)}</div>
                          </div>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setSelectedPatient(null);
                              navigate(`/doctor/consultation/${c.id}`);
                            }}
                          >
                            Open Case
                          </button>
                        </div>
                      ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={() => setSelectedPatient(null)}>
                    Close
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
