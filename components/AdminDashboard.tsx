
import React, { useState, useMemo, memo } from 'react';
import { User, Exam, QuestionType, ResultRelease, Question, Submission, TimerSettings, ExamTemplate, GradingPolicy, Difficulty, SystemSettings, QuestionResult, UserRole } from '../services/types';
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
import QuestionEditor from './QuestionEditor';
import QuestionSelector from './QuestionSelector';
import AnalyticsDashboard from './AnalyticsDashboard';

interface AdminDashboardProps {
  exams: Exam[];
  submissions: Submission[];
  users: User[];
  templates: ExamTemplate[];
  systemSettings: SystemSettings;

  // Exam Actions
  onSaveExam: (exam: Exam) => Promise<any>;
  onDeleteExam: (id: string) => void;
  onBulkDeleteExams: (ids: string[]) => void;
  onTogglePublish: (id: string, published: boolean) => void;
  onPreviewExam: (exam: Exam) => void;

  // Submission Actions
  onBulkDeleteSubmissions: (ids: string[]) => void;
  onManualGrade: (submissionId: string, questionId: string, result: QuestionResult) => void;
  onReleaseResults: (examId: string) => void;
  onReleaseSingleSubmission: (id: string) => void;
  onReleaseAllDelayedResults: () => void;
  onAIGradeSubmission: (id: string) => Promise<void>;

  // Bank Actions
  questionBank: Question[];
  onAddToBank?: (question: Question) => void;
  onUpdateBankQuestion?: (id: string, updated: Question) => void;
  onDeleteFromBank?: (id: string) => void;

