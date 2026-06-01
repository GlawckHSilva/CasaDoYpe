export function normalizeRouteRole(role) {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'admin') return 'proprietario';
  if (normalized === 'client') return 'hospede';
  return normalized;
}

export function roleHomePath(role) {
  const normalizedRole = normalizeRouteRole(role);
  if (normalizedRole === 'super_admin') return '/super-admin';
  if (normalizedRole === 'proprietario') return '/admin';
  if (normalizedRole === 'hospede') return '/hospede';
  return '/';
}

export function canAccessRoute(path, profile) {
  if (!['/super-admin', '/admin', '/hospede'].includes(path)) return true;
  const role = normalizeRouteRole(profile?.role);
  if (!profile) return false;
  if (path === '/super-admin') return role === 'super_admin';
  if (path === '/admin') return role === 'proprietario' || role === 'super_admin';
  if (path === '/hospede') return role === 'hospede';
  return true;
}
