
import React, { useState, useEffect, useCallback } from 'react';
import { User, Exam, Submission, UserRole, BlogPost, ExamTemplate, Question, DatabaseConfig, QuestionResult, GradingStatus } from './services/types';
import Layout from './components/Layout';
import AdminDashboard from './components/AdminDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import CandidatePortal from './components/CandidatePortal';
import ExamInterface from './components/ExamInterface';
import Auth from './components/Auth';
import { initializeCspMonitoring } from './services/securityService';
import { useSystem } from './services/SystemContext';
import { api } from './services/api';
import { useToast } from './services/ToastContext';
import { useQuestions } from './hooks/useQuestions';
import { useExams } from './hooks/useExams';
import { useSubmissions } from './hooks/useSubmissions';
import { useUsers } from './hooks/useUsers';

const App: React.FC = () => {
  const { branding, isDarkMode, toggleDarkMode } = useSystem();
  const { addToast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [isAdminPreview, setIsAdminPreview] = useState(false);
  const [announcements, setAnnouncements] = useState<BlogPost[]>([]);

  // Local admin states
  const [templates, setTemplates] = useState<ExamTemplate[]>([]);
  const [dbConfigs, setDbConfigs] = useState<DatabaseConfig[]>([]);

  // Hooks
  const { questions: fetchedQuestions, saveQuestion, deleteQuestion, refreshQuestions } = useQuestions();
  const { exams, saveExam, deleteExam, bulkDeleteExams } = useExams();
  const { submissions, updateSubmission, bulkDeleteSubmissions } = useSubmissions();
  const { users } = useUsers();

  const handleLogout = useCallback(async () => {
    await api.auth.logout();
    setUser(null);
    setActiveExam(null);
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      setIsLoading(true);
      try {
        const currentUser = await api.auth.me();
        if (currentUser) {
          setUser(currentUser);
          const announcementsData = await api.admin.getAnnouncements();
          setAnnouncements(announcementsData);
        }
      } catch (e) {
        setUser(null);
      } finally {
        setIsLoading(false);
        initializeCspMonitoring();
      }
    };
    checkSession();
  }, [handleLogout]);

  useEffect(() => {
    if (user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERADMIN) {
      refreshQuestions();
    }
  }, [user, refreshQuestions]);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    api.admin.getAnnouncements().then(setAnnouncements);
  };

  const handleSubmitExam = async (partialSub: Partial<Submission>) => {
    try {
      await api.submissions.save(partialSub as Submission);
      addToast('Exam submitted successfully!', 'success');
      setActiveExam(null);
    } catch (e) {
      addToast('Failed to submit exam.', 'error');
    }
  };

  const handleAnnouncementUpdate = async (posts: BlogPost[]) => {
    try {
      const updated = await api.admin.updateAnnouncements(posts);
      setAnnouncements(updated);
      addToast('Announcements updated!', 'success');
    } catch (e) {
      addToast('Failed to update announcements.', 'error');
    }
  };

  // Handlers for Admin Dashboard
  const handleManualGrade = async (submissionId: string, questionId: string, result: QuestionResult) => {
    const sub = submissions.find(s => s.id === submissionId);
    if (!sub) return;

    const updatedResults = { ...sub.questionResults, [questionId]: result };

    // Recalculate Score
    // Needs to fetch the exam to know points? 
    // Ideally backend handles recalc, but for now we trust the frontend update logic or just save the result map.
    // Simplest: Just update the result map and let backend or UI sum it up. 
    // Wait, we need to update score in DB.
    // Let's assume grading update logic is complex and done mostly client side in 'onManualGrade' before calling this?
    // AdminDashboard's onManualGrade usually just updates the state. We need to save it.

    let newScore = Object.values(updatedResults).reduce((acc, r) => acc + (r.score || 0), 0);

    const newSub: Submission = {
      ...sub,
      questionResults: updatedResults,
      score: newScore,
      gradingStatus: GradingStatus.GRADED // Or partial? Assume manually graded means done.
    };

    await updateSubmission(newSub);
    addToast('Grade updated', 'success');
  };

  const handleReleaseResults = async (examId: string) => {
    // Find all submissions for this exam and update correct release field
    // This is heavy. Ideally a backend endpoint: POST /api/exams/:id/release-results
    // for now, we loop submissions on client (MVP).
    const subs = submissions.filter(s => s.examId === examId);
    await Promise.all(subs.map(s => updateSubmission({ ...s, resultsReleased: true })));
    addToast('All results released for this exam', 'success');
  };

  const handleReleaseSingleSubmission = async (id: string) => {
    const sub = submissions.find(s => s.id === id);
    if (sub) {
      await updateSubmission({ ...sub, resultsReleased: true });
      addToast('Result released to candidate', 'success');
    }
  };

  const renderContent = () => {
    if (activeExam) {
      return <ExamInterface
        exam={activeExam}
        studentId={user!.id}
        onSubmit={handleSubmitExam}
        onCancel={() => { setActiveExam(null); setIsAdminPreview(false); }}
        isAdminPreview={isAdminPreview}
      />;
    }

    switch (user?.role) {
      case UserRole.SUPERADMIN:
        return <SuperAdminDashboard
          dbConfigs={dbConfigs}
          announcements={announcements}
          onUpdateAnnouncements={handleAnnouncementUpdate}
          onSaveDbConfig={c => setDbConfigs(p => p.some(x => x.id === c.id) ? p.map(x => x.id === c.id ? c : x) : [c, ...p])}
          onDeleteDbConfig={id => setDbConfigs(p => p.filter(x => x.id !== id))}
        />;

      case UserRole.ADMIN:
        return <AdminDashboard
          // Data Props
          exams={exams}
          submissions={submissions}
          users={users}
          questionBank={fetchedQuestions}
          templates={templates}
          systemSettings={{ aiEnabled: false } as any} // Placeholder for settings until API ready

          // Actions
          onSaveExam={saveExam}
          onDeleteExam={deleteExam}
          onBulkDeleteExams={bulkDeleteExams}
          onBulkDeleteSubmissions={bulkDeleteSubmissions}

          onAddToBank={saveQuestion}
          onUpdateBankQuestion={(id, q) => saveQuestion(q)}
          onDeleteFromBank={deleteQuestion}

          onManualGrade={handleManualGrade}
          onReleaseResults={handleReleaseResults}
          onReleaseSingleSubmission={handleReleaseSingleSubmission}
          onReleaseAllDelayedResults={() => { }} // Placeholder or impl similar to ReleaseResults

          onAIGradeSubmission={async () => { addToast('AI Grading not enabled', 'info'); }}

          onSaveTemplate={t => setTemplates(p => [...p, t])} // Local only for MVP
          onDeleteTemplate={id => setTemplates(p => p.filter(t => t.id !== id))}

          onPreviewExam={e => { setActiveExam(e); setIsAdminPreview(true); }}
        />;

      case UserRole.CANDIDATE:
        return <CandidatePortal
          announcements={announcements.filter(p => p.published)}
          onTakeExam={e => setActiveExam(e)}
        />;

      default:
        return (
          <div className="flex flex-col items-center justify-center p-10 text-center space-y-4">
            <h2 className="text-xl font-bold">Role Error</h2>
            <p>Your role <code>{user?.role}</code> is unrecognized or lacks permissions.</p>
            <button onClick={handleLogout} className="text-red-600 hover:underline">Logout</button>
          </div>
        );
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  }

  if (!user) {
    return <Auth onLogin={handleLogin} onRegister={() => { }} />;
  }

  return (
    <Layout user={user} onLogout={handleLogout} isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} branding={branding}>
      {renderContent()}
    </Layout>
  );
};

export default App;
