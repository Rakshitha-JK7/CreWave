import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, User, Phone, MapPin, AlertCircle, CheckCircle, ArrowLeft, Heart, Shield } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useApp } from '../../context/AppContext';
import patientService from '../../services/patientService';
import { validateRequired, validatePhone, validateAge } from '../../utils/validation';

export default function RegisterPatient() {
  const navigate = useNavigate();
  const { addNotification } = useApp();

  const [formData, setFormData] = useState({
    name: '',
    age: '',
    sex: 'Male',
    phone: '',
    village: '',
    district: 'Sitapur',
    state: 'Uttar Pradesh',
    address: '',
    bloodGroup: 'Unknown',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
    conditions: [],
    allergies: [],
    notes: '',
  });

  const [conditionInput, setConditionInput] = useState('');
  const [allergyInput, setAllergyInput] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredPatient, setRegisteredPatient] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const addTag = (type) => {
    if (type === 'condition' && conditionInput.trim()) {
      if (!formData.conditions.includes(conditionInput.trim())) {
        setFormData((prev) => ({ ...prev, conditions: [...prev.conditions, conditionInput.trim()] }));
      }
      setConditionInput('');
    } else if (type === 'allergy' && allergyInput.trim()) {
      if (!formData.allergies.includes(allergyInput.trim())) {
        setFormData((prev) => ({ ...prev, allergies: [...prev.allergies, allergyInput.trim()] }));
      }
      setAllergyInput('');
    }
  };

  const removeTag = (type, item) => {
    if (type === 'condition') {
      setFormData((prev) => ({ ...prev, conditions: prev.conditions.filter((c) => c !== item) }));
    } else {
      setFormData((prev) => ({ ...prev, allergies: prev.allergies.filter((a) => a !== item) }));
    }
  };

  const validate = () => {
    const newErrors = {};
    const nameErr = validateRequired(formData.name, 'Full name');
    if (nameErr) newErrors.name = nameErr;

    const ageErr = validateAge(formData.age);
    if (ageErr) newErrors.age = ageErr;

    const villageErr = validateRequired(formData.village, 'Village');
    if (villageErr) newErrors.village = villageErr;

    if (formData.phone) {
      const phoneErr = validatePhone(formData.phone);
      if (phoneErr) newErrors.phone = phoneErr;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const patientId = `PAT${Date.now().toString().slice(-4)}`;
      const payload = {
        ...formData,
        id: patientId,
        age: parseInt(formData.age, 10),
        emergencyContact: {
          name: formData.emergencyContactName,
          phone: formData.emergencyContactPhone,
          relation: formData.emergencyContactRelation,
        },
      };

      const result = await patientService.createPatient(payload);
      if (result.success) {
        setRegisteredPatient(result.data);
        addNotification(`Patient ${result.data.name} (${result.data.id}) registered successfully!`, 'success');
      } else {
        addNotification(result.error || 'Failed to register patient', 'error');
      }
    } catch (err) {
      addNotification('An unexpected error occurred', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      name: '',
      age: '',
      sex: 'Male',
      phone: '',
      village: '',
      district: 'Sitapur',
      state: 'Uttar Pradesh',
      address: '',
      bloodGroup: 'Unknown',
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelation: '',
      conditions: [],
      allergies: [],
      notes: '',
    });
    setErrors({});
    setRegisteredPatient(null);
  };

  if (registeredPatient) {
    return (
      <DashboardLayout role="healthWorker">
        <div style={{ maxWidth: 640, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle size={36} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Patient Registered Successfully!</h2>
          <p style={{ color: '#64748b', fontSize: 15, marginBottom: 24 }}>
            Patient record has been saved locally and queued for hospital server synchronization.
          </p>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, textAlign: 'left', marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: '#64748b', fontSize: 14 }}>Patient ID:</span>
              <span style={{ fontWeight: 700, color: '#0284c7', fontSize: 16 }}>{registeredPatient.id}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: '#64748b', fontSize: 14 }}>Name:</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{registeredPatient.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: '#64748b', fontSize: 14 }}>Age / Sex:</span>
              <span style={{ color: '#0f172a' }}>{registeredPatient.age} yrs / {registeredPatient.sex}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b', fontSize: 14 }}>Village:</span>
              <span style={{ color: '#0f172a' }}>{registeredPatient.village}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/health-worker/new-consultation', { state: { patientId: registeredPatient.id } })}
            >
              Start New Consultation
            </button>
            <button className="btn btn-secondary" onClick={handleReset}>
              Register Another Patient
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/health-worker/patients')}>
              View Patient Records
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="healthWorker">
      <div style={{ maxWidth: 880, margin: '0 auto', paddingBottom: 40 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <button
              onClick={() => navigate(-1)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#64748b', fontSize: 14, cursor: 'pointer', marginBottom: 8 }}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Register New Patient</h1>
            <p style={{ color: '#64748b', fontSize: 14 }}>Collect rural patient demographic and baseline health information</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Section 1: Demographics */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <User size={20} color="#0284c7" />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: 0 }}>Basic Demographics</h3>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label required">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    className="form-control"
                    placeholder="e.g. Ramesh Chandra"
                    value={formData.name}
                    onChange={handleInputChange}
                  />
                  {errors.name && <div className="form-error">{errors.name}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label required">Age (years)</label>
                  <input
                    type="number"
                    name="age"
                    min="1"
                    max="120"
                    className="form-control"
                    placeholder="e.g. 42"
                    value={formData.age}
                    onChange={handleInputChange}
                  />
                  {errors.age && <div className="form-error">{errors.age}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label required">Sex</label>
                  <select name="sex" className="form-control" value={formData.sex} onChange={handleInputChange}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    className="form-control"
                    placeholder="e.g. 9876543210"
                    value={formData.phone}
                    onChange={handleInputChange}
                  />
                  {errors.phone && <div className="form-error">{errors.phone}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label">Blood Group</label>
                  <select name="bloodGroup" className="form-control" value={formData.bloodGroup} onChange={handleInputChange}>
                    <option value="Unknown">Unknown / Not Tested</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Residential Location */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MapPin size={20} color="#0d9488" />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: 0 }}>Location & Address</h3>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label required">Village / Settlement</label>
                  <input
                    type="text"
                    name="village"
                    className="form-control"
                    placeholder="e.g. Rampur"
                    value={formData.village}
                    onChange={handleInputChange}
                  />
                  {errors.village && <div className="form-error">{errors.village}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label">District</label>
                  <input
                    type="text"
                    name="district"
                    className="form-control"
                    value={formData.district}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">State</label>
                  <input
                    type="text"
                    name="state"
                    className="form-control"
                    value={formData.state}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Detailed Address / Landmarks</label>
                <textarea
                  name="address"
                  rows={2}
                  className="form-control"
                  placeholder="Near Primary School, House #4"
                  value={formData.address}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Baseline Clinical History */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Heart size={20} color="#ea580c" />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: 0 }}>Baseline Medical History</h3>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Known Chronic Conditions</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Hypertension, Diabetes, Asthma"
                    value={conditionInput}
                    onChange={(e) => setConditionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag('condition');
                      }
                    }}
                  />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => addTag('condition')}>
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {formData.conditions.map((item) => (
                    <span key={item} className="tag tag-removable">
                      {item}
                      <button type="button" onClick={() => removeTag('condition', item)}>×</button>
                    </span>
                  ))}
                  {formData.conditions.length === 0 && (
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>No chronic conditions recorded</span>
                  )}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Known Drug & Environmental Allergies</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Penicillin, Sulfa drugs"
                    value={allergyInput}
                    onChange={(e) => setAllergyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag('allergy');
                      }
                    }}
                  />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => addTag('allergy')}>
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {formData.allergies.map((item) => (
                    <span key={item} className="tag tag-removable" style={{ background: '#fee2e2', color: '#991b1b' }}>
                      {item}
                      <button type="button" onClick={() => removeTag('allergy', item)}>×</button>
                    </span>
                  ))}
                  {formData.allergies.length === 0 && (
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>No known allergies</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
            <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleReset}>
              Clear Form
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Patient Record'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
