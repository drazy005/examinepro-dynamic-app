import React, { useState, useEffect } from 'react';
import { BlogPost, Exam, Submission, UserRole } from '../services/types';
import { api } from '../services/api';
import { format } from 'date-fns';

interface CandidatePortalProps {
    announcements: BlogPost[];
    onTakeExam: (exam: Exam) => void;
}

const CandidatePortal: React.FC<CandidatePortalProps> = ({ announcements, onTakeExam }) => {
    const [availableExams, setAvailableExams] = useState<Exam[]>([]);
    const [history, setHistory] = useState<Submission[]>([]);
    const [activeTab, setActiveTab] = useState<'available' | 'history'>('available');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            // Parallel fetch
            const [examsData, historyData] = await Promise.all([
                api.exams.listAvailable(), // Need to implement/ensure this endpoint exists
                api.submissions.listMyHistory() // Need to ensure this exists
            ]);
            setAvailableExams(examsData || []);
            setHistory(historyData || []);
        } catch (e) {
            console.error("Failed to load portal data", e);
        }
    };

    const getResultDisplay = (sub: Submission) => {
        // Logic for "Submitted" vs "Score" based on release settings
        if (sub.resultsReleased) {
            // Full Result
            return <span className="text-green-600 font-bold">{sub.score}%</span>;
        }
        // If partial release (MCQ only) - To be implemented based on extended Submission type
        // For now, default to Pending
        return <span className="text-amber-600 italic">Result Pending</span>;
    };

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-6">
            {/* Header */}
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Exam Portal</h1>
                    <p className="text-slate-500">Welcome, Candidate.</p>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex space-x-4 border-b border-slate-200 dark:border-slate-700">
                <button
                    onClick={() => setActiveTab('available')}
                    className={`pb-2 px-4 ${activeTab === 'available' ? 'border-b-2 border-indigo-600 text-indigo-600 font-bold' : 'text-slate-500'}`}
                >
                    Available Exams
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`pb-2 px-4 ${activeTab === 'history' ? 'border-b-2 border-indigo-600 text-indigo-600 font-bold' : 'text-slate-500'}`}
                >
                    Exam History
                </button>
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {activeTab === 'available' ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {availableExams.length === 0 && <p className="text-slate-500 col-span-full text-center py-10">No exams available at this time.</p>}
                        {availableExams.map(exam => (
                            <div key={exam.id} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="px-2 py-1 text-xs font-semibold rounded bg-indigo-100 text-indigo-700">{exam.category}</span>
                                    <span className="text-xs text-slate-400">{exam.durationMinutes} mins</span>
                                </div>
                                <h3 className="text-xl font-bold mb-2">{exam.title}</h3>
                                <p className="text-sm text-slate-500 mb-4 line-clamp-2">{exam.description || "No description provided."}</p>
                                <div className="mt-4">
                                    <button
                                        onClick={() => onTakeExam(exam)}
                                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition-colors"
                                    >
                                        Start Exam
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="p-4 font-semibold text-sm">Exam Title</th>
                                    <th className="p-4 font-semibold text-sm">Date Taken</th>
                                    <th className="p-4 font-semibold text-sm">Score</th>
                                    <th className="p-4 font-semibold text-sm">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map(sub => (
                                    <tr key={sub.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <td className="p-4 font-medium">{sub.examId}</td> {/* ideally map ID to Title */}
                                        <td className="p-4 text-slate-500">{format(sub.submittedAt, 'MMM dd, yyyy')}</td>
                                        <td className="p-4">{getResultDisplay(sub)}</td>
                                        <td className="p-4">
                                            {sub.resultsReleased && <button className="text-indigo-600 hover:underline text-sm">View Details</button>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {history.length === 0 && <div className="p-8 text-center text-slate-500">No past exams found.</div>}
                    </div>
                )}
            </div>

            {/* Announcements Section */}
            {announcements.length > 0 && (
                <section className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold mb-4">📢 Announcements</h3>
                    <div className="grid gap-4">
                        {announcements.map(post => (
                            <div key={post.id} className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded border-l-4 border-amber-400">
                                <h4 className="font-bold text-amber-900 dark:text-amber-100">{post.title}</h4>
                                <p className="text-amber-800 dark:text-amber-200 mt-1">{post.content}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

export default CandidatePortal;
