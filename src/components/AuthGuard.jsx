import LoadingState from './LoadingState.jsx';

export default function AuthGuard({ loading, authenticated, allowed = true, loadingLabel, unauthenticatedFallback, deniedFallback, children }) {
  if (loading) return <LoadingState label={loadingLabel || 'Validando acesso...'} />;
  if (!authenticated) return unauthenticatedFallback;
  if (!allowed) return deniedFallback;
  return children;
}
