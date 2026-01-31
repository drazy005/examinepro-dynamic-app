
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Exam, Submission, QuestionType, Question } from '../services/types';
import { logEvent, enforceSecureEnvironment } from '../services/securityService';
import { initializeProctoring, stopProctoring, ProctoringState } from '../services/proctoringService';

interface ExamInterfaceProps {
  exam: Exam;
  studentId: string;
  onSubmit: (submission: Partial<Submission>) => void;
  onCancel: () => void;
  isAdminPreview?: boolean;
}

const ExamInterface: React.FC<ExamInterfaceProps> = ({
  exam,
  studentId,
  onSubmit,
  onCancel,
  isAdminPreview = false
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [proctorAlerts, setProctorAlerts] = useState<number>(0);
  const [proctorState, setProctorState] = useState<ProctoringState | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const randomizedExamData = useMemo(() => {
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
    const now = Date.now();
    // Simple duration based timer
    const expiry = now + (exam.durationMinutes * 60 + (exam.timerSettings.gracePeriodSeconds || 0)) * 1000;
    return Math.max(0, Math.floor((expiry - now) / 1000));
  };

  const [timeLeft, setTimeLeft] = useState(calculateInitialTime());
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

    initializeProctoring().then(state => {
      setProctorState(state);
      if (videoRef.current && state.activeStream) {
        videoRef.current.srcObject = state.activeStream;
      }
    });

    return () => {
      window.removeEventListener('blur', handleBlur);
      enforceSecureEnvironment(false);
      if (proctorState) stopProctoring(proctorState);
    };
  }, [isAdminPreview]);

  const handleSubmit = useCallback(() => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    onSubmit({
      examId: exam.id,
      studentId,
      answers,
      submittedAt: Date.now(),
    });
  }, [exam.id, studentId, answers, onSubmit, isSubmitting]);

  useEffect(() => {
    if (timeLeft <= 0) {
      if (exam.timerSettings.autoSubmitOnExpiry && !hasAutoSubmitted.current) {
        hasAutoSubmitted.current = true;
        handleSubmit();
      }
      return;
    }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, handleSubmit, exam.timerSettings.autoSubmitOnExpiry]);

  const currentQuestion = randomizedExamData.questions[currentIndex];
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Determine warning threshold (default 5 minutes if not set in exam)
  const warningThreshold = (exam.warningTimeThreshold ?? 5) * 60;
  const isStressState = timeLeft < warningThreshold;
  // Heartbeat Effect: Visual pulse implemented via CSS classes in render below

  return (
    <div className={`w-full min-h-screen flex flex-col justify-center transition-all duration-700 bg-slate-50 dark:bg-slate-950`}>
      {!isAdminPreview && proctorState?.hasCamera && (
        <div className={`fixed top-8 left-8 z-[100] w-48 h-36 bg-black theme-rounded border-4 overflow-hidden shadow-2xl transition-all ${isStressState ? 'border-red-500 scale-110' : 'border-indigo-600'}`}>
          <video ref={videoRef} autoPlay muted className="w-full h-full object-cover grayscale opacity-50" />
          <div className="absolute top-2 left-2 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full animate-pulse bg-red-600`}></span>
            <span className="text-[8px] font-black uppercase text-white tracking-widest">Active Proctoring</span>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-5xl w-full flex flex-col justify-center p-4">
        <div className="flex justify-between items-center mb-6 px-6">
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full ${isStressState ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {isStressState ? 'HURRY - TIME IS LOW' : 'Secure Connection Established'}
            </span>
          </div>
          {proctorAlerts > 0 && (
            <div className="bg-red-600 text-white px-4 py-1.5 theme-rounded text-[10px] font-black uppercase tracking-widest shadow-xl animate-bounce">
              Focus Alerts: {proctorAlerts}
            </div>
          )}
        </div>

        <div className={`bg-white dark:bg-slate-900 theme-rounded shadow-3xl overflow-hidden border-8 transition-all duration-700 ${isStressState ? 'border-red-500' : 'border-indigo-600'}`}>
          <div className={`px-12 py-10 flex justify-between items-center border-b transition-colors ${isStressState ? 'bg-red-600 text-white border-red-500' : 'bg-indigo-700 text-white border-white/10'}`}>
            <div>
              <h2 className="font-black tracking-tighter uppercase leading-none mb-2 text-3xl">{exam.title}</h2>
              <span className="bg-white/20 px-3 py-1 theme-rounded text-[9px] font-black uppercase">Question {currentIndex + 1} of {exam.questions.length}</span>
            </div>
            <div className={`px-10 py-6 theme-rounded backdrop-blur-xl border shadow-2xl font-mono font-black ${isStressState ? 'bg-black/50 text-white' : 'bg-black/30 text-white'} text-4xl`}>
              {formatTime(timeLeft)}
            </div>
          </div>

          <div className="p-16 space-y-10 min-h-[450px]">
            <h3 className="font-black uppercase tracking-tight leading-tight text-3xl text-slate-800 dark:text-white">
              {currentQuestion.text}
            </h3>

            {currentQuestion.imageUrl && (
              <div className="flex justify-center my-8">
                <img src={currentQuestion.imageUrl} className="max-w-full theme-rounded shadow-xl border-4 border-slate-100" alt="Question Resource" />
              </div>
            )}

            <div className="space-y-4">
              {currentQuestion.type === QuestionType.THEORY ? (
                <textarea
                  className="w-full h-64 p-10 theme-rounded outline-none font-bold border-4 border-slate-100 dark:bg-slate-950 dark:border-slate-800 focus:border-indigo-500 transition-all text-xl"
                  placeholder="Enter your detailed answer here..."
                  value={answers[currentQuestion.id] || ''}
                  onChange={e => setAnswers({ ...answers, [currentQuestion.id]: e.target.value })}
                />
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {currentQuestion.options?.map((opt, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    const isSelected = answers[currentQuestion.id] === opt;
                    return (
                      <button
                        key={idx}
                        onClick={() => setAnswers({ ...answers, [currentQuestion.id]: opt })}
                        className={`w-full flex items-center gap-6 p-6 theme-rounded border-4 transition-all text-left ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950'
                          }`}
                      >
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl ${isSelected ? 'bg-white text-indigo-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                          {letter}
                        </div>
                        <span className="font-black uppercase tracking-tight text-lg">{opt}</span>
                      </button>
                    );
                  })
                  }
                </div>
              )}
            </div>
          </div>

          <div className="px-12 py-12 border-t flex justify-between items-center gap-6 bg-white dark:bg-slate-900">
            <div className="flex gap-4">
              <button disabled={currentIndex === 0} onClick={() => setCurrentIndex(prev => prev - 1)} className="px-8 py-4 theme-rounded font-black uppercase text-xs tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-400 disabled:opacity-20">Back</button>
              <button disabled={currentIndex === exam.questions.length - 1} onClick={() => setCurrentIndex(prev => prev + 1)} className="px-8 py-4 theme-rounded font-black uppercase text-xs tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-400 disabled:opacity-20">Next</button>
            </div>
            <button onClick={() => { if (confirm("Are you sure you want to finish and submit?")) handleSubmit(); }} className={`px-16 py-5 theme-rounded font-black uppercase tracking-[0.2em] shadow-2xl transition-all ${isStressState ? 'bg-red-600 text-white animate-bounce' : 'bg-slate-900 dark:bg-indigo-600 text-white'}`}>Submit Exam</button>
          </div>
        </div>
      </div>
    </div >
  );
};

export default ExamInterface;
