
// FIX: Export STORAGE_KEYS to be used across the application for local storage access.
export const STORAGE_KEYS = {
  API_KEYS: 'examine_pro_api_keys',
  SYSTEM_SETTINGS: 'examine_pro_system_settings',
  BRANDING: 'examine_pro_branding',
  SUBMISSIONS: 'examine_pro_submissions'
};

export const HIPAA_CONFIG = {
  SESSION_TIMEOUT_MS: 15 * 60 * 1000, // 15 minutes
  ENCRYPTION_ENABLED: true,
  AUDIT_RETAIN_DAYS: 365
};