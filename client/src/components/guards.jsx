import { Spinner, EmptyState } from './ui';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, HOME_BY_ROLE } from '../context/AuthContext';

/** Blocks unauthenticated access and redirects to the role dashboard when logged in. */
export function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="center-screen">
        <Spinner />
        <p className="muted text-sm">Checking your session…</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={HOME_BY_ROLE[user.role] || '/'} replace />;

  return children;
}

/** Keeps already-logged-in users away from /login and /register. */
export function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="center-screen">
        <Spinner />
      </div>
    );
  }
  if (user) return <Navigate to={HOME_BY_ROLE[user.role] || '/'} replace />;
  return children;
}

export { EmptyState };
