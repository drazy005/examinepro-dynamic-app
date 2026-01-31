import React, { useMemo } from 'react';
import { Exam, Submission, User } from '../services/types';

interface AnalyticsDashboardProps {
    exams: Exam[];
    submissions: Submission[];
    users: User[];
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ exams, submissions, users }) => {

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
                passRate: subCount > 0 ? (passCount / subCount) * 100 : 0
            };
        }).sort((a, b) => b.count - a.count); // Most popular first

        return { totalExams, totalSubmissions, totalStudents, passed, failed, examStats };
    }, [exams, submissions, users]);

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
                                        {stat.passRate > 80 ? (
                                            <span className="text-emerald-500 text-[10px] uppercase">Excellent</span>
                                        ) : stat.passRate < 50 ? (
                                            <span className="text-red-500 text-[10px] uppercase">Needs Review</span>
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
        </div>
    );
};

export default AnalyticsDashboard;
