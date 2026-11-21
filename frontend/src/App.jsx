import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LoadingSpinner from './components/LoadingSpinner'

const Home = lazy(() => import('./pages/Home'))
const PatientDashboard = lazy(() => import('./pages/patient/PatientDashboard'))
const PatientProfile = lazy(() => import('./pages/patient/PatientProfile'))
const PatientConsultations = lazy(() => import('./pages/patient/PatientConsultations'))
const MedicalRecords = lazy(() => import('./pages/patient/MedicalRecords'))
const DoctorAdvice = lazy(() => import('./pages/patient/DoctorAdvice'))
const PatientNotifications = lazy(() => import('./pages/patient/Notifications'))

const HealthWorkerDashboard = lazy(() => import('./pages/healthWorker/HealthWorkerDashboard'))
const RegisterPatient = lazy(() => import('./pages/healthWorker/RegisterPatient'))
const PatientRecordsHW = lazy(() => import('./pages/healthWorker/PatientRecords'))
const NewConsultation = lazy(() => import('./pages/healthWorker/NewConsultation'))
const ConsultationHistory = lazy(() => import('./pages/healthWorker/ConsultationHistory'))
const PendingUploads = lazy(() => import('./pages/healthWorker/PendingUploads'))
const DoctorResponses = lazy(() => import('./pages/healthWorker/DoctorResponses'))
const NetworkMonitor = lazy(() => import('./pages/healthWorker/NetworkMonitor'))

const DoctorDashboard = lazy(() => import('./pages/doctor/DoctorDashboard'))
const IncomingConsultations = lazy(() => import('./pages/doctor/IncomingConsultations'))
const ConsultationDetails = lazy(() => import('./pages/doctor/ConsultationDetails'))
const ReviewedCases = lazy(() => import('./pages/doctor/ReviewedCases'))
const DoctorPatientRecords = lazy(() => import('./pages/doctor/PatientRecords'))
const ResponseForm = lazy(() => import('./pages/doctor/ResponseForm'))
const DoctorNotifications = lazy(() => import('./pages/doctor/DoctorNotifications'))

export default function App() {
  return (
    <Suspense fallback={<div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh'}}><LoadingSpinner size="lg" text="Loading CareWave..." /></div>}>
      <Routes>
        <Route path="/" element={<Home />} />
        
        {/* Patient Routes */}
        <Route path="/patient" element={<PatientDashboard />} />
        <Route path="/patient/profile" element={<PatientProfile />} />
        <Route path="/patient/consultations" element={<PatientConsultations />} />
        <Route path="/patient/records" element={<MedicalRecords />} />
        <Route path="/patient/advice" element={<DoctorAdvice />} />
        <Route path="/patient/notifications" element={<PatientNotifications />} />

        {/* Health Worker Routes */}
        <Route path="/health-worker" element={<HealthWorkerDashboard />} />
        <Route path="/health-worker/register-patient" element={<RegisterPatient />} />
        <Route path="/health-worker/patients" element={<PatientRecordsHW />} />
        <Route path="/health-worker/new-consultation" element={<NewConsultation />} />
        <Route path="/health-worker/consultations" element={<ConsultationHistory />} />
        <Route path="/health-worker/pending-uploads" element={<PendingUploads />} />
        <Route path="/health-worker/responses" element={<DoctorResponses />} />
        <Route path="/health-worker/network" element={<NetworkMonitor />} />

        {/* Doctor Routes */}
        <Route path="/doctor" element={<DoctorDashboard />} />
        <Route path="/doctor/incoming" element={<IncomingConsultations />} />
        <Route path="/doctor/consultation/:id" element={<ConsultationDetails />} />
        <Route path="/doctor/reviewed" element={<ReviewedCases />} />
        <Route path="/doctor/patients" element={<DoctorPatientRecords />} />
        <Route path="/doctor/response/:id" element={<ResponseForm />} />
        <Route path="/doctor/notifications" element={<DoctorNotifications />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