  // Template Actions
  onSaveTemplate?: (template: ExamTemplate) => void;
  onDeleteTemplate?: (id: string) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = memo(({
  exams,
  submissions,
  users,
  questionBank,
  onSaveExam,
  onDeleteExam,
  onBulkDeleteExams,
  onBulkDeleteSubmissions,
  onTogglePublish,
  onPreviewExam,
  onManualGrade,
  onReleaseAllDelayedResults,
  onReleaseResults,
  onReleaseSingleSubmission,
  onAddToBank,
  onUpdateBankQuestion,
  onDeleteFromBank,
}) => {
  const { settings: systemSettings } = useSystem();
  const { addToast } = useToast();

  const { questions: unusedQuestions, saveQuestion, deleteQuestion } = useQuestions(); // Keep for internal bank management if needed, but actions are passed now. 
  // actually onAddToBank is passed, so we should use that. 
  // But wait, the component uses saveQuestion/deleteQuestion internally for the QuestionEditor.
  // We should prob use the passed props for those too if available, or keep the hook for BANK management if it's creating questions directly.
  // The prompt says "questionBank" is passed. 

  // We will trust the passed props for main data to ensure sync.

  const [activeTab, setActiveTab] = useState<'exams' | 'submissions' | 'users' | 'questions' | 'analytics'>('exams');
  const [isCreating, setIsCreating] = useState(false);
  const [aiContext, setAiContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [submissionFilter, setSubmissionFilter] = useState('');
  const [selectedSubIds, setSelectedSubIds] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [isSelectingQuestions, setIsSelectingQuestions] = useState(false); // For modal
  const [creatingQuestionType, setCreatingQuestionType] = useState<QuestionType | null>(null); // If set, shows the creator

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

  // Internal implementations removed, using props.


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
    await onSaveExam(securedExam);
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
      <div className="flex border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-slate-50 dark:bg-slate-950 z-30 overflow-x-auto">
        {['exams', 'questions', 'submissions', 'analytics', 'users'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-8 py-5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
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
                <button onClick={() => { onBulkDeleteSubmissions(Array.from(selectedSubIds)); setSelectedSubIds(new Set()); }} className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg">Delete ({selectedSubIds.size})</button>
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
                        <button onClick={() => {
                          if (!exam) { addToast("Exam for this submission was deleted.", "error"); return; }
                          setSelectedSubmission({ sub, exam: exam });
                        }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wide">Review</button>
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
                <button onClick={() => setCreatingQuestionType(QuestionType.MCQ)} className="bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold uppercase text-[10px]">+ MCQ</button>
                <button onClick={() => setCreatingQuestionType(QuestionType.SBA)} className="bg-emerald-600 text-white px-4 py-3 rounded-xl font-bold uppercase text-[10px]">+ SBA</button>
                <button onClick={() => setCreatingQuestionType(QuestionType.THEORY)} className="bg-purple-600 text-white px-4 py-3 rounded-xl font-bold uppercase text-[10px]">+ Theory</button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {/* Question Creator */}
              {creatingQuestionType && (
                <div className="mb-8 animate-in slide-in-from-top-4 fade-in">
                  <QuestionEditor
                    isNew={true}
                    initialQuestion={{ type: creatingQuestionType }}
                    onSave={async (q) => {
                      await saveQuestion({ ...q, id: '', createdAt: Date.now() } as Question);
                      setCreatingQuestionType(null); // Close creator on success
                    }}
                    onCancel={() => setCreatingQuestionType(null)}
                  />
                </div>
              )}

              {/* Existing Questions */}
              {filteredQuestions.map(q => (
                <QuestionEditor
                  key={q.id}
                  initialQuestion={q}
                  onSave={async (updated) => {
                    await saveQuestion({ ...q, ...updated });
                  }}
                  onDelete={() => deleteQuestion(q.id)}
                />
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Duration (Minutes)</label>
                    <input type="number" className="w-full p-4 theme-rounded bg-slate-50 dark:bg-slate-950 font-bold" value={editingExam.durationMinutes} onChange={e => setEditingExam({ ...editingExam, durationMinutes: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Pass Mark (%)</label>
                    <input type="number" className="w-full p-4 theme-rounded bg-slate-50 dark:bg-slate-950 font-bold" value={editingExam.passMark} onChange={e => setEditingExam({ ...editingExam, passMark: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Scheduled Release (Optional)</label>
                    <input
                      type="datetime-local"
                      className="w-full p-4 theme-rounded bg-slate-50 dark:bg-slate-950 font-bold text-sm"
                      // Simple approach: Use string value from/to local ISO without complex conversion if possible, or strip 'Z'
                      // Best way: Use a string state for this input, but since we bind to editingExam.scheduledReleaseDate (Date object or string), we convert.
                      value={editingExam.scheduledReleaseDate ?
                        (typeof editingExam.scheduledReleaseDate === 'string'
                          ? editingExam.scheduledReleaseDate.substring(0, 16)
                          : new Date(editingExam.scheduledReleaseDate).toISOString().slice(0, 16))
                        : ''}
                      onChange={e => setEditingExam({ ...editingExam, scheduledReleaseDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Leave blank to publish immediately.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Warning Threshold (Min)</label>
                    <input type="number" className="w-full p-4 theme-rounded bg-slate-50 dark:bg-slate-950 font-bold" value={editingExam.timerSettings?.warningThresholdMinutes || 5} onChange={e => setEditingExam({ ...editingExam, timerSettings: { ...editingExam.timerSettings!, warningThresholdMinutes: parseInt(e.target.value) || 5 } })} />
                  </div>
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setIsSelectingQuestions(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold uppercase text-xs shadow-md transition-all flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    Select From Bank
                  </button>
                  <button onClick={() => setEditingExam({ ...editingExam, questions: [] })} className="bg-slate-100 hover:bg-slate-200 text-slate-900 px-6 py-3 rounded-xl font-bold uppercase text-xs">Clear All</button>
                </div>

                {isSelectingQuestions && (
                  <QuestionSelector
                    questions={questionBank}
                    initialSelection={editingExam.questions?.map(q => q.id) || []}
                    onClose={() => setIsSelectingQuestions(false)}
                    onSelect={(selected) => {
                      setEditingExam({ ...editingExam, questions: selected });
                      setIsSelectingQuestions(false);
                      addToast(`${selected.length} questions added to exam.`, 'success');
                    }}
                  />
                )}

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

                <div className="flex justify-between gap-4 pt-4 border-t">
                  <div className="flex gap-2">
                    <button onClick={() => setIsCreating(false)} className="px-6 py-3 font-bold uppercase text-xs text-slate-500">Cancel</button>
                    {/* Duplicate / Save as Copy Feature */}
                    {editingExam.id && (
                      <button onClick={async () => {
                        const copy = { ...editingExam, id: undefined, title: `${editingExam.title} (Copy)`, published: false };
                        setEditingExam(copy);
                        // We just updated state, user can now Save as new.
                        addToast('Exam duplicated. Click Save to create.', 'success');
                      }} className="px-6 py-3 font-bold uppercase text-xs text-indigo-600">Save as Copy</button>
                    )}
                  </div>
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
                    <div className="mt-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex justify-between items-center">
                        <span className="text-indigo-600 text-xs font-bold uppercase">Actions</span>
                        <div className="flex gap-2">
                          <button onClick={(e) => {
                            e.stopPropagation(); onTogglePublish(exam.id, !exam.published);
                          }} className={`text-xs font-bold uppercase hover:underline z-10 ${exam.published ? 'text-slate-400' : 'text-green-600'}`}>{exam.published ? 'Hide' : 'Publish'}</button>

                          <button onClick={(e) => {
                            e.stopPropagation(); setEditingExam(exam); setIsCreating(true);
                          }} className="text-indigo-600 text-xs font-bold uppercase hover:underline z-10">Edit</button>

                          <button onClick={(e) => {
                            e.stopPropagation(); onPreviewExam(exam);
                          }} className="text-blue-600 text-xs font-bold uppercase hover:underline z-10">Preview</button>

                          {/* Quick Duration Edit for Active Exams */}
                          <button onClick={async (e) => {
                            e.stopPropagation();
                            const newTime = prompt("Enter new duration (minutes):", exam.durationMinutes.toString());
                            if (newTime && !isNaN(parseInt(newTime))) {
                              try {
                                await fetch(`/api/exams/${exam.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ durationMinutes: parseInt(newTime) })
                                });
                                alert('Time added! Students will see update in < 30s.');
                              } catch (e) { alert('Failed to add time'); }
                            }
                          }} className="text-emerald-600 text-xs font-bold uppercase hover:underline">Add Time</button>

                          <button onClick={(e) => { e.stopPropagation(); onBulkDeleteExams([exam.id]); }} className="text-red-500 text-xs font-bold uppercase hover:underline">Delete</button>
                        </div>
                      </div>
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

      {activeTab === 'analytics' && (
        <AnalyticsDashboard exams={exams} submissions={submissions} users={users} />
      )}

      {selectedSubmission && (
        <SubmissionDetailModal
          submission={selectedSubmission.sub}
          exam={selectedSubmission.exam}
          onClose={() => setSelectedSubmission(null)}
          systemSettings={systemSettings}
          isAdmin={true}
          onManualGrade={(qId, res) => {
            // Adapt the call to the prop
            if (selectedSubmission) {
              onManualGrade(selectedSubmission.sub.id, qId, res);
              // We don't manually update local state here anymore because the parent handles the definitive update
              // and passes back the new submissions list.
              setSelectedSubmission(null); // Close to refresh/avoid stale state or keep open handled by state? 
              // Simple approach: Close modal on save.
              addToast('Grade saved', 'success');
            }
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
