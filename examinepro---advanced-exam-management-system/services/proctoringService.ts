
import { logEvent } from './securityService';

export interface ProctoringState {
  hasCamera: boolean;
  hasMic: boolean;
  activeStream: MediaStream | null;
}

export const initializeProctoring = async (): Promise<ProctoringState> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: 320, height: 240, frameRate: 15 }, 
      audio: true 
    });
    return { hasCamera: true, hasMic: true, activeStream: stream };
  } catch (error) {
    console.warn("Hardware Access Denied:", error);
    return { hasCamera: false, hasMic: false, activeStream: null };
  }
};

export const stopProctoring = (state: ProctoringState) => {
  state.activeStream?.getTracks().forEach(track => track.stop());
};

export const detectAnomalies = (videoElement: HTMLVideoElement) => {
  // Mock AI behavior for facial presence detection
  // In a real implementation, this would use a WebAssembly model (e.g., MediaPipe)
  const isCandidatePresent = true; 
  if (!isCandidatePresent) {
    logEvent(null, 'PROCTOR_ANOMALY', 'Candidate presence lost in terminal field.', 'WARN');
  }
};
