
import React, { useState, useMemo, memo } from 'react';
import { Exam, QuestionType, ResultRelease, Question, Submission, TimerSettings, ExamTemplate, GradingPolicy, Difficulty, SystemSettings, QuestionResult, UserRole } from '../services/types';
import { v4 as uuidv4 } from 'uuid';
import SubmissionDetailModal from './SubmissionDetailModal';
import BulkImportModal from './BulkImportModal';
import { sanitize, logEvent } from '../services/securityService';
import { generateQuestions } from '../services/geminiService';
import { useSystem } from '../services/SystemContext';
import { useToast } from '../services/ToastContext';
import { useExams } from '../hooks/useExams';
import { useSubmissions } from '../hooks/useSubmissions';
import { useUsers } from '../hooks/useUsers';
import { useQuestions } from '../hooks/useQuestions';

interface AdminDashboardProps {
  templates: ExamTemplate[];
  onSaveTemplate?: (template: ExamTemplate) => void;
  onDeleteTemplate?: (id: string) => void;
  questionBank: Question[];
  onAddToBank?: (question: Question) => void;
  onUpdateBankQuestion?: (id: string, updated: Question) => void;
  onDeleteFromBank?: (id: string) => void;
  onPreviewExam: (exam: Exam) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = memo(({
  onPreviewExam,
}) => {
  const { settings: systemSettings } = useSystem();
  const { addToast } = useToast();

  // Data managed by custom hooks
  const { exams, saveExam, bulkDeleteExams } = useExams();
  const { submissions, setSubmissions, updateSubmission, bulkDeleteSubmissions } = useSubmissions();

  const { users } = useUsers();
  const { questions: questionBank, saveQuestion, deleteQuestion } = useQuestions();

  const [activeTab, setActiveTab] = useState<'exams' | 'submissions' | 'users' | 'questions'>('exams');
  const [isCreating, setIsCreating] = useState(false);
  const [aiContext, setAiContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [submissionFilter, setSubmissionFilter] = useState('');
  const [selectedSubIds, setSelectedSubIds] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);

  const handleBatchImport = async (importedQuestions: Partial<Question>[]) => {
    // In a real app we'd call the API: await api.questions.batchImport(importedQuestions);
    // For now, we simulate it or use the hook if available.
    // The useQuestions hook doesn't support batch yet, so we loop or call api direct.
    // Let's call the new API endpoint we created.
    try {
      const res = await fetch('/api/questions/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importedQuestions.map(q => ({
          ...q,
          examId: null, // Global bank
          createdAt: Date.now()
        })))
      });
      if (!res.ok) throw new Error('Import failed');
      addToast(`Successfully imported ${importedQuestions.length} questions.`, 'success');
      // Force refresh would be ideal, but for now our hook might not auto-update unless we invalidate.
      // We'll manually inject them into the local cache if possible or just rely on re-fetch.
      // For this refactor, let's just reload window or tell user to refresh.
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      addToast('Import failed. Check format.', 'error');
    }
  };

  // Filter states for Questions
  const [questionFilterText, setQuestionFilterText] = useState('');
  const [questionFilterType, setQuestionFilterType] = useState<QuestionType | 'ALL'>('ALL');

  const filteredQuestions = useMemo(() => {
    return questionBank.filter(q => {
      const matchesText = q.text.toLowerCase().includes(questionFilterText.toLowerCase());
      const matchesType = questionFilterType === 'ALL' || q.type === questionFilterType;
      return matchesText && matchesType;
    });
  }, [questionBank, questionFilterText, questionFilterType]);

  const defaultTimerSettings: TimerSettings = {
    warningThresholdMinutes: 5,
    autoSubmitOnExpiry: true,
    allowLateSubmission: false,
    latePenaltyPercentage: 0,
    gracePeriodSeconds: 30
  };

  const defaultGradingPolicy: GradingPolicy = {
    negativeMarkingEnabled: false,
    negativeMarksPerQuestion: 0.25,
    maxNegativeDeduction: 10
  };

  const [editingExam, setEditingExam] = useState<Partial<Exam>>({
    title: '',
    questions: [],
    category: 'General',
    difficulty: Difficulty.MEDIUM,
    durationMinutes: 30,
    passMark: 50,
    resultRelease: ResultRelease.INSTANT,
    timerSettings: defaultTimerSettings,
    gradingPolicy: defaultGradingPolicy,
    version: 1
  });

  const handleAIGradeSubmission = async (submissionId: string) => {
    // This logic would need to be moved to a hook or stay here,
    // for now it's simplified as it's a complex operation.
    addToast('AI Re-grading is a complex operation, simplified in this refactor.', 'info');
  };

  const onManualGrade = (submissionId: string, questionId: string, result: QuestionResult) => {
    // This logic would also be part of the submissions hook
    addToast('Manual grading is a complex operation, simplified in this refactor.', 'info');
  };

  const onReleaseAllDelayedResults = async () => {
    try {
      const updatedSubs = await Promise.all(
        submissions
          .filter(s => !s.resultsReleased && exams.find(e => e.id === s.examId)?.resultRelease === ResultRelease.DELAYED)
          .map(s => updateSubmission({ ...s, resultsReleased: true }))
      );
      setSubmissions(prev => prev.map(s => updatedSubs.find(u => u?.id === s.id) || s));
      addToast('Delayed results have been released.', 'success');
    } catch (e) {
      addToast('Failed to release delayed results.', 'error');
    }
  };


  const handleAiBuild = async () => {
    // Non-AI preference: Feature disabled.
    addToast('AI Generation is currently disabled by system policy.', 'info');
  };

  const handleSave = async () => {
    if (!editingExam.title || !editingExam.questions?.length) {
      addToast("Title and questions are required.", 'error');
      return;
    }
    const securedExam: Exam = {
      ...editingExam,
      id: editingExam.id || uuidv4(),
      title: sanitize(editingExam.title || 'New Exam'),
      totalPoints: (editingExam.questions || []).reduce((sum, q) => sum + q.points, 0),
      published: true,
      version: (editingExam.version || 0) + 1,
      createdAt: editingExam.createdAt || Date.now()
    } as Exam;
    await saveExam(securedExam);
    setIsCreating(false);
  };

  const filteredSubmissions = useMemo(() => {
    const term = submissionFilter.toLowerCase();
    return submissions.filter(s => {
      const exam = exams.find(e => e.id === s.examId);
      const student = users.find(u => u.id === s.studentId);
      return (exam?.title || '').toLowerCase().includes(term) || (student?.name || '').toLowerCase().includes(term);
    });
  }, [submissions, exams, users, submissionFilter]);

  const handleSelectSubmission = (id: string) => {
    const newSet = new Set(selectedSubIds);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedSubIds(newSet);
  };

  const handleSelectAllSubmissions = () => {
    if (selectedSubIds.size === filteredSubmissions.length) setSelectedSubIds(new Set());
    else setSelectedSubIds(new Set(filteredSubmissions.map(s => s.id)));
  };

  const [selectedSubmission, setSelectedSubmission] = useState<{ sub: Submission, exam: Exam } | null>(null);

  return (
    <div className="space-y-8 pb-20 dark:text-slate-100">
      <div className="flex border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-slate-50 dark:bg-slate-950 z-30">
        {['exams', 'submissions', 'users', 'questions'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-8 py-5 text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'submissions' && (
        <div className="px-4 space-y-8">
          <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] shadow-sm flex flex-col md:flex-row gap-8 justify-between items-center">
            <input type="text" placeholder="Search transcripts..." value={submissionFilter} onChange={e => setSubmissionFilter(e.target.value)} className="w-full md:max-w-md bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl font-black text-xs uppercase" />
            <div className="flex gap-4">
              {selectedSubIds.size > 0 && (
                <button onClick={() => { bulkDeleteSubmissions(Array.from(selectedSubIds)); setSelectedSubIds(new Set()); }} className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg">Delete ({selectedSubIds.size})</button>
              )}
              <button onClick={onReleaseAllDelayedResults} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase">Release Delayed</button>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900 theme-rounded p-8 shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th className="p-4">User</th>
                  <th className="p-4">Exam</th>
                  <th className="p-4">Date</th>
                  <th className="p-4 text-center">Score</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium">
                {filteredSubmissions.map(sub => {
                  const exam = exams.find(e => e.id === sub.examId);
                  const student = users.find(u => u.id === sub.studentId);
                  const isSelected = selectedSubIds.has(sub.id);

                  return (
                    <tr key={sub.id} className={`border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-white dark:hover:bg-slate-800/50 transition-colors ${isSelected ? 'bg-indigo-50 dark:bg-slate-800' : ''}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={isSelected} onChange={() => handleSelectSubmission(sub.id)} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                          <div>
                            <div className="font-bold text-slate-900 dark:text-slate-100">{student?.name || 'Unknown'}</div>
                            <div className="text-xs text-slate-400">{student?.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-300">{exam?.title || 'Deleted Exam'}</td>
                      <td className="p-4 text-slate-500">{new Date(sub.submittedAt).toLocaleDateString()}</td>
                      <td className="p-4 text-center font-bold text-lg">
                        {sub.graded ? (
                          <span>{(sub.score / (exam?.totalPoints || 1) * 100).toFixed(0)}%</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {sub.gradingStatus === 'PENDING_MANUAL_REVIEW' ? (
                          <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-[10px] uppercase font-black">Needs Grading</span>
                        ) : sub.graded ? (
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] uppercase font-black">Graded</span>
                        ) : (
                          <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-[10px] uppercase font-black">Pending</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button onClick={() => setSelectedSubmission({ sub, exam: exam! })} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wide">Review</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'questions' && (
        <div className="px-4 space-y-8">
          <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] shadow-sm">

            {/* Filter Bar */}
            <div className="mb-8 flex flex-col md:flex-row gap-4 p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
              <input
                className="flex-1 bg-transparent border-none outline-none font-bold text-xs uppercase"
                placeholder="Search Questions..."
                value={questionFilterText}
                onChange={e => setQuestionFilterText(e.target.value)}
              />
              <select
                className="bg-transparent font-bold text-xs uppercase outline-none text-slate-500"
                value={questionFilterType}
                onChange={e => setQuestionFilterType(e.target.value as any)}
              >
                <option value="ALL">All Types</option>
                <option value={QuestionType.MCQ}>MCQ</option>
                <option value={QuestionType.SBA}>SBA</option>
                <option value={QuestionType.THEORY}>Theory</option>
              </select>
            </div>

            <div className="flex justify-between mb-8">
              <h2 className="font-black text-2xl uppercase">Question Bank ({filteredQuestions.length})</h2>
              <div className="flex gap-2">
                <button onClick={() => setIsImporting(true)} className="bg-slate-800 text-white px-4 py-3 rounded-xl font-bold uppercase text-[10px]">Import (CSV)</button>
                <button onClick={() => {
                  const newQ: Question = {
                    id: uuidv4(),
                    type: QuestionType.MCQ,
                    text: 'New Multi-Choice Question',
                    correctAnswer: 'Option A',
                    points: 1,
                    options: ['Option A', 'Option B', 'Option C', 'Option D'],
                    createdAt: Date.now()
                  };
                  saveQuestion(newQ);
                }} className="bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold uppercase text-[10px]">+ MCQ</button>
                <button onClick={() => {
                  const newQ: Question = {
                    id: uuidv4(),
                    type: QuestionType.SBA,
                    text: 'New Single Best Answer',
                    correctAnswer: 'Option A',
                    points: 2,
                    options: ['Option A', 'Option B', 'Option C', 'Option D', 'Option E'],
                    createdAt: Date.now()
                  };
                  saveQuestion(newQ);
                }} className="bg-emerald-600 text-white px-4 py-3 rounded-xl font-bold uppercase text-[10px]">+ SBA</button>
                <button onClick={() => {
                  const newQ: Question = {
                    id: uuidv4(),
                    type: QuestionType.THEORY,
                    text: 'New Theory Question',
                    correctAnswer: 'Model Answer Keywords...',
                    points: 10,
                    options: [],
                    createdAt: Date.now()
                  };
                  saveQuestion(newQ);
                }} className="bg-purple-600 text-white px-4 py-3 rounded-xl font-bold uppercase text-[10px]">+ Theory</button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6">
              {filteredQuestions.map(q => (
                <div key={q.id} className="p-6 border rounded-2xl bg-slate-50 dark:bg-slate-800 transition-all hover:bg-white dark:hover:bg-slate-800/80">
                  <div className="flex justify-between items-start">
                    <div className="w-full">
                      <div className="flex gap-2 mb-2">
                        <span className={`inline-block px-2 py-1 rounded text-[10px] font-black uppercase ${q.type === 'THEORY' ? 'bg-purple-100 text-purple-700' : q.type === 'SBA' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>{q.type}</span>
                        <span className="inline-block px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-[10px] font-black uppercase">{q.points} Pts</span>
                      </div>

                      {/* Editable Title */}
                      <input
                        className="font-bold text-lg bg-transparent w-full outline-none border-b border-transparent focus:border-indigo-500 transition-colors mb-2"
                        value={q.text}
                        onChange={(e) => saveQuestion({ ...q, text: e.target.value })}
                        placeholder="Question Text"
                      />

                      <div className="mt-4 space-y-2">
                        {/* Theory View */}
                        {q.type === QuestionType.THEORY ? (
                          <div className="w-full">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Model Answer / Grading Rubric</label>
                            <textarea
                              className="w-full p-3 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg mt-1 h-24 font-mono"
                              value={q.correctAnswer}
                              onChange={(e) => saveQuestion({ ...q, correctAnswer: e.target.value })}
                              placeholder="Enter model answer..."
                            />
                          </div>
                        ) : (
                          /* MCQ/SBA View */
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Options (Select Correct)</label>
                            {q.options?.map((opt, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`correct-${q.id}`}
                                  checked={opt === q.correctAnswer}
                                  onChange={() => saveQuestion({ ...q, correctAnswer: opt })}
                                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                                />
                                <input
                                  className={`text-sm bg-transparent w-full outline-none border-b border-transparent focus:border-slate-300 ${opt === q.correctAnswer ? 'text-green-600 font-bold' : 'text-slate-500'}`}
                                  value={opt}
                                  onChange={(e) => {
                                    const newOptions = [...(q.options || [])];
                                    newOptions[idx] = e.target.value;
                                    // If we changed the text of the correct answer, update correctAnswer field too to match
                                    const updates: any = { options: newOptions };
                                    if (opt === q.correctAnswer) updates.correctAnswer = e.target.value;
                                    saveQuestion({ ...q, ...updates });
                                  }}
                                />
                                <button onClick={() => {
                                  const newOptions = q.options?.filter((_, i) => i !== idx);
                                  saveQuestion({ ...q, options: newOptions });
                                }} className="text-slate-300 hover:text-red-500 px-2">×</button>
                              </div>
                            ))}
                            <button onClick={() => saveQuestion({ ...q, options: [...(q.options || []), `Option ${String.fromCharCode(65 + (q.options?.length || 0))}`] })} className="text-xs text-indigo-600 font-bold uppercase hover:underline">+ Add Option</button>
                          </div>
                        )}
                      </div>
                    </div>
                    <button onClick={() => deleteQuestion(q.id)} className="text-red-500 hover:text-red-700 font-bold text-xs uppercase ml-4">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'exams' && (
        <div className="px-4 space-y-8">
          {isCreating ? (
            <div className="bg-white dark:bg-slate-900 p-10 theme-rounded shadow-sm animate-in zoom-in-95">
              <h2 className="font-black text-2xl uppercase mb-6">Create New Exam</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Exam Title</label>
                  <input className="w-full p-4 theme-rounded bg-slate-50 dark:bg-slate-950 font-bold" value={editingExam.title} onChange={e => setEditingExam({ ...editingExam, title: e.target.value })} placeholder="e.g. Final Anatomy Assessment" />
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setEditingExam({ ...editingExam, questions: [...(editingExam.questions || []), ...questionBank.slice(0, 5)] })} className="bg-slate-100 hover:bg-slate-200 text-slate-900 px-6 py-3 rounded-xl font-bold uppercase text-xs">Add Random (5)</button>
                  <button onClick={() => setEditingExam({ ...editingExam, questions: [...(editingExam.questions || []), ...questionBank] })} className="bg-slate-100 hover:bg-slate-200 text-slate-900 px-6 py-3 rounded-xl font-bold uppercase text-xs">Add All from Bank</button>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 p-6 theme-rounded">
                  <h3 className="font-bold uppercase text-xs text-slate-400 mb-4">Selected Questions ({editingExam.questions?.length})</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {editingExam.questions?.map((q, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-900 p-3 rounded shadow-sm">
                        <span className="text-sm font-medium truncate w-3/4">{q.text}</span>
                        <button onClick={() => setEditingExam({ ...editingExam, questions: editingExam.questions?.filter((_, i) => i !== idx) })} className="text-red-500 text-xs font-bold uppercase">Remove</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t">
                  <button onClick={() => setIsCreating(false)} className="px-6 py-3 font-bold uppercase text-xs text-slate-500">Cancel</button>
                  <button onClick={handleSave} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold uppercase text-xs shadow-lg">Save Exam</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 p-10 theme-rounded shadow-sm">
              <div className="flex justify-between mb-8">
                <h2 className="font-black text-2xl uppercase">All Exams</h2>
                <button onClick={() => { setEditingExam({ title: '', questions: [], category: 'General', difficulty: Difficulty.MEDIUM, durationMinutes: 30, passMark: 50, resultRelease: ResultRelease.INSTANT, timerSettings: defaultTimerSettings, gradingPolicy: defaultGradingPolicy, version: 1 }); setIsCreating(true); }} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold uppercase text-xs">+ Create Exam</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {exams.map(exam => (
                  <div key={exam.id} className="p-6 border rounded-2xl bg-slate-50 dark:bg-slate-800 hover:border-indigo-500 transition-colors group cursor-pointer" onClick={() => onPreviewExam(exam)}>
                    <h3 className="font-bold text-lg mb-2">{exam.title}</h3>
                    <div className="flex gap-2 text-[10px] font-black uppercase text-slate-400">
                      <span className="bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">{exam.questions.length} Qs</span>
                      <span className="bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">{exam.durationMinutes} m</span>
                    </div>
                    <div className="mt-4 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-indigo-600 text-xs font-bold uppercase">Preview</span>
                      <button onClick={(e) => { e.stopPropagation(); bulkDeleteExams([exam.id]); }} className="text-red-500 text-xs font-bold uppercase">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="px-4">
          <div className="bg-white dark:bg-slate-900 p-10 theme-rounded shadow-sm">
            <h2 className="font-black text-2xl uppercase mb-8">Registered Users</h2>
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b">
                  <th className="pb-4">Name</th>
                  <th className="pb-4">Email</th>
                  <th className="pb-4">Role</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {users.map(u => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-4 font-bold">{u.name}</td>
                    <td className="py-4 text-slate-500">{u.email}</td>
                    <td className="py-4"><span className="bg-slate-100 px-2 py-1 rounded text-[10px] uppercase font-black">{u.role}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedSubmission && (
        <SubmissionDetailModal
          submission={selectedSubmission.sub}
          exam={selectedSubmission.exam}
          onClose={() => setSelectedSubmission(null)}
          systemSettings={systemSettings}
          isAdmin={true}
          onManualGrade={(qId, res) => {
            // In a real app we would call an API here. For now we just update local state.
            const updatedResults = { ...selectedSubmission.sub.questionResults, [qId]: res };
            const newScore = Object.values(updatedResults).reduce((acc, r: any) => acc + (r.score || 0), 0); // Simplified score recalc
            updateSubmission({ ...selectedSubmission.sub, questionResults: updatedResults, score: newScore });
            setSelectedSubmission({ ...selectedSubmission, sub: { ...selectedSubmission.sub, questionResults: updatedResults, score: newScore } });
            addToast('Grade saved', 'success');
          }}
        />
      )}

      {isImporting && (
        <BulkImportModal
          onImport={handleBatchImport}
          onClose={() => setIsImporting(false)}
        />
      )}
    </div >
  );
});

export default AdminDashboard;
