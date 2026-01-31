
import React, { useState, useMemo, useEffect } from 'react';
import { Exam, QuestionType, ResultRelease, Question, Submission, TimerSettings, ExamTemplate, User, GradingPolicy, Difficulty, SystemSettings, QuestionResult, UserRole } from '../types';
import { STORAGE_KEYS } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import SubmissionDetailModal from './SubmissionDetailModal';
import { sanitize, logEvent } from '../services/securityService';
import { generateQuestions } from '../services/geminiService';

interface AdminDashboardProps {
  exams: Exam[];
  submissions: Submission[];
  templates: ExamTemplate[];
  users: User[];
  onSaveExam: (exam: Exam) => void;
  onDeleteExam: (id: string) => void;
  onBulkDeleteExams: (ids: string[]) => void;
  onBulkDeleteSubmissions: (ids: string[]) => void;
  onReleaseResults: (examId: string) => void;
  onReleaseSingleSubmission: (id: string) => void;
  onReleaseAllDelayedResults: () => void;
  onAIGradeSubmission: (submissionId: string) => Promise<void>;
  onManualGrade: (submissionId: string, questionId: string, result: QuestionResult) => void;
  onSaveTemplate: (template: ExamTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  questionBank: Question[];
  onAddToBank: (question: Question) => void;
  onUpdateBankQuestion: (id: string, updated: Question) => void;
  onDeleteFromBank: (id: string) => void;
  systemSettings: SystemSettings;
  onPreviewExam: (exam: Exam) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  exams,
  submissions,
  users,
  onSaveExam,
  onReleaseAllDelayedResults,
  onManualGrade,
  onBulkDeleteSubmissions,
  systemSettings,
  onPreviewExam
}) => {
  const [activeTab, setActiveTab] = useState<'exams' | 'submissions' | 'users'>('exams');
  const [isCreating, setIsCreating] = useState(false);
  const [aiContext, setAiContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [submissionFilter, setSubmissionFilter] = useState('');
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);

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

  const handleAiBuild = async () => {
    if (!aiContext || !systemSettings.aiEnabled) return;
    setIsGenerating(true);
    try {
      const generated = await generateQuestions(aiContext, 5, [QuestionType.MCQ, QuestionType.THEORY]);
      const newQuestions: Question[] = generated.map(g => ({
        ...g,
        id: uuidv4(),
        points: 10,
        createdAt: Date.now()
      }));
      setEditingExam(prev => ({
        ...prev,
        title: `AI Build: ${aiContext.slice(0, 15)}...`,
        questions: [...(prev.questions || []), ...newQuestions]
      }));
      logEvent(null, 'AI_GENERATE', `Generated items for: ${aiContext}`, 'INFO');
    } catch (err: any) {
      alert(err.message || "AI services currently unavailable.");
    } finally {
      setIsGenerating(false);
      setAiContext('');
    }
  };

  const handleSave = () => {
    if (!editingExam.title || !editingExam.questions?.length) {
      alert("Error: Title and items required.");
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
    onSaveExam(securedExam);
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

  const [selectedSubmission, setSelectedSubmission] = useState<{ sub: Submission, exam: Exam } | null>(null);

  return (
    <div className="space-y-8 pb-20 dark:text-slate-100">
      <div className="flex border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-slate-50 dark:bg-slate-950 z-30">
        {['exams', 'submissions', 'users'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-8 py-5 text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'exams' && (
        <div className="px-4">
          {!isCreating ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div onClick={() => { setEditingExam({ title: '', questions: [], category: 'General', difficulty: Difficulty.MEDIUM, durationMinutes: 30, passMark: 50, resultRelease: ResultRelease.INSTANT, timerSettings: defaultTimerSettings, gradingPolicy: defaultGradingPolicy, version: 1 }); setIsCreating(true); }} className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border-4 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 transition-all text-slate-400">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-3xl mb-4 shadow-inner">+</div>
                <span className="font-black uppercase text-[10px] tracking-widest">New Assessment</span>
              </div>
              {exams.map(exam => (
                <div key={exam.id} className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border-4 border-slate-50 dark:border-slate-800 shadow-sm flex flex-col justify-between group hover:border-indigo-100 transition-all">
                  <div>
                    <h4 className="font-black text-2xl uppercase tracking-tighter mb-1 line-clamp-1">{exam.title}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{exam.questions.length} Items &bull; {exam.totalPoints} PTS</p>
                  </div>
                  <div className="flex gap-2 mt-8">
                    <button onClick={() => { setEditingExam(exam); setIsCreating(true); }} className="flex-1 bg-slate-100 dark:bg-slate-800 py-3 rounded-xl font-black uppercase text-[9px] hover:bg-indigo-600 hover:text-white transition-all">Modify</button>
                    <button onClick={() => onPreviewExam(exam)} className="flex-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 py-3 rounded-xl font-black uppercase text-[9px] hover:bg-indigo-600 hover:text-white transition-all">Live Preview</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] shadow-2xl border dark:border-slate-800 overflow-hidden animate-in zoom-in-95">
              <div className="p-10 bg-slate-50 dark:bg-slate-950 border-b flex justify-between items-center">
                <h3 className="text-2xl font-black uppercase tracking-tighter">Architect Mode</h3>
                <div className="flex gap-3">
                  <button onClick={() => setIsCreating(false)} className="bg-red-50 text-red-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase">Cancel</button>
                </div>
              </div>

              {/* Conditional AI Architect Tool */}
              {systemSettings.aiEnabled && (
                <div className="p-10 bg-indigo-50/50 dark:bg-indigo-900/10 border-b-4 border-indigo-100 dark:border-indigo-900/40">
                  <div className="flex gap-4">
                    <input
                      type="text"
                      placeholder="AI Blueprint: Topic for automated item generation..."
                      value={aiContext}
                      onChange={e => setAiContext(e.target.value)}
                      className="flex-grow bg-white dark:bg-slate-800 p-5 rounded-2xl outline-none border-2 border-indigo-100 dark:border-indigo-900/40 font-bold text-sm"
                    />
                    <button
                      onClick={handleAiBuild}
                      disabled={isGenerating || !aiContext}
                      className="bg-indigo-600 text-white px-10 rounded-2xl font-black uppercase text-[10px] tracking-widest disabled:opacity-50"
                    >
                      {isGenerating ? 'Building...' : 'AI Generate'}
                    </button>
                  </div>
                </div>
              )}

              <div className="p-10 space-y-12 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Protocol Title</label>
                    <input type="text" value={editingExam.title} onChange={e => setEditingExam({ ...editingExam, title: e.target.value })} className="w-full text-4xl font-black outline-none border-b-4 border-slate-100 dark:bg-transparent dark:border-slate-800 focus:border-indigo-600 transition-all" placeholder="Assessment Name" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Pass %</label>
                      <input type="number" value={editingExam.passMark} onChange={e => setEditingExam({ ...editingExam, passMark: parseInt(e.target.value) })} className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl font-black outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Duration</label>
                      <input type="number" value={editingExam.durationMinutes} onChange={e => setEditingExam({ ...editingExam, durationMinutes: parseInt(e.target.value) })} className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl font-black outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Release</label>
                      <select value={editingExam.resultRelease} onChange={e => setEditingExam({ ...editingExam, resultRelease: e.target.value as ResultRelease })} className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl font-black text-[10px] uppercase outline-none">
                        <option value={ResultRelease.INSTANT}>Instant</option>
                        <option value={ResultRelease.DELAYED}>Delayed</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-10 bg-slate-50 dark:bg-slate-950 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase text-slate-400">Negative Penalty</label>
                      <button
                        onClick={() => setEditingExam({ ...editingExam, gradingPolicy: { ...editingExam.gradingPolicy!, negativeMarkingEnabled: !editingExam.gradingPolicy?.negativeMarkingEnabled } })}
                        className={`w-12 h-6 rounded-full p-1 transition-all ${editingExam.gradingPolicy?.negativeMarkingEnabled ? 'bg-red-500' : 'bg-slate-300'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full transition-all ${editingExam.gradingPolicy?.negativeMarkingEnabled ? 'translate-x-6' : ''}`}></div>
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Applies only to MCQ/SBA. Theory autograding uses rubric alignment.</p>
                  </div>

                  {editingExam.gradingPolicy?.negativeMarkingEnabled && (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Deduction / Error</label>
                        <input
                          type="number"
                          step="0.05"
                          value={editingExam.gradingPolicy.negativeMarksPerQuestion}
                          onChange={e => setEditingExam({ ...editingExam, gradingPolicy: { ...editingExam.gradingPolicy!, negativeMarksPerQuestion: parseFloat(e.target.value) } })}
                          className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl font-black outline-none border-2 border-slate-100 dark:border-slate-700"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Global Cap</label>
                        <input
                          type="number"
                          value={editingExam.gradingPolicy.maxNegativeDeduction}
                          onChange={e => setEditingExam({ ...editingExam, gradingPolicy: { ...editingExam.gradingPolicy!, maxNegativeDeduction: parseInt(e.target.value) } })}
                          className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl font-black outline-none border-2 border-slate-100 dark:border-slate-700"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-8">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xl font-black uppercase tracking-tighter">Item Pipeline ({editingExam.questions?.length || 0})</h4>
                    <button onClick={() => setEditingExam({ ...editingExam, questions: [...(editingExam.questions || []), { id: uuidv4(), type: QuestionType.MCQ, text: '', options: ['', '', '', ''], correctAnswer: '', points: 10 }] })} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg">+ Manual Item</button>
                  </div>
                  {editingExam.questions?.map((q, idx) => (
                    <div key={q.id} className="p-8 bg-slate-50 dark:bg-slate-950 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 group relative">
                      <button onClick={() => setEditingExam({ ...editingExam, questions: editingExam.questions?.filter(item => item.id !== q.id) })} className="absolute top-6 right-6 text-red-300 hover:text-red-500">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                      <div className="flex gap-4 mb-6">
                        <span className="bg-indigo-600 text-white px-4 py-1 rounded-xl text-[10px] font-black uppercase">Item {idx + 1}</span>
                        <select value={q.type} onChange={e => {
                          const updated = [...editingExam.questions!];
                          updated[idx].type = e.target.value as QuestionType;
                          setEditingExam({ ...editingExam, questions: updated });
                        }} className="bg-white dark:bg-slate-800 px-3 py-1 rounded-xl text-[9px] font-black uppercase">
                          <option value={QuestionType.MCQ}>MCQ</option>
                          <option value={QuestionType.SBA}>SBA</option>
                          <option value={QuestionType.THEORY}>THEORY</option>
                        </select>
                      </div>
                      <textarea value={q.text} onChange={e => {
                        const updated = [...editingExam.questions!];
                        updated[idx].text = e.target.value;
                        setEditingExam({ ...editingExam, questions: updated });
                      }} className="w-full bg-white dark:bg-slate-900 p-6 rounded-2xl border-none outline-none font-bold text-lg min-h-[80px]" placeholder="Question context..." />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        {q.type !== QuestionType.THEORY ? (
                          <>
                            {q.options?.map((opt, oIdx) => (
                              <input key={oIdx} type="text" value={opt} onChange={e => {
                                const updated = [...editingExam.questions!];
                                const newOpts = [...updated[idx].options!];
                                newOpts[oIdx] = e.target.value;
                                updated[idx].options = newOpts;
                                setEditingExam({ ...editingExam, questions: updated });
                              }} className="bg-white dark:bg-slate-900 p-4 rounded-xl text-xs font-bold border dark:border-slate-800" placeholder={`Option ${String.fromCharCode(65 + oIdx)}`} />
                            ))}
                            <div className="md:col-span-2 flex gap-4">
                              <input type="text" value={q.correctAnswer} onChange={e => {
                                const updated = [...editingExam.questions!];
                                updated[idx].correctAnswer = e.target.value.toUpperCase();
                                setEditingExam({ ...editingExam, questions: updated });
                              }} className="flex-grow bg-green-50 dark:bg-green-900/10 p-4 rounded-xl text-xs font-black text-green-700" placeholder="Correct Key" />
                              <input type="number" value={q.points} onChange={e => {
                                const updated = [...editingExam.questions!];
                                updated[idx].points = parseInt(e.target.value);
                                setEditingExam({ ...editingExam, questions: updated });
                              }} className="w-24 bg-slate-100 dark:bg-slate-800 p-4 rounded-xl font-black text-center" />
                            </div>
                          </>
                        ) : (
                          <div className="md:col-span-2 space-y-4">
                            <textarea value={q.correctAnswer} onChange={e => {
                              const updated = [...editingExam.questions!];
                              updated[idx].correctAnswer = e.target.value;
                              setEditingExam({ ...editingExam, questions: updated });
                            }} className="w-full bg-green-50 dark:bg-green-900/10 p-6 rounded-2xl outline-none text-sm font-medium" placeholder="Expected Rubric Content..." />
                            <div className="flex justify-end">
                              <input type="number" value={q.points} onChange={e => {
                                const updated = [...editingExam.questions!];
                                updated[idx].points = parseInt(e.target.value);
                                setEditingExam({ ...editingExam, questions: updated });
                              }} className="w-24 bg-slate-100 dark:bg-slate-800 p-4 rounded-xl font-black text-center" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-10 bg-slate-900 flex justify-end">
                <button onClick={handleSave} className="bg-indigo-600 text-white px-20 py-5 rounded-[2rem] font-black uppercase text-sm shadow-2xl">Finalize Protocol</button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'submissions' && (
        <div className="px-4 space-y-8">
          <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] shadow-sm flex flex-col md:flex-row gap-8 justify-between items-center">
            <input type="text" placeholder="Search transcripts..." value={submissionFilter} onChange={e => setSubmissionFilter(e.target.value)} className="w-full md:max-w-md bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl font-black text-xs uppercase" />
            <div className="flex gap-4">
              <button onClick={onReleaseAllDelayedResults} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase">Release Delayed</button>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] border dark:border-slate-800 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 text-[10px] font-black uppercase">
                <tr>
                  <th className="px-10 py-6">ID</th>
                  <th className="px-10 py-6">Candidate</th>
                  <th className="px-10 py-6">Assessment</th>
                  <th className="px-10 py-6">Score</th>
                  <th className="px-10 py-6">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {filteredSubmissions.map(sub => {
                  const exam = exams.find(e => e.id === sub.examId);
                  const student = users.find(u => u.id === sub.studentId);
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-10 py-8 text-[10px] font-mono text-slate-400">{sub.id.slice(0, 8)}</td>
                      <td className="px-10 py-8">
                        <p className="font-black uppercase text-xs">{student?.name || 'Unknown'}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{student?.email}</p>
                      </td>
                      <td className="px-10 py-8 font-bold text-xs">{exam?.title}</td>
                      <td className="px-10 py-8">
                        <span className={`font-black text-xl ${sub.score >= (exam?.passMark || 50) ? 'text-indigo-600' : 'text-red-600'}`}>{sub.score.toFixed(1)}</span>
                      </td>
                      <td className="px-10 py-8">
                        <button onClick={() => setSelectedSubmission({ sub, exam: exam! })} className="text-[10px] font-black text-indigo-600 uppercase">View Transcript</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="px-4 space-y-8">
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] border dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-10 border-b dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-xl font-black uppercase tracking-tighter">Candidate Registry</h3>
            </div>
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 text-[10px] font-black uppercase">
                <tr>
                  <th className="px-10 py-6">Name</th>
                  <th className="px-10 py-6">Email</th>
                  <th className="px-10 py-6">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-10 py-8 font-black uppercase text-xs">{u.name}</td>
                    <td className="px-10 py-8 text-xs text-slate-500">{u.email}</td>
                    <td className="px-10 py-8">
                      <span className={`px-4 py-1.5 rounded-xl text-[8px] font-black uppercase ${u.role === UserRole.SUPERADMIN ? 'bg-indigo-600 text-white' :
                        u.role === UserRole.ADMIN ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                        {u.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedSubmission && (
        <SubmissionDetailModal submission={selectedSubmission.sub} exam={selectedSubmission.exam} onClose={() => setSelectedSubmission(null)} systemSettings={systemSettings} isAdmin={true} onManualGrade={(qId, res) => onManualGrade(selectedSubmission.sub.id, qId, res)} />
      )}
    </div>
  );
};

export default AdminDashboard;
