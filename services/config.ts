
/**
 * Application Configuration
 * Optimized for a self-contained, high-performance live deployment.
 */

export const CONFIG = {
  // Versions and Metadata
  APP_VERSION: '2.6.0-stable',
  APP_NAME: 'ExaminePro',
  
  // Security Settings
  SESSION_TIMEOUT: 3600, // 1 hour
  
  // Feature Toggles
  ENABLE_PROCTORING: true,
  ENABLE_AI_GRADING: true,
  
  // Deployment Environment
  ENV: 'production',
  IS_DEMO_MODE: true,
  BACKEND_URL: ''
};
