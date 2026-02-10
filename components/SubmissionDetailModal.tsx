
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
            <p className="text-right text-indigo-300 font-bold text-lg mt-1">{Math.round((submission.score / (exam.totalPoints || 1)) * 100)}%</p>
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
        <div className="flex-1 overflow-y-auto p-12 space-y-8 bg-slate-50 dark:bg-slate-950">
          {exam.questions.map((q, idx) => {
            const userAnswer = submission.answers[q.id];
            const result = submission.questionResults?.[q.id];
            const isEditing = editingId === q.id;

            return (
              <div key={q.id} className="bg-white dark:bg-slate-900 p-8 theme-rounded shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-4">
                    <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 theme-rounded text-[10px] font-black text-slate-400 uppercase">Q{idx + 1}</span>
                    <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 theme-rounded text-[10px] font-black text-slate-400 uppercase">{q.type}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className={`block text-xl font-black ${result?.isCorrect ? 'text-green-600' : 'text-slate-900 dark:text-slate-100'}`}>
                        {isEditing ? (
                          <input
                            type="number"
                            value={editScore}
                            onChange={e => setEditScore(parseFloat(e.target.value))}
                            className="w-20 p-1 border rounded text-right"
                          />
                        ) : (
                          result?.score || 0
                        )}
                        <span className="text-sm text-slate-400 font-bold"> / {q.points}</span>
                      </span>
                    </div>
                    {isAdmin && (
                      isEditing ? (
                        <button onClick={() => handleSaveManual(q.id, q.points)} className="bg-green-600 text-white px-3 py-1 rounded text-[10px] font-bold uppercase">Save</button>
                      ) : (
                        <button onClick={() => handleStartEdit(q.id, result?.score || 0)} className="text-indigo-600 hover:underline text-[10px] font-bold uppercase">Edit</button>
                      )
                    )}
                  </div>
                </div>

                <h4 className="font-bold text-lg mb-6 text-slate-800 dark:text-slate-200">{q.text}</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-6 bg-slate-50 dark:bg-slate-950 rounded-xl border-l-[6px] border-slate-300">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Student Answer</span>
                    <p className="font-medium text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{userAnswer || <span className="italic opacity-50">No Answer</span>}</p>
                  </div>

                  {/* Show Correct Answer logic: Admin OR (Candidate AND Results Released) */}
                  {(isAdmin || submission.resultsReleased) && (
                    <div className="p-6 bg-green-50 dark:bg-slate-950 rounded-xl border-l-[6px] border-green-500">
                      <span className="block text-[10px] font-black uppercase tracking-widest text-green-600 mb-2">{q.type === QuestionType.THEORY ? 'Model Answer / Rubric' : 'Correct Answer'}</span>
                      <p className="font-medium text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{q.correctAnswer}</p>
                    </div>
                  )}
                </div>

                {/* Enhanced MCQ/SBA Options Display for Context */}
                {(q.type === QuestionType.MCQ || q.type === QuestionType.SBA) && q.options && (
                  <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Question Options</span>
                    <div className="space-y-2">
                      {q.options.map((opt, oIdx) => {
                        const isSelected = userAnswer === opt;
                        const isCorrect = opt === q.correctAnswer;
                        const showCorrect = (isAdmin || submission.resultsReleased);

                        let bgClass = "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800";
                        let textClass = "text-slate-600 dark:text-slate-400";
                        let icon = null;

                        if (isSelected) {
                          bgClass = isCorrect
                            ? "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-800"
                            : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900";
                          textClass = isCorrect ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300";
                          icon = isCorrect ? "✓" : "✗";
                        } else if (showCorrect && isCorrect) {
                          bgClass = "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800";
                          textClass = "text-green-700 dark:text-green-400";
                          icon = "✓";
                        }

                        return (
                          <div key={oIdx} className={`p-3 rounded border ${bgClass} flex items-center justify-between`}>
                            <div className={`flex items-center gap-3 ${textClass}`}>
                              <span className="font-mono text-xs opacity-70">[{String.fromCharCode(65 + oIdx)}]</span>
                              <span className="font-medium text-sm">{opt}</span>
                            </div>
                            {icon && <span className="font-bold">{icon}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-8 border-t bg-white dark:bg-slate-900 flex justify-end">
          <button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-900 px-8 py-4 theme-rounded font-black uppercase text-xs tracking-widest transition-colors">Close Review</button>
        </div>
      </div>
    </div>
  );
};

export default SubmissionDetailModal;
