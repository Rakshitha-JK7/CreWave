import { useState, useEffect } from 'react';
import { User, Phone, MapPin, Heart, Shield, Edit2, CheckCircle, X, AlertCircle } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import patientService from '../../services/patientService';

export default function PatientProfile() {
  const { currentUser } = useAuth();

  const [patient, setPatient] = useState({
    id: currentUser?.patientId || currentUser?.referenceId || currentUser?.id || 'PAT001',
    name: currentUser?.name || 'Patient',
    age: currentUser?.age || 35,
    sex: currentUser?.sex || 'Male',
    village: currentUser?.village || 'Rural Center',
    phone: currentUser?.phone || currentUser?.contactNumber || '+91 98765 43210',
    bloodGroup: currentUser?.bloodGroup || 'B+',
    emergencyContact: {
      name: 'Primary Contact',
      phone: '+91 98765 43211',
      relation: 'Family',
    },
    conditions: [],
    allergies: [],
    medications: [],
  });

  useEffect(() => {
    let mounted = true;
    async function loadFullProfile() {
      if (currentUser?.patientId || currentUser?.referenceId) {
        const id = currentUser.patientId || currentUser.referenceId;
        const p = await patientService.getPatient(id).catch(() => null);
        if (mounted && p) {
          setPatient((prev) => ({ ...prev, ...p }));
        }
      }
    }
    loadFullProfile();
    return () => { mounted = false; };
  }, [currentUser]);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    phone: patient.phone || '',
    emergencyContactName: patient.emergencyContact?.name || '',
    emergencyContactPhone: patient.emergencyContact?.phone || '',
  });

  const handleSave = (e) => {
    e.preventDefault();
    const updated = {
      ...patient,
      phone: formData.phone,
      emergencyContact: {
        ...patient.emergencyContact,
        name: formData.emergencyContactName,
        phone: formData.emergencyContactPhone,
      },
    };

    setPatient(updated);
    localStorage.setItem(`carewave_patient_profile_${basePatient.id}`, JSON.stringify(updated));
    setIsEditing(false);
    addNotification('Contact and emergency details updated successfully!', 'success');
  };

  return (
    <DashboardLayout role="patient">
      <div style={{ maxWidth: 880, margin: '0 auto', paddingBottom: 40 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>My Health Profile</h1>
            <p style={{ color: '#64748b', fontSize: 14 }}>
              Your registered demographic profile, verified clinical history, and emergency contact details.
            </p>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => setIsEditing(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Edit2 size={16} /> Edit Contact Details
          </button>
        </div>

        {/* Clinical Governance Notice */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
          <Shield size={20} color="#0284c7" flexShrink={0} />
          <span style={{ fontSize: 13, color: '#475569' }}>
            <strong>Clinical Safety Protocol:</strong> To maintain strict diagnostic integrity, medical conditions and allergies can only be amended by certified healthcare workers at your local clinic.
          </span>
        </div>

        {/* Identity & Demographics Card */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <User size={18} color="#0284c7" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Personal Demographics</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
              <div>
                <span style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>Patient ID</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0284c7', marginTop: 2 }}>{patient.id}</div>
              </div>

              <div>
                <span style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>Full Name</span>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>{patient.name}</div>
              </div>

              <div>
                <span style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>Age / Sex</span>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>{patient.age} years / {patient.sex}</div>
              </div>

              <div>
                <span style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>Blood Group</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#b91c1c', marginTop: 2 }}>{patient.bloodGroup || 'B+'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Location & Contact */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MapPin size={18} color="#0d9488" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Location & Reachability</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
              <div>
                <span style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>Village</span>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>{patient.village}</div>
              </div>

              <div>
                <span style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>District & State</span>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                  {patient.district || 'Sitapur'}, {patient.state || 'Uttar Pradesh'}
                </div>
              </div>

              <div>
                <span style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>Phone Number</span>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>{patient.phone || 'N/A'}</div>
              </div>

              <div>
                <span style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>Emergency Contact</span>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                  {patient.emergencyContact?.name} ({patient.emergencyContact?.relation || 'Kin'}) • {patient.emergencyContact?.phone}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Verified Medical Records Summary */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Heart size={18} color="#ea580c" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Verified Chronic Conditions & Allergies</h3>
          </div>
          <div className="card-body">
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>Chronic Conditions</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {patient.conditions?.map((c) => (
                  <span key={c} className="tag" style={{ background: '#f1f5f9', color: '#0f172a', fontSize: 13, padding: '4px 10px' }}>
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <span style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>Drug & Environmental Allergies</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {patient.allergies?.map((a) => (
                  <span key={a} className="tag" style={{ background: '#fee2e2', color: '#991b1b', fontSize: 13, padding: '4px 10px' }}>
                    ⚠️ {a}
                  </span>
                ))}
                {(!patient.allergies || patient.allergies.length === 0) && (
                  <span style={{ color: '#94a3b8', fontSize: 13 }}>No known allergies</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Edit Permitted Contact Modal */}
        {isEditing && (
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
            <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Update Contact Details</h3>
                <button onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSave}>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-control"
                    value={formData.phone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Emergency Contact Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.emergencyContactName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, emergencyContactName: e.target.value }))}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 24 }}>
                  <label className="form-label">Emergency Contact Phone</label>
                  <input
                    type="tel"
                    className="form-control"
                    value={formData.emergencyContactPhone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, emergencyContactPhone: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
