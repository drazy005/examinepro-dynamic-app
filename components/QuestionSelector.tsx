import React, { useState, useMemo } from 'react';
import { Question, QuestionType } from '../services/types';

interface QuestionSelectorProps {
    questions: Question[];
    onSelect: (selectedQuestions: Question[]) => void;
    onClose: () => void;
    initialSelection?: string[]; // IDs of already selected
}

const QuestionSelector: React.FC<QuestionSelectorProps> = ({
    questions,
    onSelect,
    onClose,
    initialSelection = []
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelection));
    const [filterText, setFilterText] = useState('');
    const [filterType, setFilterType] = useState<QuestionType | 'ALL'>('ALL');
    const [filterCategory, setFilterCategory] = useState('');

    // Extract unique categories for filter dropdown
    const categories = useMemo(() => {
        const cats = new Set(questions.map(q => q.category).filter(Boolean));
        return Array.from(cats) as string[];
    }, [questions]);

    const filteredQuestions = useMemo(() => {
        return questions.filter(q => {
            const matchText = q.text.toLowerCase().includes(filterText.toLowerCase());
            const matchType = filterType === 'ALL' || q.type === filterType;
            const matchCat = !filterCategory || q.category === filterCategory;
            return matchText && matchType && matchCat;
        });
    }, [questions, filterText, filterType, filterCategory]);

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleConfirm = () => {
        const selected = questions.filter(q => selectedIds.has(q.id));
        onSelect(selected);
    };

    const toggleAllVisible = () => {
        const allVisibleSelected = filteredQuestions.every(q => selectedIds.has(q.id));
        const newSet = new Set(selectedIds);

        if (allVisibleSelected) {
            filteredQuestions.forEach(q => newSet.delete(q.id));
        } else {
            filteredQuestions.forEach(q => newSet.add(q.id));
        }
        setSelectedIds(newSet);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] flex flex-col theme-rounded shadow-2xl animate-in zoom-in-95">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 theme-rounded-t">
                    <h2 className="text-xl font-black uppercase tracking-tight">Select Questions</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500 font-bold px-2">Close</button>
                </div>

                {/* Filters */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
                    <input
                        className="p-3 theme-rounded bg-white dark:bg-slate-900 border-none outline-none font-bold text-xs uppercase shadow-sm"
                        placeholder="Search text..."
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                    />
                    <select
                        className="p-3 theme-rounded bg-white dark:bg-slate-900 border-none outline-none font-bold text-xs uppercase shadow-sm text-slate-600"
                        value={filterType}
                        onChange={e => setFilterType(e.target.value as any)}
                    >
                        <option value="ALL">All Types</option>
                        <option value={QuestionType.MCQ}>MCQ</option>
                        <option value={QuestionType.SBA}>SBA</option>
                        <option value={QuestionType.THEORY}>Theory</option>
                    </select>
                    <select
                        className="p-3 theme-rounded bg-white dark:bg-slate-900 border-none outline-none font-bold text-xs uppercase shadow-sm text-slate-600"
                        value={filterCategory}
                        onChange={e => setFilterCategory(e.target.value)}
                    >
                        <option value="">All Topics</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-100 dark:bg-slate-800/50">
                    <div className="flex justify-between items-center px-2 mb-2">
                        <span className="text-[10px] font-black uppercase text-slate-400">Showing {filteredQuestions.length} questions</span>
                        <button onClick={toggleAllVisible} className="text-indigo-600 hover:underline text-[10px] font-bold uppercase">
                            {filteredQuestions.length > 0 && filteredQuestions.every(q => selectedIds.has(q.id)) ? 'Deselect Visible' : 'Select All Visible'}
                        </button>
                    </div>

                    {filteredQuestions.length === 0 ? (
                        <div className="text-center py-20 text-slate-400 font-bold uppercase text-xs">No questions found matching filters.</div>
                    ) : (
                        filteredQuestions.map(q => (
                            <div
                                key={q.id}
                                onClick={() => toggleSelection(q.id)}
                                className={`flex gap-4 p-4 theme-rounded cursor-pointer transition-all border-2 ${selectedIds.has(q.id)
                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 shadow-md'
                                        : 'bg-white dark:bg-slate-900 border-transparent hover:border-slate-200'
                                    }`}
                            >
                                <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${selectedIds.has(q.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                                    }`}>
                                    {selectedIds.has(q.id) && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${q.type === QuestionType.THEORY ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                            }`}>{q.type}</span>
                                        {q.category && <span className="text-[9px] font-bold uppercase text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{q.category}</span>}
                                        <span className="text-[9px] font-bold uppercase text-slate-400 ml-auto">{q.points} Pts</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{q.text}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 theme-rounded-b flex justify-between items-center">
                    <div className="text-xs font-bold uppercase text-slate-500">
                        {selectedIds.size} Selected
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-3 font-bold uppercase text-xs text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button
                            onClick={handleConfirm}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-bold uppercase text-xs shadow-lg transition-all active:scale-95"
                        >
                            Add Selected Questions
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuestionSelector;
