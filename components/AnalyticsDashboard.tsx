import React, { useMemo } from 'react';
import { Exam, Submission, User } from '../services/types';

interface AnalyticsDashboardProps {
    exams: Exam[];
    submissions: Submission[];
    users: User[];
    onPreviewExam: (exam: Exam) => void;
    onViewSubmission: (sub: Submission, exam: Exam) => void;
    onExamReviewed: (id: string) => void;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ exams, submissions, users, onPreviewExam, onViewSubmission, onExamReviewed }) => {
    const [reviewExamId, setReviewExamId] = React.useState<string | null>(null);

    const stats = useMemo(() => {
        const totalExams = exams.length;
        const totalSubmissions = submissions.length;
        const totalStudents = users.filter(u => u.role === 'CANDIDATE').length;

        // Pass/Fail Rates
        let passed = 0;
        let failed = 0;

        // Exam specific stats
        const examStats = exams.map(exam => {
            const examSubs = submissions.filter(s => s.examId === exam.id);
            const subCount = examSubs.length;
            const avgScore = subCount > 0 ? examSubs.reduce((acc, s) => acc + s.score, 0) / subCount : 0;
            const passCount = examSubs.filter(s => (s.score / exam.totalPoints * 100) >= exam.passMark).length;

            passed += passCount;
            failed += (subCount - passCount);

            return {
                id: exam.id,
                title: exam.title,
                count: subCount,
                avg: avgScore,
                passRate: subCount > 0 ? (passCount / subCount) * 100 : 0,
                reviewed: exam.reviewed // Include reviewed status
            };
        }).sort((a, b) => b.count - a.count); // Most popular first

        return { totalExams, totalSubmissions, totalStudents, passed, failed, examStats };
    }, [exams, submissions, users]);

    const reviewExam = useMemo(() => {
        if (!reviewExamId) return null;
        return exams.find(e => e.id === reviewExamId);
    }, [exams, reviewExamId]);

    const reviewSubmissions = useMemo(() => {
        if (!reviewExamId) return [];
        return submissions.filter(s => s.examId === reviewExamId);
    }, [submissions, reviewExamId]);

    return (
        <div className="px-4 space-y-8 animate-in fade-in slide-in-from-bottom-4">
            {/* Top Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-6 bg-white dark:bg-slate-900 theme-rounded shadow-sm">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Total Exams</h3>
                    <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{stats.totalExams}</p>
                </div>
                <div className="p-6 bg-white dark:bg-slate-900 theme-rounded shadow-sm">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Active Candidates</h3>
                    <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{stats.totalStudents}</p>
                </div>
                <div className="p-6 bg-white dark:bg-slate-900 theme-rounded shadow-sm">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Total Attempts</h3>
                    <p className="text-3xl font-black text-indigo-600">{stats.totalSubmissions}</p>
                </div>
                <div className="p-6 bg-white dark:bg-slate-900 theme-rounded shadow-sm">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Overall Pass Rate</h3>
                    <p className="text-3xl font-black text-emerald-500">
                        {stats.totalSubmissions > 0 ? ((stats.passed / stats.totalSubmissions) * 100).toFixed(1) : 0}%
                    </p>
                </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="bg-white dark:bg-slate-900 p-8 theme-rounded shadow-sm">
                <h2 className="font-black text-xl uppercase mb-6">Performance by Exam</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                <th className="p-4">Exam Title</th>
                                <th className="p-4 text-center">Candidates</th>
                                <th className="p-4 text-center">Avg Score</th>
                                <th className="p-4 text-center">Pass Rate</th>
                                <th className="p-4 text-left">Status</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            {stats.examStats.map(stat => (
                                <tr key={stat.id} className="border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="p-4">{stat.title}</td>
                                    <td className="p-4 text-center">{stat.count}</td>
                                    <td className="p-4 text-center">{stat.avg.toFixed(1)}</td>
                                    <td className="p-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500" style={{ width: `${stat.passRate}%` }}></div>
                                            </div>
                                            <span className="text-xs">{stat.passRate.toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        {(stat as any).reviewed ? (
                                            <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                Reviewed
                                            </span>
                                        ) : stat.passRate > 80 ? (
                                            <span className="text-emerald-500 text-[10px] uppercase">Excellent</span>
                                        ) : stat.passRate < 50 ? (
                                            <button
                                                onClick={() => setReviewExamId(stat.id)}
                                                className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-1 rounded text-[10px] uppercase font-black hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors cursor-pointer"
                                            >
                                                Needs Review
                                            </button>
                                        ) : (
                                            <span className="text-orange-500 text-[10px] uppercase">Average</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Review Modal */}
            {reviewExam && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                            <div>
                                <h3 className="font-black text-lg uppercase">Exam Review</h3>
                                <p className="text-sm text-slate-500">{reviewExam.title}</p>
                            </div>
                            <button onClick={() => setReviewExamId(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            <div className="flex gap-4">
                                <button
                                    onClick={() => onPreviewExam(reviewExam)}
                                    className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold uppercase text-xs shadow-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    Preview Exam Content
                                </button>
                                <button
                                    onClick={() => {
                                        onExamReviewed(reviewExam.id);
                                        setReviewExamId(null);
                                    }}
                                    className="flex-1 bg-emerald-600 text-white px-4 py-3 rounded-xl font-bold uppercase text-xs shadow-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    Mark as Reviewed
                                </button>
                            </div>

                            <div>
                                <h4 className="font-black text-xs uppercase text-slate-400 tracking-widest mb-4">Candidate Submissions</h4>
                                <div className="space-y-2">
                                    {reviewSubmissions.length === 0 ? (
                                        <p className="text-sm text-slate-500 italic">No submissions found for this exam.</p>
                                    ) : (
                                        reviewSubmissions.map(sub => {
                                            const studentName = sub.user?.name || users.find(u => u.id === sub.userId)?.name || 'Unknown Candidate';
                                            const grade = (sub.score / reviewExam.totalPoints * 100);
                                            return (
                                                <div
                                                    key={sub.id}
                                                    onClick={() => onViewSubmission(sub, reviewExam)}
                                                    className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-700 cursor-pointer transition-colors border border-transparent hover:border-indigo-200 group"
                                                >
                                                    <div>
                                                        <p className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-indigo-700 text-left">{studentName}</p>
                                                        <p className="text-xs text-slate-500">{new Date(sub.submittedAt).toLocaleDateString()}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`font-black text-lg ${grade < reviewExam.passMark ? 'text-red-500' : 'text-emerald-500'}`}>
                                                            {grade.toFixed(0)}%
                                                        </span>
                                                        <p className="text-[10px] font-bold uppercase text-slate-400">{grade < reviewExam.passMark ? 'Fail' : 'Pass'}</p>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalyticsDashboard;
