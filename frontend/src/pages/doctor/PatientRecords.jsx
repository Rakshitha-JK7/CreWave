import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, MapPin, X } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import patientService from '../../services/patientService';
import consultationService from '../../services/consultationService';
import doctorService from '../../services/doctorService';
import { formatDate } from '../../utils/formatDate';

export default function DoctorPatientRecords() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patients, setPatients] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      try {
        const [pts, cons, docCons] = await Promise.all([
          patientService.getPatients().catch(() => []),
          consultationService.getConsultations().catch(() => []),
          doctorService.getDoctorConsultations().catch(() => []),
        ]);
        if (mounted) {
          if (Array.isArray(pts)) setPatients(pts);
          const map = new Map();
          for (const c of (Array.isArray(cons) ? cons : [])) {
            if (c?.id) map.set(c.id, c);
          }
          for (const c of (Array.isArray(docCons) ? docCons : [])) {
            if (c?.id) {
              const existing = map.get(c.id) || {};
              map.set(c.id, { ...existing, ...c });
            }
          }
          setConsultations(Array.from(map.values()));
        }
      } catch (err) {
        console.warn('Failed to load doctor patient records:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchData();
    return () => { mounted = false; };
  }, []);

  const filteredPatients = patients.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.id?.toLowerCase().includes(q) ||
      p.referenceId?.toLowerCase().includes(q) ||
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
                {filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
                      {searchQuery ? 'No patients matching the search criteria.' : 'No patients found in the clinical directory.'}
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((patient) => (
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
                    <td>
                      {(() => {
                        const pId = patient.id;
                        const pRef = patient.referenceId;
                        const pInt = patient.internalId;
                        const pName = patient.name?.trim().toLowerCase();
                        const count = consultations.filter((c) => (
                          (pId && (c.patientId === pId || c.patientReferenceId === pId || c.patientInternalId === pId)) ||
                          (pRef && (c.patientId === pRef || c.patientReferenceId === pRef || c.patientInternalId === pRef)) ||
                          (pInt && (c.patientId === pInt || c.patientReferenceId === pInt || c.patientInternalId === pInt)) ||
                          (c.patient && (c.patient.id === pId || c.patient.referenceId === pRef || c.patient.id === pRef || c.patient.referenceId === pId || c.patient.id === pInt || c.patient.referenceId === pInt)) ||
                          (pName && c.patientName && c.patientName.trim().toLowerCase() === pName)
                        )).length;
                        return `${count || patient.consultationCount || 0} visits`;
                      })()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={async () => {
                            setSelectedPatient(patient);
                            try {
                              const fullPt = await patientService.getPatientById(patient.id || patient.internalId);
                              if (fullPt?.consultations?.length > 0) {
                                setConsultations((prev) => {
                                  const map = new Map(prev.map((c) => [c.id, c]));
                                  for (const c of fullPt.consultations) {
                                    const existing = map.get(c.id);
                                    if (!existing || !(existing.attachments?.length)) {
                                      map.set(c.id, {
                                        ...c,
                                        patientId: fullPt.id,
                                        patientReferenceId: fullPt.referenceId,
                                        patientInternalId: fullPt.internalId,
                                        patientName: fullPt.name,
                                      });
                                    }
                                  }
                                  return Array.from(map.values());
                                });
                              }
                            } catch (e) {
                              // ignore
                            }
                          }}
                        >
                          <Eye size={14} /> Full History
                        </button>
                      </div>
                    </td>
                  </tr>
                )))}
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(() => {
                      const pId = selectedPatient.id;
                      const pRef = selectedPatient.referenceId;
                      const pInt = selectedPatient.internalId;
                      const pName = selectedPatient.name?.trim().toLowerCase();

                      const patientCons = consultations.filter((c) => {
                        return (
                          (pId && (c.patientId === pId || c.patientReferenceId === pId || c.patientInternalId === pId)) ||
                          (pRef && (c.patientId === pRef || c.patientReferenceId === pRef || c.patientInternalId === pRef)) ||
                          (pInt && (c.patientId === pInt || c.patientReferenceId === pInt || c.patientInternalId === pInt)) ||
                          (c.patient && (c.patient.id === pId || c.patient.referenceId === pRef || c.patient.id === pRef || c.patient.referenceId === pId || c.patient.id === pInt || c.patient.referenceId === pInt)) ||
                          (pName && c.patientName && c.patientName.trim().toLowerCase() === pName)
                        );
                      });

                      if (patientCons.length === 0) {
                        return (
                          <div style={{ color: '#94a3b8', fontSize: 13, padding: '8px 0' }}>
                            No consultations on record for this patient.
                          </div>
                        );
                      }

                      return patientCons.map((c) => (
                        <div
                          key={c.id}
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 10,
                            padding: 14,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
                                {c.mainComplaint || c.symptoms?.chiefComplaint || (typeof c.symptoms === 'string' ? c.symptoms : 'Clinical Consultation')}
                              </div>
                              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                Case #{c.id} • {formatDate(c.consultationDate || c.createdAt)} • <span style={{ textTransform: 'capitalize', color: '#0284c7', fontWeight: 600 }}>{c.specialization || 'General Medicine'}</span>
                              </div>
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

                          {/* Render Uploaded Clinical Images & Evidence */}
                          {c.attachments && c.attachments.length > 0 && (
                            <div style={{ marginTop: 4, paddingTop: 10, borderTop: '1px dashed #cbd5e1' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                                Uploaded Medical Images &amp; Evidence ({c.attachments.length})
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                                {c.attachments.map((att, idx) => {
                                  const fileName = String(att?.name || att?.fileName || att?.file_name || 'Attachment');
                                  const isImg = att?.type === 'image' || att?.type === 'clinical_image' || att?.type === 'ecg' ||
                                    (typeof att?.mimeType === 'string' && att.mimeType.startsWith('image/')) ||
                                    ['.jpg', '.jpeg', '.png', '.webp', '.svg'].some((ext) => fileName.toLowerCase().endsWith(ext));
                                  const imgUrl = att?.originalUrl || att?.url || `/api/medical-records/attachments/${att.id}/original`;

                                  return isImg ? (
                                    <div
                                      key={att.id || idx}
                                      onClick={() => {
                                        setSelectedPatient(null);
                                        navigate(`/doctor/consultation/${c.id}`);
                                      }}
                                      style={{
                                        width: 76,
                                        height: 76,
                                        borderRadius: 8,
                                        overflow: 'hidden',
                                        border: '1px solid #cbd5e1',
                                        backgroundColor: '#0f172a',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                      }}
                                      title={`View ${fileName}`}
                                    >
                                      <img
                                        src={imgUrl}
                                        alt={fileName}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                          if (e.target.parentElement) {
                                            e.target.parentElement.innerHTML = '<span style="font-size:10px;color:#94a3b8;padding:4px;text-align:center;">Image</span>';
                                          }
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <div
                                      key={att.id || idx}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '5px 10px',
                                        borderRadius: 6,
                                        backgroundColor: '#f1f5f9',
                                        border: '1px solid #e2e8f0',
                                        fontSize: 12,
                                        color: '#334155',
                                      }}
                                    >
                                      <span>📄</span>
                                      <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {fileName}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ));
                    })()}
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
