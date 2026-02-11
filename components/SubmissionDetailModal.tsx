
import React, { useState } from 'react';
import { Submission, Exam, SystemSettings, QuestionResult, QuestionType } from '../services/types';
import { api } from '../services/api';

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

  if (isCertificateView) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
        <div className="bg-white text-slate-900 p-16 max-w-4xl w-full theme-rounded shadow-2xl relative border-[20px] border-double border-indigo-100 text-center animate-in zoom-in-95">
          <button onClick={() => setIsCertificateView(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          <div className="mb-12">
            <div className="w-24 h-24 bg-indigo-600 rounded-full mx-auto flex items-center justify-center mb-6 shadow-xl">
              <span className="text-4xl text-white">🎓</span>
            </div>
            <h2 className="text-5xl font-black font-serif uppercase tracking-widest text-indigo-900 mb-4">Certificate</h2>
            <p className="text-xl text-slate-500 font-serif italic">of Achievement</p>
          </div>

          <div className="space-y-6 mb-12">
            <p className="text-lg text-slate-600">This certifies that</p>
            <h3 className="text-4xl font-bold text-slate-900 border-b-2 border-slate-200 pb-4 inline-block px-12 capitalize">{submission.user?.name || 'The Candidate'}</h3>
            <p className="text-lg text-slate-600">has successfully completed the exam</p>
            <h4 className="text-3xl font-bold text-indigo-700">{exam.title}</h4>
            <p className="text-lg text-slate-600 mt-4">with a score of <span className="font-black text-slate-900">{percentage}%</span></p>
          </div>

          <div className="flex justify-between items-end text-left pt-12 border-t border-slate-100">
            <div>
              <p className="text-xs font-bold uppercase text-slate-400 mb-1">Date Completed</p>
              <p className="font-serif text-lg text-slate-900">{new Date(submission.submittedAt).toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <div className="h-12 w-32 border-b border-indigo-900 mb-2"></div>
              <p className="text-xs font-bold uppercase text-indigo-900">Valid Signature</p>
            </div>
          </div>

          <div className="mt-8 no-print">
            <button onClick={() => window.print()} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold uppercase text-xs shadow-lg hover:bg-indigo-700">Print Certificate</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border-b-[8px] border-indigo-600 animate-in fade-in zoom-in-95 duration-200">
        <div className="p-8 bg-indigo-700 dark:bg-indigo-900 text-white flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-3xl font-black tracking-tighter uppercase">{exam.title}</h3>
            <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mt-1">Ref: {submission.id.slice(0, 8)}</p>
          </div>
          <div className="text-right flex flex-col items-end">
            <p className="text-5xl font-black tracking-tighter leading-none">{submission.score.toFixed(1)} <span className="text-lg font-normal opacity-60">/ {exam.totalPoints}</span></p>
            <p className="text-right text-indigo-200 font-bold text-sm mt-1">{Math.round((submission.score / (exam.totalPoints || 1)) * 100)}%</p>
            {isAdmin && (
              <button
                onClick={async () => {
                  // Toggle Release Status
                  try {
                    // Optimistic Update? Better to wait for API in modal
                    const newStatus = !submission.resultsReleased;
                    await api.submissions.toggleRelease(submission.id, newStatus);
                    // Refresh parent via callback if possible, or force reload. 
                    // Ideally props should update. For now, we can notify user.
                    alert(`Results ${newStatus ? 'Released' : 'Hidden'}. Please close and reopen to refresh.`);
                  } catch (e) { alert("Failed to toggle release status"); }
                }}
                className={`bg-slate-900 border border-white/20 text-white px-6 py-2 theme-rounded text-[10px] font-black uppercase shadow-lg hover:bg-slate-800 ${submission.resultsReleased ? 'opacity-100' : 'opacity-50'}`}
              >
                {submission.resultsReleased ? 'Results Public' : 'Results Hidden'}
              </button>
            )}
          </div>
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
  );
};

export default SubmissionDetailModal;
