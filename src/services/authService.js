import { roleHomePath, normalizeRouteRole } from '../routes/authRoutes.js';

export { roleHomePath, normalizeRouteRole };

export function isOwnerRole(role) {
  const normalized = normalizeRouteRole(role);
  return normalized === 'proprietario' || normalized === 'super_admin';
}
