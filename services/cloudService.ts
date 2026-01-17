import { STORAGE_KEYS } from '../constants';
import { logEvent, checkRateLimit } from './securityService';

// Simulated Cloud Endpoint Logic
export const syncToCloud = async (dataType: string, data: any): Promise<boolean> => {
  await new Promise(resolve => setTimeout(resolve, 800));
  
  try {
    if (!data) throw new Error("Payload verification failed.");
    
    const cloudKey = `cloud_${dataType}`;
    localStorage.setItem(cloudKey, JSON.stringify({
      data,
      timestamp: Date.now(),
      checksum: btoa(JSON.stringify(data)).slice(0, 16)
    }));
    
    return true;
  } catch (error) {
    console.error(`Cloud Sync Failed for ${dataType}:`, error);
    return false;
  }
};

// API Gateway Emulation
export const apiGateway = {
  // Simulate POST /api/v1/submissions
  ingestExternalSubmission: async (apiKey: string, payload: any) => {
    // 1. Rate Limiting Check (Security Hardening)
    if (!checkRateLimit(`api_gateway_${apiKey}`, 100, 3600000)) { // 100 req/hr per key
      logEvent(null, 'API_THROTTLED', `Rate limit reached for API key: ${apiKey.slice(0, 8)}...`, 'WARN');
      throw new Error("429 Too Many Requests: API quota exceeded.");
    }

    // 2. Verify API Key
    // FIX: Use STORAGE_KEYS constant instead of a hardcoded string for better maintainability.
    const keys = JSON.parse(localStorage.getItem(STORAGE_KEYS.API_KEYS) || '[]');
    const validKey = keys.find((k: any) => k.key === apiKey);
    
    if (!validKey || validKey.status === 'REVOKED') {
      logEvent(null, 'API_AUTH_FAILURE', `Invalid/Revoked key used: ${apiKey.slice(0, 8)}...`, 'CRITICAL');
      throw new Error("401 Unauthorized: Invalid API Token");
    }
    
    // 3. Validate Scopes
    if (!validKey.scopes.includes('WRITE_SUBMISSIONS')) {
      throw new Error("403 Forbidden: Insufficient Scope");
    }
    
    // 4. Process Payload
    const submissions = JSON.parse(localStorage.getItem(STORAGE_KEYS.SUBMISSIONS) || '[]');
    const newSub = { 
      ...payload, 
      id: `ext_${Date.now()}`, 
      submittedAt: Date.now(),
      source: 'External API Gateway',
      ingestedVia: validKey.label
    };
    
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify([newSub, ...submissions]));
    
    logEvent(null, 'API_INGEST', `External submission received via key: ${validKey.label}`, 'INFO');
    
    return { status: 'success', submissionId: newSub.id };
  }
};