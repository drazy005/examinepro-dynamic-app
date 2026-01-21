
import React, { useState, useEffect, useCallback } from 'react';
import { User, Exam, Submission, UserRole, BlogPost, ExamTemplate, Question, DatabaseConfig } from './services/types';
import Layout from './components/Layout';
import AdminDashboard from './components/AdminDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import StudentDashboard from './components/StudentDashboard';
import ExamInterface from './components/ExamInterface';
import Auth from './components/Auth';
import { initializeCspMonitoring } from './services/securityService';
import { useSystem } from './services/SystemContext';
import { api } from './services/api';
import { useToast } from './services/ToastContext';

const App: React.FC = () => {
  const { branding, isDarkMode, toggleDarkMode } = useSystem();
  const { addToast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [isAdminPreview, setIsAdminPreview] = useState(false);
  const [announcements, setAnnouncements] = useState<BlogPost[]>([]);

  // Local admin states (not part of core data hooks)
  const [templates, setTemplates] = useState<ExamTemplate[]>([]);
  const [questionBank, setQuestionBank] = useState<Question[]>([]);
  const [dbConfigs, setDbConfigs] = useState<DatabaseConfig[]>([]);

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

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    // Fetch announcements on login
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
          questionBank={questionBank}
          templates={templates}
          onPreviewExam={e => { setActiveExam(e); setIsAdminPreview(true); }}
        />;
      case UserRole.BASIC:
        return <StudentDashboard
          announcements={announcements.filter(p => p.published)}
          onTakeExam={e => setActiveExam(e)}
        />;
      default:
        console.warn('Unknown Role Encountered:', user.role);
        return (
          <div className="flex flex-col items-center justify-center p-10 text-center space-y-4">
            <div className="text-6xl">🤔</div>
            <h2 className="text-xl font-bold">Account Setup Incomplete</h2>
            <p>Your account role <code>{user.role}</code> is not recognized.</p>
            <button onClick={handleLogout} className="text-indigo-600 hover:underline">Logout</button>
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
