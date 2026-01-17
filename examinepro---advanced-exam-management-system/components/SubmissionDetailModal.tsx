
import React, { useState } from 'react';
import { Submission, Exam, SystemSettings, QuestionResult, QuestionType } from '../services/types';

interface SubmissionDetailModalProps {
  submission: Submission;
  exam: Exam;
  onClose: () => void;
  systemSettings: SystemSettings;
  isAdmin?: boolean;
  onManualGrade?: (questionId: string, result: QuestionResult) => void;
  onReGrade?: () => Promise<void>;
}

const SubmissionDetailModal: React.FC<SubmissionDetailModalProps> = ({ 
  submission, 
  exam, 
  onClose, 
  isAdmin, 
  onManualGrade,
  onReGrade
}) => {
  const [isCertificateView, setIsCertificateView] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editScore, setEditScore] = useState<number>(0);
  const [isReGrading, setIsReGrading] = useState(false);

  const percentage = Math.round((submission.score / (exam.totalPoints || 1)) * 100);
  const hasPassed = percentage >= (exam.passMark || 50);

  const handleStartEdit = (qId: string, currentScore: number) => {
    setEditingId(qId);
    setEditScore(currentScore);
  };

  const handleSaveManual = (qId: string, maxPoints: number) => {
    if (!onManualGrade) return;
    const finalScore = Math.min(maxPoints, Math.max(0, editScore));
    onManualGrade(qId, {
      score: finalScore,
      feedback: `Score manually adjusted by Administrator.`,
      isCorrect: finalScore >= (maxPoints * 0.5)
    });
    setEditingId(null);
  };

  const handleTriggerReGrade = async () => {
    if (!onReGrade) return;
    setIsReGrading(true);
    try {
      await onReGrade();
    } finally {
      setIsReGrading(false);
    }
  };

  // ... Certificate View remains the same ...
  
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[90vh] theme-rounded shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 border-b-[12px] border-indigo-600">
        <div className="p-12 bg-indigo-700 dark:bg-indigo-900 text-white flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-4xl font-black tracking-tighter uppercase">{exam.title}</h3>
            <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mt-2">Ref: {submission.id.slice(0, 8)}</p>
          </div>
          <div className="text-right flex flex-col items-end">
            <p className="text-6xl font-black tracking-tighter leading-none">{submission.score.toFixed(1)} <span className="text-xl font-normal opacity-40">/ {exam.totalPoints}</span></p>
            <div className="flex gap-2 mt-4">
               {isAdmin && onReGrade && (
                 <button 
                  disabled={isReGrading}
                  onClick={handleTriggerReGrade} 
                  className="bg-indigo-600 border border-white/20 text-white px-6 py-2 theme-rounded text-[10px] font-black uppercase shadow-lg hover:bg-indigo-500 disabled:opacity-50"
                 >
                   {isReGrading ? 'Grading...' : 'AI Re-Grade'}
                 </button>
               )}
               {hasPassed && !isAdmin && (
                 <button onClick={() => setIsCertificateView(true)} className="bg-white text-indigo-700 px-6 py-2 theme-rounded text-[10px] font-black uppercase shadow-lg hover:bg-indigo-50">Certificate</button>
               )}
               <span className={`px-4 py-2 theme-rounded text-[10px] font-black uppercase tracking-widest ${hasPassed ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                 {hasPassed ? 'PASSED' : 'FAILED'}
               </span>
            </div>
          </div>
        </div>
        {/* ... Rest of the component remains the same ... */}
      </div>
    </div>
  );
};

export default SubmissionDetailModal;
