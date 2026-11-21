import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoadingSpinner from './components/LoadingSpinner';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));

// Patient pages
const PatientDashboard = lazy(() => import('./pages/patient/PatientDashboard'));
const PatientProfile = lazy(() => import('./pages/patient/PatientProfile'));
const PatientConsultations = lazy(() => import('./pages/patient/PatientConsultations'));
const MedicalRecords = lazy(() => import('./pages/patient/MedicalRecords'));
const DoctorAdvice = lazy(() => import('./pages/patient/DoctorAdvice'));
const PatientNotifications = lazy(() => import('./pages/patient/Notifications'));

// Health Worker pages
const HealthWorkerDashboard = lazy(() => import('./pages/healthWorker/HealthWorkerDashboard'));
const RegisterPatient = lazy(() => import('./pages/healthWorker/RegisterPatient'));
const PatientRecordsHW = lazy(() => import('./pages/healthWorker/PatientRecords'));
const NewConsultation = lazy(() => import('./pages/healthWorker/NewConsultation'));
const ConsultationHistory = lazy(() => import('./pages/healthWorker/ConsultationHistory'));
const PendingUploads = lazy(() => import('./pages/healthWorker/PendingUploads'));
const DoctorResponses = lazy(() => import('./pages/healthWorker/DoctorResponses'));
const NetworkMonitor = lazy(() => import('./pages/healthWorker/NetworkMonitor'));

// Doctor pages
const DoctorDashboard = lazy(() => import('./pages/doctor/DoctorDashboard'));
const IncomingConsultations = lazy(() => import('./pages/doctor/IncomingConsultations'));
const ConsultationDetails = lazy(() => import('./pages/doctor/ConsultationDetails'));
const ReviewedCases = lazy(() => import('./pages/doctor/ReviewedCases'));
const DoctorPatientRecords = lazy(() => import('./pages/doctor/PatientRecords'));
const ResponseForm = lazy(() => import('./pages/doctor/ResponseForm'));
const DoctorNotifications = lazy(() => import('./pages/doctor/DoctorNotifications'));

// Validation & System Testing Dashboard
const CareBridgeTestingDashboard = lazy(() => import('./pages/testing/CareBridgeTestingDashboard'));

export default function App() {
  return (
    <AuthProvider>
      <Suspense
        fallback={
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <LoadingSpinner size="lg" text="Loading CareWave..." />
          </div>
        }
      >
        <ErrorBoundary>
          <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Patient Routes */}
          <Route
            path="/patient"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <PatientDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/profile"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <PatientProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/consultations"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <PatientConsultations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/records"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <MedicalRecords />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/advice"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <DoctorAdvice />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/notifications"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <PatientNotifications />
              </ProtectedRoute>
            }
          />

          {/* Health Worker Routes */}
          <Route
            path="/health-worker"
            element={
              <ProtectedRoute allowedRoles={['health_worker']}>
                <HealthWorkerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/health-worker/register-patient"
            element={
              <ProtectedRoute allowedRoles={['health_worker']}>
                <RegisterPatient />
              </ProtectedRoute>
            }
          />
          <Route
            path="/health-worker/patients"
            element={
              <ProtectedRoute allowedRoles={['health_worker']}>
                <PatientRecordsHW />
              </ProtectedRoute>
            }
          />
          <Route
            path="/health-worker/new-consultation"
            element={
              <ProtectedRoute allowedRoles={['health_worker']}>
                <NewConsultation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/health-worker/consultations"
            element={
              <ProtectedRoute allowedRoles={['health_worker']}>
                <ConsultationHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/health-worker/pending-uploads"
            element={
              <ProtectedRoute allowedRoles={['health_worker']}>
                <PendingUploads />
              </ProtectedRoute>
            }
          />
          <Route
            path="/health-worker/responses"
            element={
              <ProtectedRoute allowedRoles={['health_worker']}>
                <DoctorResponses />
              </ProtectedRoute>
            }
          />
          <Route
            path="/health-worker/network"
            element={
              <ProtectedRoute allowedRoles={['health_worker']}>
                <NetworkMonitor />
              </ProtectedRoute>
            }
          />

          {/* Doctor Routes */}
          <Route
            path="/doctor"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/incoming"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <IncomingConsultations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/consultation/:id"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <ConsultationDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/reviewed"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <ReviewedCases />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/patients"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorPatientRecords />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/response/:id"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <ResponseForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/notifications"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorNotifications />
              </ProtectedRoute>
            }
          />

          {/* Dedicated CareBridge System Testing & Validation Route */}
          <Route
            path="/system-test"
            element={
              <ProtectedRoute allowedRoles={['admin', 'health_worker', 'doctor']}>
                <CareBridgeTestingDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ErrorBoundary>
      </Suspense>
    </AuthProvider>
  );
}
