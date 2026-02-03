
import { AuditLog, User } from './types';
import { v4 as uuidv4 } from 'uuid';
import DOMPurify from 'dompurify';

// This is a client-side file. For a real app, logging and rate limiting should be server-side.
const RATE_LIMITS: Record<string, { attempts: number, lastAttempt: number }> = {};

export const checkRateLimit = (key: string, limit: number, windowMs: number): boolean => {
  const now = Date.now();
  const record = RATE_LIMITS[key] || { attempts: 0, lastAttempt: 0 };

  if (now - record.lastAttempt > windowMs) {
    record.attempts = 1;
    record.lastAttempt = now;
    RATE_LIMITS[key] = record;
    return true;
  }

  if (record.attempts < limit) {
    record.attempts++;
    record.lastAttempt = now;
    RATE_LIMITS[key] = record;
    return true;
  }

  return false;
};

export const enforceSecureEnvironment = (active: boolean) => {
  const prevent = (e: Event) => {
    if (active) {
      e.preventDefault();
      return false;
    }
  };

  if (active) {
    document.addEventListener('contextmenu', prevent);
    document.addEventListener('copy', prevent);
    document.addEventListener('paste', prevent);
    document.addEventListener('cut', prevent);
    document.addEventListener('keydown', (e) => {
      if (active && (
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'C' || e.key === 'J')) ||
        (e.ctrlKey && e.key === 'u') ||
        (e.key === 'PrintScreen')
      )) {
        e.preventDefault();
      }
    });
  } else {
    document.removeEventListener('contextmenu', prevent);
    document.removeEventListener('copy', prevent);
    document.removeEventListener('paste', prevent);
    document.removeEventListener('cut', prevent);
  }
};

export const initializeCspMonitoring = () => {
  document.addEventListener('securitypolicyviolation', (e: SecurityPolicyViolationEvent) => {
    logEvent(
      null,
      'CSP_VIOLATION',
      `Blocked: ${e.blockedURI} | Directive: ${e.violatedDirective}`,
      'CRITICAL'
    );
  });
};

export const sanitize = (input: string): string => {
  if (typeof input !== 'string') return '';
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    RETURN_TRUSTED_TYPE: false
  }).trim();
};

export const validateEmail = (email: string): boolean => {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
};

export const validatePasswordStrength = (password: string): boolean => {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password);
};

// This logEvent sends logs to the server
export const logEvent = (user: User | null, action: string, details: string, severity: AuditLog['severity'] = 'INFO') => {
  console.log(`[AUDIT:${severity}] ${action}: ${details}`);

  // Fire and forget - don't await to avoid blocking UI
  fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, details, severity })
  }).catch(e => console.error("Failed to push log", e));
};

export const generateApiKey = (): string => {
  return 'sk-' + uuidv4().replace(/-/g, '').slice(0, 24);
};

export const generateSecureToken = (): string => {
  return uuidv4().replace(/-/g, '');
};
