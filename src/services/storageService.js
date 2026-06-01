export const localStoragePrefix = 'casa-do-ype';

export function isProductionBuild() {
  return Boolean(import.meta.env.PROD);
}

export function canUseDemoFallback(hasSupabaseConfig) {
  return !hasSupabaseConfig && !isProductionBuild();
}

export function readLocalData(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(`${localStoragePrefix}:${key}`);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocalData(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${localStoragePrefix}:${key}`, JSON.stringify(value));
  } catch {
    // localStorage can be unavailable in private modes; never break the app for it.
  }
}

export function getInitialThemeMode() {
  const saved = readLocalData('themeMode', '');
  if (saved === 'light' || saved === 'dark') return saved;
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}
