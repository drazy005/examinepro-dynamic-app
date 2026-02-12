
import React, { useState, useEffect, useCallback } from 'react';
import { User, Exam, Submission, UserRole, BlogPost, ExamTemplate, Question, DatabaseConfig, QuestionResult, GradingStatus } from './services/types';
import Layout from './components/Layout';
import AdminDashboard from './components/AdminDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import CandidatePortal from './components/CandidatePortal';
import ExamInterface from './components/ExamInterface';
import SubmissionDetailModal from './components/SubmissionDetailModal';
import Auth from './components/Auth';
import { initializeCspMonitoring } from './services/securityService';
import { useSystem } from './services/SystemContext';
import { api } from './services/api';
import { useToast } from './services/ToastContext';
import { useQuestions } from './hooks/useQuestions';
import { useExams } from './hooks/useExams';
import DebugPage from './components/DebugPage';



const App: React.FC = () => {
  const { branding, isDarkMode, toggleDarkMode, refreshSettings } = useSystem();
  const { addToast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [activeSubmission, setActiveSubmission] = useState<{ id: string, answers: any, startTime: number } | null>(null);
  const [isAdminPreview, setIsAdminPreview] = useState(false);
  const [announcements, setAnnouncements] = useState<BlogPost[]>([]);
  const [candidateTab, setCandidateTab] = useState<'available' | 'history'>('available');
  const [superAdminViewKey, setSuperAdminViewKey] = useState(0);

  // Local admin states
  const [templates, setTemplates] = useState<ExamTemplate[]>([]);
  const [dbConfigs, setDbConfigs] = useState<DatabaseConfig[]>([]);

  // Hooks
  const { questions: fetchedQuestions, saveQuestion, deleteQuestion, refreshQuestions } = useQuestions();
  const { exams, saveExam, deleteExam, bulkDeleteExams, refreshExams } = useExams();

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
          // Prevent unnecessary re-renders if user data is same
          setUser(prev => {
            if (JSON.stringify(prev) === JSON.stringify(currentUser)) return prev;
            return currentUser;
          });
          const announcementsData = await api.admin.announcements.list();
          setAnnouncements(announcementsData);
          refreshSettings(); // Sync settings (including superadmin keys if applicable)
        } else {
          setUser(null);
        }
      } catch (e: any) {
        // Only logout on Auth errors, not network/server errors
        const msg = e.message || '';
        if (msg.includes('Unauthorized') || msg.includes('Forbidden') || msg.includes('401') || msg.includes('403')) {
          setUser(null);
        } else {
          console.error("Session check failed (network/server):", e);
          // Keep loading false, but don't logout user if they were logged in? 
          // Actually if we don't know, maybe best to stay put or retry?
          // For now, let's assume if me() fails, we might be offline. 
          // If we were already logged in, keep it? 
          // But valid token might be gone.
        }
      } finally {
        setIsLoading(false);
        initializeCspMonitoring();
      }
    };
    checkSession();
  }, [handleLogout]);

  useEffect(() => {
    if (!user) return;
    const role = user.role ? user.role.toUpperCase() : '';
    console.log(`[App] Checking data load for role: ${user.role} (Normalized: ${role})`);

    // Accept standard roles including mixed case
    if (['ADMIN', 'SUPERADMIN', 'CANDIDATE'].includes(role)) {
      console.log('[App] Refreshing questions and exams...');
      // Pass FALSE to silent param to ensure errors are TOASTED to the user
      refreshQuestions(false).catch(e => console.error("[App] Questions refresh failed:", e));
      refreshExams(false).catch(e => console.error("[App] Exams refresh failed:", e));
    } else {
      console.warn(`[App] Role ${role} not recognized for auto-refresh.`);
    }
  }, [user, refreshQuestions, refreshExams]);

  const handleBulkDeleteQuestions = async (ids: string[]) => {
    try {
      await api.questions.bulkDelete(ids);
      refreshQuestions();
      addToast('Questions deleted', 'success');
    } catch (e) {
      addToast('Failed to delete questions', 'error');
    }
  };

  const handlePurgeQuestions = async (type: string) => {
    try {
      // Manual fetch for purge as it's a specific admin action not in generic api wrapper yet
      await fetch(`/api/questions?mode=purge&type=${type || 'ALL'}`, {
        method: 'DELETE'
      });
      refreshQuestions();
      addToast('Question bank purged', 'success');
    } catch (e) {
      addToast('Failed to purge questions', 'error');
    }
  };

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    api.admin.announcements.list().then(setAnnouncements);
  };

  const handleSubmitExam = async (partialSub: Partial<Submission>) => {
    try {
      if (partialSub.id) {
        await api.submissions.update(partialSub.id, partialSub);
      } else {
        // Fallback or error if no ID
        await api.submissions.create(partialSub);
      }
      addToast('Exam submitted successfully!', 'success');
      setActiveExam(null);
    } catch (e) {
      addToast('Failed to submit exam.', 'error');
    }
  };

  const handleAnnouncementUpdate = async (posts: BlogPost[]) => {
    try {
      const updated = await api.admin.announcements.create(posts);
      setAnnouncements(updated);
      addToast('Announcements updated!', 'success');
    } catch (e) {
      addToast('Failed to update announcements.', 'error');
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await api.admin.announcements.delete(id);
      setAnnouncements(prev => prev.filter(p => p.id !== id));
      addToast('Announcement deleted', 'success');
    } catch (e) {
      addToast('Failed to delete announcement', 'error');
    }
  };

  const handleBulkDeleteAnnouncements = async (ids: string[]) => {
    try {
      await api.admin.announcements.bulkDelete(ids);
      setAnnouncements(prev => prev.filter(p => !ids.includes(p.id)));
      addToast('Announcements deleted', 'success');
    } catch (e) {
      addToast('Failed to delete announcements', 'error');
    }
  };

  const handleTogglePublish = async (id: string, published: boolean) => {
    try {
      // Corrected: separate id and data arguments
      await api.exams.update(id, { published });
      addToast(`Exam ${published ? 'Published' : 'Hidden'}`, 'success');
      refreshExams(); // Update local list
    } catch (e) {
      addToast('Failed to update status', 'error');
    }
  };

  const handleDashboardClick = () => {
    setActiveExam(null); // Exit exam / return to list
    setActiveSubmission(null);
    setIsAdminPreview(false);
    setCandidateTab('available'); // Reset candidate tab
    setSuperAdminViewKey(prev => prev + 1); // Reset SuperAdmin view
  };


  const handleStartExam = async (exam: Exam) => {
    try {
      // 1. Start Attempt (Create/Resume Submission)
      const session = await api.exams.start(exam.id);

      // 2. Use the exam returned by the session if available (it contains questions)
      let fullExam = (session as any).exam || exam;

      // Fallback: Fetch full exam details if questions are still missing
      // Note: Admin preview fetched it above. Candidate start fetched it via session.
      if (!fullExam.questions || fullExam.questions.length === 0) {
        try {
          const fetched = await api.exams.get(exam.id);
          if (fetched && fetched.questions && fetched.questions.length > 0) {
            fullExam = fetched;
          }
        } catch (err) {
          console.error("Fallback fetch failed", err);
        }
      }

      if (!fullExam.questions || fullExam.questions.length === 0) {
        addToast("Error: Exam has no questions.", "error");
        return;
      }

      // Ensure session object has expected properties. 
      // If api.exams.start returns { exam, startTime }, we might need to fetch submission separately?
      // Check return type of api.exams.start in api.ts

      const subId = (session as any).submissionId || (session as any).id;

      setActiveSubmission({
        id: subId,
        answers: (session as any).answersDraft || {},
        startTime: session.startTime
      });
      setActiveExam(fullExam);

      if ((session as any).resumed) {
        addToast('Resumed existing exam session.', 'info');
      }

    } catch (e) {
      addToast("Failed to start exam.", "error");
    }
  };

  const [viewingSubmission, setViewingSubmission] = useState<{ sub: Submission, exam: Exam } | null>(null);

  const handleViewDetails = async (sub: Submission) => {
    try {
      setIsLoading(true);
      // Always fetch the specific submission endpoint to get the full exam snapshot/details securely
      const fullSubmission = await api.submissions.get(sub.id);

      if (!fullSubmission || !fullSubmission.exam) {
        throw new Error("Invalid submission data");
      }

      setViewingSubmission({ sub: fullSubmission, exam: fullSubmission.exam });
    } catch (e) {
      console.error("View Details Error:", e);
      addToast("Failed to load review details. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (activeExam) {
      return <ExamInterface
        exam={activeExam}
        studentId={user!.id}
        submissionId={activeSubmission?.id}
        initialAnswers={activeSubmission?.answers}
        initialStartTime={activeSubmission?.startTime}
        onSubmit={handleSubmitExam}
        onCancel={() => { setActiveExam(null); setActiveSubmission(null); setIsAdminPreview(false); }}
        isAdminPreview={isAdminPreview}
      />;
    }

    switch (user?.role) {
      case UserRole.SUPERADMIN:
        return <SuperAdminDashboard
          key={superAdminViewKey}
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
          questionBank={fetchedQuestions} // Rename to questionBank if needed or keep prop name matching
          templates={templates}
          systemSettings={{ aiEnabled: false } as any} // Placeholder for settings until API ready
          announcements={announcements}

          // Actions
          onSaveExam={saveExam}
          onDeleteExam={deleteExam}
          onBulkDeleteExams={bulkDeleteExams}
          // Submissions/Users/Logs actions are now internal to AdminDashboard

          onAddToBank={saveQuestion}
          onDeleteFromBank={deleteQuestion}

          onSaveTemplate={t => setTemplates(p => [...p, t])} // Local only for MVP
          onDeleteTemplate={id => setTemplates(p => p.filter(t => t.id !== id))}

          onPreviewExam={async e => {
            try {
              const fullExam = await api.exams.get(e.id);
              setActiveExam(fullExam);
              setIsAdminPreview(true);
              setActiveSubmission(null);
            } catch (err) {
              addToast("Failed to load exam for preview", "error");
            }
          }}
          onTogglePublish={handleTogglePublish}
          onBulkDeleteQuestions={handleBulkDeleteQuestions}
          onPurgeQuestions={handlePurgeQuestions}
        />;

      case UserRole.CANDIDATE:
        return <CandidatePortal
          announcements={announcements.filter(p => p.published)}
          onTakeExam={handleStartExam}
          onViewDetails={handleViewDetails}
          activeTab={candidateTab}
          onTabChange={setCandidateTab}
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

  // Maintenance Mode Check
  if (useSystem().settings.maintenanceMode && user.role === UserRole.CANDIDATE) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center">
          <svg className="w-12 h-12 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">System Maintenance</h1>
        <p className="text-slate-500 max-w-md text-lg">
          We are currently performing scheduled maintenance to improve your experience. Please check back shortly.
        </p>
        <button onClick={handleLogout} className="text-indigo-600 font-bold uppercase text-xs hover:underline">Logout</button>
      </div>
    );
  }

  return (
    <Layout user={user} onLogout={handleLogout} isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} branding={branding} onDashboardClick={handleDashboardClick} onMyExamsClick={() => setCandidateTab('history')}>
      {renderContent()}

      {/* Temporary Debug Route: /debug */}
      {window.location.pathname === '/debug' && (
        <div className="fixed inset-0 z-50 bg-white">
          <DebugPage />
        </div>
      )}

      {viewingSubmission && (
        <SubmissionDetailModal
          submission={viewingSubmission.sub}
          exam={viewingSubmission.exam}
          onClose={() => setViewingSubmission(null)}
          systemSettings={useSystem().settings}
          isAdmin={false} // Read-only for candidates
          onManualGrade={() => { }} // No-op
        />
      )}
    </Layout>
  );
};

export default App;
