
import React, { useState, useMemo } from 'react';
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
  onMarkReviewed?: () => Promise<void>; // Parent refresh callback
}

const SubmissionDetailModal: React.FC<SubmissionDetailModalProps> = ({
  submission,
  exam,
  onClose,
  isAdmin,
  onManualGrade,
  onReGrade,
  onMarkReviewed
}) => {
  const [isCertificateView, setIsCertificateView] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editScore, setEditScore] = useState<number>(0);
  const [isReGrading, setIsReGrading] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const percentage = Math.round((submission.score / (exam.totalPoints || 1)) * 100);
  const hasPassed = percentage >= (exam.passMark || 50);

  // Filter/Sort questions + Pagination logic
  const questionsToDisplay = useMemo(() => {
    return exam.questions || [];
  }, [exam.questions]);

  const totalPages = Math.ceil(questionsToDisplay.length / itemsPerPage);
  const currentQuestions = questionsToDisplay.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
      alert('Re-grade complete.');
    } catch (e) {
      alert('Failed to re-grade.');
    } finally {
      setIsReGrading(false);
    }
  };

  const handleMarkReviewed = async () => {
    setIsReviewing(true);
    try {
      await api.submissions.markReviewed(submission.id);
      if (onMarkReviewed) await onMarkReviewed();
      // Optimistic update locally if needed, but mainly relying on parent refresh or just closing.
      // Ideally we keep modal open and update status badge.
      // Need to force update local submission prop? We can't. logic depends on parent re-rendering.
      alert('Submission marked as reviewed.');
      onClose();
    } catch (e) {
      alert('Failed to mark as reviewed.');
    } finally {
      setIsReviewing(false);
    }
  };

  if (isCertificateView) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
        <div className="bg-white text-slate-900 p-8 md:p-16 max-w-4xl w-full theme-rounded shadow-2xl relative border-[20px] border-double border-indigo-100 text-center animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
          <button onClick={() => setIsCertificateView(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          <div className="mb-12">
            <div className="w-24 h-24 bg-indigo-600 rounded-full mx-auto flex items-center justify-center mb-6 shadow-xl">
              <span className="text-4xl text-white">🎓</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black font-serif uppercase tracking-widest text-indigo-900 mb-4">Certificate</h2>
            <p className="text-xl text-slate-500 font-serif italic">of Achievement</p>
          </div>

          <div className="space-y-6 mb-12">
            <p className="text-lg text-slate-600">This certifies that</p>
            <h3 className="text-3xl md:text-4xl font-bold text-slate-900 border-b-2 border-slate-200 pb-4 inline-block px-12 capitalize">{submission.user?.name || 'The Candidate'}</h3>
            <p className="text-lg text-slate-600">has successfully completed the exam</p>
            <h4 className="text-2xl md:text-3xl font-bold text-indigo-700">{exam.title}</h4>
            <p className="text-lg text-slate-600 mt-4">with a score of <span className="font-black text-slate-900">{percentage}%</span></p>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center md:items-end text-left pt-12 border-t border-slate-100 gap-8">
            <div className="text-center md:text-left">
              <p className="text-xs font-bold uppercase text-slate-400 mb-1">Date Completed</p>
              <p className="font-serif text-lg text-slate-900">{new Date(submission.submittedAt).toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <div className="h-12 w-32 border-b border-indigo-900 mb-2 mx-auto md:mx-0"></div>
              <p className="text-xs font-bold uppercase text-indigo-900 text-center md:text-right">Valid Signature</p>
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm overflow-hidden">
      <div className="bg-white dark:bg-slate-950 w-full max-w-6xl max-h-[95vh] rounded-2xl md:rounded-3xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-300">

        {/* Header */}
        <div className="p-6 md:p-8 bg-indigo-700 dark:bg-slate-900 text-white flex flex-col md:flex-row justify-between items-start md:items-center shrink-0 gap-6 border-b border-indigo-600 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl md:text-3xl font-black tracking-tighter uppercase leading-tight">{exam.title}</h3>
              {submission.status === 'REVIEWED' && <span className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded font-black uppercase">Reviewed</span>}
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                <span>Ref: {submission.id.slice(0, 8)}</span>
                <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                <span>Student: {submission.user?.name || 'Unknown'}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-row md:flex-col items-center md:items-end w-full md:w-auto justify-between md:justify-start gap-4">
            <div className="text-center md:text-right">
              <p className="text-4xl md:text-5xl font-black tracking-tighter leading-none">
                {submission.score % 1 === 0 ? submission.score : submission.score.toFixed(1)}
                <span className="text-lg font-normal opacity-60"> / {exam.totalPoints}</span>
              </p>
              <p className="text-indigo-200 font-bold text-sm mt-1">{percentage}%</p>
            </div>

            <div className="flex gap-2 flex-wrap justify-end">
              {isAdmin && (
                <>
                  <button
                    onClick={async () => {
                      try {
                        const newStatus = !submission.resultsReleased;
                        await api.submissions.toggleRelease(submission.id, newStatus);
                        alert(`Results ${newStatus ? 'Released' : 'Hidden'}.`);
                      } catch (e) { alert("Failed."); }
                    }}
                    className={`px-4 py-2 theme-rounded text-[10px] font-black uppercase shadow-sm transition-opacity border border-white/20 ${submission.resultsReleased ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-300'}`}
                  >
                    {submission.resultsReleased ? 'Public' : 'Hidden'}
                  </button>

                  <button
                    disabled={isReviewing || submission.status === 'REVIEWED'}
                    onClick={handleMarkReviewed}
                    className="bg-white text-indigo-900 px-4 py-2 theme-rounded text-[10px] font-black uppercase shadow-sm hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submission.status === 'REVIEWED' ? 'Reviewed' : 'Confirm Review'}
                  </button>
                </>
              )}

              <div className={`px-4 py-2 theme-rounded text-[10px] font-black uppercase tracking-widest ${hasPassed ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                {hasPassed ? 'PASSED' : 'FAILED'}
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-slate-100 dark:bg-slate-900 p-2 md:px-8 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-2 items-center justify-between shrink-0">
          <div className="flex gap-2">
            {exam.resourceLink && (exam.resourceLink.startsWith('http') || exam.resourceLink.startsWith('https')) && (
              <a
                href={exam.resourceLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-4 py-2 rounded-lg text-xs font-bold uppercase hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
              >
                <span>📎</span> Resource
              </a>
            )}
            {isAdmin && onReGrade && (
              <button
                onClick={handleTriggerReGrade}
                disabled={isReGrading}
                className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 px-3 py-2 text-xs font-bold uppercase transition-colors"
              >
                {isReGrading ? 'Calculating...' : 'Re-calculate Score'}
              </button>
            )}
          </div>

          {/* Pagination Controls (Top) */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="w-8 h-8 flex items-center justify-center rounded bg-white dark:bg-slate-800 shadow-sm disabled:opacity-50"
              >←</button>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Page {currentPage} / {totalPages}</span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="w-8 h-8 flex items-center justify-center rounded bg-white dark:bg-slate-800 shadow-sm disabled:opacity-50"
              >→</button>
            </div>
          )}
        </div>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
          {currentQuestions.map((q, idx) => {
            const globalIndex = (currentPage - 1) * itemsPerPage + idx;
            const userAnswer = submission.answers[q.id];
            const result = submission.questionResults?.[q.id];
            const isEditing = editingId === q.id;

            return (
              <div key={q.id} className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                  <div className="flex items-center gap-4">
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-3 py-1 rounded text-[10px] font-black uppercase">Q{globalIndex + 1}</span>
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-3 py-1 rounded text-[10px] font-black uppercase">{q.type}</span>
                  </div>

                  <div className="flex items-center gap-4 self-end md:self-auto">
                    <div className="text-right">
                      <span className={`block text-xl font-black ${result?.isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
                        {isEditing ? (
                          <input
                            type="number"
                            value={editScore}
                            onChange={e => setEditScore(parseFloat(e.target.value))}
                            className="w-20 p-1 border rounded text-right bg-slate-50 dark:bg-slate-800 dark:text-white"
                          />
                        ) : (
                          result?.score || 0
                        )}
                        <span className="text-sm text-slate-400 font-bold"> / {q.points} pts</span>
                      </span>
                    </div>
                    {isAdmin && (
                      isEditing ? (
                        <button onClick={() => handleSaveManual(q.id, q.points)} className="bg-emerald-600 text-white px-3 py-1 rounded text-[10px] font-bold uppercase hover:bg-emerald-700">Save</button>
                      ) : (
                        <button onClick={() => handleStartEdit(q.id, result?.score || 0)} className="text-indigo-600 dark:text-indigo-400 hover:underline text-[10px] font-bold uppercase">Edit</button>
                      )
                    )}
                  </div>
                </div>

                <h4 className="font-bold text-lg md:text-xl mb-6 text-slate-800 dark:text-slate-200 leading-relaxed">{q.text}</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  <div className="p-5 bg-slate-50 dark:bg-slate-950/50 rounded-xl border-l-4 border-slate-300 dark:border-slate-700">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Student Answer</span>
                    <div className="font-medium text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed text-sm md:text-base">
                      {userAnswer || <span className="italic opacity-50">No Answer</span>}
                    </div>
                  </div>

                  {/* Show Correct Answer logic: Admin OR (Candidate AND Results Released) */}
                  {(isAdmin || submission.resultsReleased) && (
                    <div className="p-5 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl border-l-4 border-emerald-500 dark:border-emerald-600">
                      <span className="block text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-2">{q.type === QuestionType.THEORY ? 'Model Answer / Rubric' : 'Correct Answer'}</span>
                      <div className="font-medium text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed text-sm md:text-base">
                        {q.correctAnswer}
                      </div>
                    </div>
                  )}
                </div>

                {/* Enhanced MCQ/SBA Options Display for Context */}
                {(q.type === QuestionType.MCQ || q.type === QuestionType.SBA) && q.options && (
                  <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Question Options</span>
                    <div className="space-y-2">
                      {q.options.map((opt, oIdx) => {
                        const isSelected = userAnswer === opt;
                        const isCorrect = opt === q.correctAnswer;
                        const showCorrect = (isAdmin || submission.resultsReleased);

                        let bgClass = "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900";
                        let textClass = "text-slate-600 dark:text-slate-400";
                        let icon = null;

                        if (isSelected) {
                          bgClass = isCorrect
                            ? "bg-emerald-100/50 border-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-800 ring-1 ring-emerald-500/20"
                            : "bg-rose-100/50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-900 ring-1 ring-rose-500/20";
                          textClass = isCorrect ? "text-emerald-800 dark:text-emerald-300" : "text-rose-800 dark:text-rose-300";
                          icon = isCorrect ? "✓" : "✗";
                        } else if (showCorrect && isCorrect) {
                          bgClass = "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-500/5 dark:border-emerald-800";
                          textClass = "text-emerald-700 dark:text-emerald-400";
                          icon = "✓";
                        }

                        return (
                          <div key={oIdx} className={`p-3 md:p-4 rounded-lg border ${bgClass} flex items-center justify-between transition-colors`}>
                            <div className={`flex items-start gap-3 ${textClass}`}>
                              <span className="font-mono text-xs opacity-60 mt-0.5 min-w-[1.5rem]">[{String.fromCharCode(65 + oIdx)}]</span>
                              <span className="font-medium text-sm leading-snug">{opt}</span>
                            </div>
                            {icon && <span className="font-bold flex-shrink-0 ml-4">{icon}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty State / End of List message */}
          {currentQuestions.length === 0 && (
            <div className="text-center p-12 text-slate-400">
              No questions to display.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-white dark:bg-slate-900 flex justify-between items-center shrink-0">
          <div className="hidden md:block text-xs text-slate-400 font-bold uppercase">
            {isAdmin ? 'Administrator Mode' : 'Candidate View'}
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            {hasPassed && !isAdmin && (
              <button onClick={() => setIsCertificateView(true)} className="flex-1 md:flex-none bg-indigo-50 text-indigo-700 px-6 py-4 rounded-xl font-black uppercase text-xs hover:bg-indigo-100 transition-colors">
                View Certificate
              </button>
            )}
            <button onClick={onClose} className="flex-1 md:flex-none bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 px-8 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-colors">
              Close Review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubmissionDetailModal;
