import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

/**
 * Route protection wrapper enforcing authentication and role authorization
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string[]} props.allowedRoles - array of permitted roles: 'health_worker', 'doctor', 'patient', 'admin'
 */
export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { isAuthenticated, isLoading, currentUser, role } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <LoadingSpinner size="lg" text="Verifying session..." />
      </div>
    );
  }

  // If user is not authenticated, redirect to login preserving attempted path
  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If roles are specified and user's role is not authorized
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    // Redirect to their own role's main dashboard
    let targetPath = '/';
    if (role === 'health_worker') targetPath = '/health-worker';
    else if (role === 'doctor') targetPath = '/doctor';
    else if (role === 'patient') targetPath = '/patient';
    else if (role === 'admin') targetPath = '/admin';

    return <Navigate to={targetPath} replace />;
  }

  return children;
}

