import { Navigate, Outlet } from 'react-router-dom';
import type { RemoteSessionAccount } from '../lib/sessionClient';

interface RequireSessionProps {
  session: RemoteSessionAccount | null;
  isLoading: boolean;
}

export function RequireSession({ session, isLoading }: RequireSessionProps) {
  if (isLoading) {
    return <section style={{ padding: 'var(--space-2xl)' }}>Loading remote workspace...</section>;
  }

  if (!session) {
    return <Navigate to="/sign-in" replace />;
  }

  return <Outlet />;
}
