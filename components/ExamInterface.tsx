
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Exam, Submission, QuestionType, Question } from '../services/types';
import { logEvent, enforceSecureEnvironment } from '../services/securityService';
import { initializeProctoring, stopProctoring, ProctoringState } from '../services/proctoringService';

interface ExamInterfaceProps {
  exam: Exam;
  studentId: string;
  submissionId?: string;
  initialAnswers?: Record<string, string>;
  initialStartTime?: number;
  onSubmit: (submission: Partial<Submission>) => void;
  onCancel: () => void;
  isAdminPreview?: boolean;
}

import { api } from '../services/api'; // Ensure api import is present

const ExamInterface: React.FC<ExamInterfaceProps> = ({
  exam,
  studentId,
  submissionId,
  initialAnswers = {},
  initialStartTime,
  onSubmit,
  onCancel,
  isAdminPreview = false
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [proctorAlerts, setProctorAlerts] = useState<number>(0);
  const [proctorState, setProctorState] = useState<ProctoringState | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const randomizedExamData = useMemo(() => {
    if (!exam || !exam.questions || !Array.isArray(exam.questions)) {
      return { ...exam, questions: [] };
    }
    function shuffle<T>(array: T[]): T[] {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
    const questions = shuffle(exam.questions).map((q: Question) => ({
      ...q,
      options: q.options ? shuffle<string>(q.options) : undefined
    }));
    return { ...exam, questions };
  }, [exam]);

  const calculateInitialTime = () => {
    if (!exam) return 0;
    const now = Date.now();
    const start = initialStartTime || now;
    // Safe access to timerSettings
    const grace = (exam.timerSettings && exam.timerSettings.gracePeriodSeconds) || 0;
    const duration = (exam.durationMinutes || 0) * 60;

    // Simple duration based timer
    const expiry = start + (duration + grace) * 1000;
    return Math.max(0, Math.floor((expiry - now) / 1000));
  };

  const [timeLeft, setTimeLeft] = useState(calculateInitialTime());

  // Sync timeLeft if exam duration changes or initialStartTime updates
  useEffect(() => {
    if (isNaN(timeLeft)) setTimeLeft(calculateInitialTime());
  }, [timeLeft]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasAutoSubmitted = useRef(false);

  useEffect(() => {
    if (isAdminPreview) return;

    const handleBlur = () => {
      setProctorAlerts(prev => prev + 1);
      logEvent(null, 'FOCUS_LOST', 'User switched focus during exam.', 'CRITICAL');
    };

    window.addEventListener('blur', handleBlur);
    enforceSecureEnvironment(true);

    // Initialize Proctoring
    initializeProctoring().then(state => {
      setProctorState(state);
    });

    return () => {
      window.removeEventListener('blur', handleBlur);
      enforceSecureEnvironment(false);
      if (proctorState) stopProctoring(proctorState);
    };
  }, [isAdminPreview]);

  // Fix Camera Stream Attachment (Race Condition)
  useEffect(() => {
    if (videoRef.current && proctorState?.activeStream) {
      videoRef.current.srcObject = proctorState.activeStream;
    }
  }, [proctorState, videoRef.current]);

  // Polling for Duration Updates (Dynamic Time Extension)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        // Fetch exam details to check for duration updates
        // In a real app, this should be an optimized lightweight endpoint
        try {
          const updatedExam = await api.exams.get(exam.id);
          // If duration increased, add the difference to timeLeft
          if (updatedExam.durationMinutes > exam.durationMinutes) {
            const addedMinutes = updatedExam.durationMinutes - exam.durationMinutes;
            setTimeLeft(prev => prev + (addedMinutes * 60));
            // Update the local reference of durationMinutes for next poll comparison
            exam.durationMinutes = updatedExam.durationMinutes;
            // Note: Mutating prop is not ideal React, but effective for this local interval context without refetching parent
            // Ideally we'd use a ref or parent state, but this meets the "dynamic" requirement nicely.
          }
        } catch (err) {
          // Silent fail on poll
        }
      } catch (e) {
        // Silent fail on poll
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [exam.id, exam]);

  // Auto-Save Logic
  const answersRef = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);

  useEffect(() => {
    if (!submissionId || isAdminPreview) return;

    // Initial save (to ensure draft exists if empty) - optional, but maybe good.
    // Loop
    const interval = setInterval(() => {
      if (Object.keys(answersRef.current).length > 0) {
        api.submissions.saveDraft(submissionId, answersRef.current).catch(err => console.error("Auto-save failed", err));
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [submissionId, isAdminPreview]);

  const handleSubmit = useCallback(() => {
    if (isAdminPreview) {
      alert("This is a preview. Submission is disabled to prevent data contamination.");
      return;
    }
    if (isSubmitting) return;

    // Warning for unanswered questions (Skip if auto-submitting due to timeout)
    const isAutoSubmit = timeLeft <= 0;

    if (!isAutoSubmit) {
      const answeredCount = Object.keys(answers).length;
      const totalQuestions = exam.questions.length;
      if (answeredCount < totalQuestions) {
        const remaining = totalQuestions - answeredCount;
        if (!confirm(`You have ${remaining} unanswered questions. Are you sure you want to submit?`)) {
          return;
        }
      }
    }

    setIsSubmitting(true);
    onSubmit({
      examId: exam.id,
      studentId,
      answers,
      // Do not send submittedAt, let server keep the original start time
      id: submissionId // Pass ID if updating existing
    });
  }, [exam.id, studentId, answers, onSubmit, isSubmitting, exam.questions.length, timeLeft]);

  useEffect(() => {
    const autoSubmit = exam.timerSettings && exam.timerSettings.autoSubmitOnExpiry;
    if (timeLeft <= 0) {
      if (autoSubmit && !hasAutoSubmitted.current) {
        hasAutoSubmitted.current = true;
        handleSubmit();
      }
      return;
    }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, handleSubmit, exam.timerSettings]);

  if (!randomizedExamData.questions || randomizedExamData.questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-10 h-screen bg-slate-50 dark:bg-slate-900">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Exam Setup Error</h2>
        <p className="text-slate-500 mb-4">This exam has no questions configured.</p>
        <button onClick={onCancel} className="bg-indigo-600 text-white px-6 py-2 rounded theme-rounded">Return</button>
      </div>
    );
  }

  const currentQuestion = randomizedExamData.questions[currentIndex];
  // Safety check for index out of bounds (shouldn't happen with valid data but good for robustness)
  if (!currentQuestion) {
    return <div>Error loading question.</div>;
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Determine warning threshold (default 5 minutes if not set in exam)
  const warningThreshold = (exam.warningTimeThreshold ?? 5) * 60;
  const isStressState = timeLeft < warningThreshold;

  const NavigationControls = () => (
    <div className="flex justify-between items-center gap-6">
      <div className="flex gap-4">
        <button disabled={currentIndex === 0} onClick={() => setCurrentIndex(prev => prev - 1)} className="px-6 py-3 theme-rounded font-black uppercase text-xs tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-400 disabled:opacity-20 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Back</button>
        <button disabled={currentIndex === exam.questions.length - 1} onClick={() => setCurrentIndex(prev => prev + 1)} className="px-6 py-3 theme-rounded font-black uppercase text-xs tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-400 disabled:opacity-20 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Next</button>
      </div>
      <button
        disabled={isAdminPreview}
        onClick={() => {
          // Partial Submission Check
          const answeredCount = Object.keys(answers).length;
          const total = exam.questions.length;
          if (answeredCount < total) {
            if (confirm(`Warning: You have ${total - answeredCount} unanswered questions.\n\nAre you sure you want to submit?`)) {
              handleSubmit();
            }
          } else {
            if (confirm("Confirm Final Submission?")) handleSubmit();
          }
        }}
        className={`px-10 py-3 theme-rounded font-black uppercase tracking-[0.2em] shadow-lg transition-all text-xs ${isAdminPreview
          ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-50'
          : isStressState
            ? 'bg-red-600 text-white animate-bounce'
            : 'bg-slate-900 dark:bg-indigo-600 text-white'
          }`}
      >
        {isAdminPreview ? 'Preview Mode' : 'Submit'}
      </button>
    </div>
  );

  const QuestionPalette = () => (
    <div className="bg-white dark:bg-slate-900 p-6 theme-rounded shadow-xl border border-slate-200 dark:border-slate-800 h-fit sticky top-24">
      <h3 className="font-black uppercase text-xs tracking-widest text-slate-400 mb-4">Question Map</h3>
      <div className="grid grid-cols-5 gap-2">
        {exam.questions.map((_, idx) => {
          const isAnswered = answers[randomizedExamData.questions[idx].id];
          const isCurrent = idx === currentIndex;
          return (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${isCurrent
                ? 'bg-indigo-600 text-white shadow-lg scale-110 ring-2 ring-indigo-300'
                : isAnswered
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200'
                }`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
      <div className="mt-6 space-y-2 text-[10px] font-bold uppercase text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-indigo-600"></div> Current
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900/30"></div> Answered
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-800"></div> Unseen
        </div>
      </div>
    </div>
  );

  return (
    <div className={`w-full min-h-screen flex flex-col transition-all duration-700 bg-slate-50 dark:bg-slate-950`}>
      {!isAdminPreview && proctorState?.hasCamera && (
        <div className={`fixed bottom-8 left-8 z-[100] w-32 h-24 bg-black theme-rounded border-4 overflow-hidden shadow-2xl transition-all ${isStressState ? 'border-red-500 scale-110' : 'border-indigo-600'}`}>
          <video ref={videoRef} autoPlay muted className="w-full h-full object-cover grayscale opacity-50" />
          <div className="absolute top-1 left-1 flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse bg-red-600`}></span>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <header className="bg-white dark:bg-slate-900 shadow-sm border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {isAdminPreview && (
              <button
                onClick={onCancel}
                className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold uppercase text-xs transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Exit Preview
              </button>
            )}
            <h1 className="font-black uppercase tracking-tight text-lg truncate max-w-md">{exam.title}</h1>
          </div>
          <div className={`hidden lg:block px-6 py-2 theme-rounded font-mono font-black text-xl transition-colors ${isStressState ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-800'}`}>
            {formatTime(timeLeft)}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto w-full p-6 flex gap-8 items-start">
        {/* Desktop Palette */}
        <div className="hidden lg:block w-64 shrink-0">
          <QuestionPalette />
        </div>

        <div className="flex-grow flex flex-col">
          {/* Mobile Palette Toggle / Status Bar */}
          <div className="lg:hidden mb-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black uppercase text-slate-400">Q {currentIndex + 1} of {exam.questions.length}</span>
              <div className={`px-3 py-1 theme-rounded font-mono font-black text-sm ${isStressState ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-800'}`}>
                {formatTime(timeLeft)}
              </div>
            </div>

            {/* Mobile Scrollable Palette */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x">
              {exam.questions.map((_, idx) => {
                const isAnswered = answers[randomizedExamData.questions[idx].id];
                const isCurrent = idx === currentIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`min-w-[40px] h-10 theme-rounded text-xs font-bold shrink-0 snap-center transition-all border-2 ${isCurrent
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                      : isAnswered
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900'
                        : 'bg-white border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'
                      }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`bg-white dark:bg-slate-900 theme-rounded shadow-2xl overflow-hidden border-4 transition-all duration-700 ${isStressState ? 'border-red-500' : 'border-transparent'}`}>

            {/* Top Navigation */}
            <div className="px-8 py-4 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Question {currentIndex + 1}</span>
              <NavigationControls />
            </div>

            <div className="p-8 md:p-12 space-y-8 min-h-[400px]">
              <h3 className="font-black uppercase tracking-tight leading-snug text-2xl md:text-3xl text-slate-800 dark:text-white">
                {currentQuestion.text}
              </h3>

              {currentQuestion.imageUrl && (
                <div className="flex justify-center my-6">
                  <img src={currentQuestion.imageUrl} className="max-w-full max-h-96 theme-rounded shadow-lg border-4 border-slate-100" alt="Question Resource" />
                </div>
              )}

              <div className="space-y-3">
                {currentQuestion.type === QuestionType.THEORY ? (
                  <textarea
                    className="w-full h-64 p-6 theme-rounded outline-none font-bold border-2 border-slate-200 dark:bg-slate-950 dark:border-slate-800 focus:border-indigo-500 transition-all text-lg"
                    placeholder="Type your answer..."
                    value={answers[currentQuestion.id] || ''}
                    onChange={e => setAnswers({ ...answers, [currentQuestion.id]: e.target.value })}
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {currentQuestion.options?.map((opt, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      const isSelected = answers[currentQuestion.id] === opt;
                      return (
                        <button
                          key={idx}
                          onClick={() => setAnswers({ ...answers, [currentQuestion.id]: opt })}
                          className={`w-full flex items-center gap-4 p-4 theme-rounded border-2 transition-all text-left ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-indigo-200'
                            }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${isSelected ? 'bg-white text-indigo-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                            {letter}
                          </div>
                          <span className="font-bold text-base">{opt}</span>
                        </button>
                      );
                    })
                    }
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Navigation - Sticky on Mobile */}
            <div className="px-8 py-6 border-t bg-slate-50 dark:bg-slate-950/50 hidden md:block">
              <NavigationControls />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Footer */}
      <div className="md:hidden fixed bottom-6 left-4 right-4 z-[60] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 theme-rounded shadow-2xl flex justify-between items-center gap-4 animate-in slide-in-from-bottom-4">
        <button disabled={currentIndex === 0} onClick={() => setCurrentIndex(prev => prev - 1)} className="p-3 theme-rounded bg-slate-100 dark:bg-slate-800 text-slate-500 disabled:opacity-30">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>

        <button
          disabled={isAdminPreview}
          onClick={() => {
            const answered = Object.keys(answers).length;
            const total = exam.questions.length;
            if (answered < total) {
              if (confirm(`${total - answered} unanswered questions. Submit?`)) handleSubmit();
            } else {
              if (confirm("Submit Exam?")) handleSubmit();
            }
          }}
          className={`flex-1 py-3 theme-rounded font-black uppercase text-sm shadow-lg ${isStressState ? 'bg-red-600 animate-pulse text-white' : 'bg-slate-900 dark:bg-indigo-600 text-white'}`}
        >
          {isAdminPreview ? 'Preview' : 'Submit'}
        </button>

        <button disabled={currentIndex === exam.questions.length - 1} onClick={() => setCurrentIndex(prev => prev + 1)} className="p-3 theme-rounded bg-slate-100 dark:bg-slate-800 text-slate-500 disabled:opacity-30">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div >
  );
};

export default ExamInterface;
