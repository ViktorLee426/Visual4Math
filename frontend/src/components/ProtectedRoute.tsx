// frontend/src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { sessionManager } from '../utils/sessionManager';

interface ProtectedRouteProps {
  children: React.ReactElement;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  // Check if user is authenticated (has valid session)
  const sessionId = sessionStorage.getItem('tracking_session_id');
  const session = sessionManager.getParticipantData();
  const isAuthenticated = !!(sessionId && session);

  if (!isAuthenticated) {
    // Redirect to welcome page if not authenticated
    return <Navigate to="/" replace />;
  }

  return children;
}

