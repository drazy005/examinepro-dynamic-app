
import React, { useState, useMemo, useEffect, memo } from 'react';
import { Exam, Submission, ResultRelease, Difficulty, BlogPost, SystemSettings } from '../services/types';
import SubmissionDetailModal from './SubmissionDetailModal';
import { useSystem } from '../services/SystemContext';
import { useExams } from '../hooks/useExams';
import { useSubmissions } from '../hooks/useSubmissions';

interface StudentDashboardProps {
  announcements: BlogPost[];
  onTakeExam: (exam: Exam) => void;
}

const StudentDashboard: React.FC<StudentDashboardProps> = memo(({ announcements, onTakeExam }) => {
  const { settings: systemSettings } = useSystem();
  const { exams } = useExams();
  const { submissions } = useSubmissions();

  const [selectedSubmission, setSelectedSubmission] = useState<{ sub: Submission, exam: Exam } | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const publishedExams = useMemo(() => exams.filter(e => e.published).map(e => ({ ...e, questions: e.questions.map(q => ({ ...q, correctAnswer: 'HIDDEN' })) })), [exams]);

  const stats = useMemo(() => {
    const totalSub = submissions.length;
    if (totalSub === 0) return { avg: 0, completion: 0, totalPoints: 0, highestScore: 0 };

    let totalAchieved = 0;
    let totalPossible = 0;
    let highest = 0;

    submissions.forEach(s => {
      const e = exams.find(ex => ex.id === s.examId);
      const possible = e?.totalPoints || 1;
      totalAchieved += s.score;
      totalPossible += possible;
      const pct = (s.score / possible) * 100;
      if (pct > highest) highest = Math.round(pct);
    });

    const avg = totalPossible > 0 ? Math.round((totalAchieved / totalPossible) * 100) : 0;
    const completion = Math.round((totalSub / (exams.filter(e => e.published).length || 1)) * 100);

    return { avg, completion, totalPoints: totalAchieved, highestScore: highest };
  }, [submissions, exams]);

  const getExamStatus = (exam: Exam) => {
    if (exam.scheduledReleaseDate && new Date(exam.scheduledReleaseDate).getTime() > now) return 'Upcoming';
    // Removed fixedEndTime check as it is not in type definition
    return 'Available';
  };

  const getTimeRemaining = (timestamp: number) => {
    const diff = timestamp - now;
    if (diff <= 0) return 'Ready';
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${hours}h ${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-16 pb-24 animate-in fade-in duration-700">
      {announcements.length > 0 && (
        <section className="space-y-8 px-4">
          <div className="flex justify-between items-center">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">System Announcements</h3>
          </div>
          <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide">
            {announcements.map(post => (
              <div key={post.id} className="min-w-[320px] md:min-w-[450px] bg-white dark:bg-slate-900 p-8 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all group shrink-0">
                <span className="text-[9px] font-black uppercase text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-lg mb-4 inline-block tracking-widest">Notice</span>
                <h4 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight mb-2 group-hover:text-indigo-600 transition-colors line-clamp-1">{post.title}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-6 font-medium leading-relaxed uppercase tracking-tight">{post.content}</p>
                <div className="flex items-center justify-between border-t dark:border-slate-800 pt-6">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Posted by {post.authorName}</span>
                  </div>
                  <span className="text-[9px] font-black text-slate-300 uppercase">{new Date(post.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="px-4">
        <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-8">Available Exams</h3>

        {publishedExams.length === 0 ? (
          <div className="p-10 text-center bg-slate-100 dark:bg-slate-900 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
            <p className="text-lg font-bold text-slate-400 uppercase tracking-widest">No exams available at this time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {publishedExams.map(exam => {
              const status = getExamStatus(exam);
              const isAvailable = status === 'Available';
              const previousSub = submissions.find(s => s.examId === exam.id);

              return (
                <div key={exam.id} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-indigo-100 dark:hover:border-slate-700 transition-all flex flex-col group">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${isAvailable ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      status === 'Upcoming' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                      {status}
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{exam.durationMinutes} Mins</span>
                  </div>

                  <h4 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2 group-hover:text-indigo-600 transition-colors line-clamp-1">{exam.title}</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium leading-relaxed line-clamp-2">{exam.description || 'No description provided.'}</p>

                  <div className="mt-auto pt-6 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      {status === 'Upcoming' && exam.scheduledReleaseDate && (
                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Opens in {getTimeRemaining(new Date(exam.scheduledReleaseDate).getTime())}</span>
                      )}
                      {previousSub && (
                        <span className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest">Score: {previousSub.score}/{exam.totalPoints}</span>
                      )}
                    </div>

                    {previousSub ? (
                      <button
                        onClick={() => setSelectedSubmission({ sub: previousSub, exam })}
                        className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        Review
                      </button>
                    ) : (
                      <button
                        disabled={!isAvailable}
                        onClick={() => onTakeExam(exam)}
                        className="px-8 py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:brightness-110 disabled:opacity-20 disabled:cursor-not-allowed shadow-lg transition-all active:scale-95"
                      >
                        Start Exam
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* History Section */}
      {submissions.length > 0 && (
        <section className="px-4">
          <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-8">Recent Activity</h3>
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 overflow-hidden">
            {submissions.slice(0, 5).map((sub, idx) => {
              const exam = exams.find(e => e.id === sub.examId);
              return (
                <div key={sub.id} className={`p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${idx !== 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''}`}>
                  <div>
                    <h5 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">{exam?.title || 'Unknown Exam'}</h5>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Submitted {new Date(sub.submittedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span className="block text-2xl font-black text-indigo-600 dark:text-indigo-400">{sub.score}</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Points</span>
                    </div>
                    <button
                      onClick={() => exam && setSelectedSubmission({ sub, exam })}
                      className="px-6 py-3 border-2 border-slate-100 dark:border-slate-800 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-white dark:hover:bg-slate-800 transition-colors"
                    >
                      Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {selectedSubmission && (
        <SubmissionDetailModal
          submission={selectedSubmission.sub}
          exam={selectedSubmission.exam}
          onClose={() => setSelectedSubmission(null)}
        />
      )}
    </div>
  );
});

export default StudentDashboard;
