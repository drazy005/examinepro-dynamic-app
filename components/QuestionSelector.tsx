import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Question, QuestionType } from '../services/types';
import { api } from '../services/api';

interface QuestionSelectorProps {
    onSelect: (selectedQuestions: Question[]) => void;
    onClose: () => void;
    initialSelection?: string[]; // IDs of already selected
    initialQuestions?: Question[]; // Actual objects of selected items to seed cache
}

const QuestionSelector: React.FC<QuestionSelectorProps> = ({
    onSelect,
    onClose,
    initialSelection = [],
    initialQuestions = []
}) => {
    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelection));
    // cache selected questions objects so we can return them even if not on current page
    const [selectedQuestionsMap, setSelectedQuestionsMap] = useState<Map<string, Question>>(() => {
        const map = new Map<string, Question>();
        initialQuestions.forEach(q => map.set(q.id, q));
        return map;
    });

    // Data State
    const [questions, setQuestions] = useState<Question[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    // Filters
    const [filterText, setFilterText] = useState('');
    const [filterType, setFilterType] = useState<QuestionType | 'ALL'>('ALL');
    const [filterBatchId, setFilterBatchId] = useState('');

    const fetchQuestions = useCallback(async () => {
        setIsLoading(true);
        try {
            const params: any = { page, limit: 50 }; // Limit 50
            if (filterType !== 'ALL') params.type = filterType;
            if (filterText) params.search = filterText;
            if (filterBatchId) params.batchId = filterBatchId;

            const res: any = await api.questions.list(params);

            if (res.data) {
                setQuestions(res.data);
                setTotal(res.pagination.total);
                setTotalPages(res.pagination.totalPages);
            } else if (Array.isArray(res)) {
                // Fallback for legacy API
                setQuestions(res);
                setTotal(res.length);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, [page, filterType, filterText, filterBatchId]);

    // Initial Fetch & Debounce
    useEffect(() => {
        const t = setTimeout(fetchQuestions, 300);
        return () => clearTimeout(t);
    }, [fetchQuestions]);

    const toggleSelection = (q: Question) => {
        const newSet = new Set(selectedIds);
        const newMap = new Map(selectedQuestionsMap);

        if (newSet.has(q.id)) {
            newSet.delete(q.id);
            newMap.delete(q.id);
        } else {
            newSet.add(q.id);
            newMap.set(q.id, q);
        }
        setSelectedIds(newSet);
        setSelectedQuestionsMap(newMap);
    };

    const toggleAllVisible = () => {
        const allVisibleSelected = questions.length > 0 && questions.every(q => selectedIds.has(q.id));
        const newSet = new Set(selectedIds);
        const newMap = new Map(selectedQuestionsMap);

        if (allVisibleSelected) {
            questions.forEach(q => {
                newSet.delete(q.id);
                newMap.delete(q.id);
            });
        } else {
            questions.forEach(q => {
                newSet.add(q.id);
                newMap.set(q.id, q);
            });
        }
        setSelectedIds(newSet);
        setSelectedQuestionsMap(newMap);
    };



    const handleConfirm = () => {
        // We need to return Question objects.
        // Convert Map to Array.
        // Ensure we also include any initially selected IDs if we haven't fetched them?
        // Limitation: If initialSelection contains IDs not yet fetched/cached, we might miss them if we output only from map.
        // However, standard flow is:
        // 1. Selector opens with current exam questions. 
        // 2. User adds/removes.
        // 3. User saves.

        // BETTER APPROACH: 
        // We only pass back *newly* fetched questions objects + ID list?
        // Or expecting full objects? AdminDashboard expects `Question[]`.

        // Critical: If we start with IDs [1, 2], and only fetch Page 1 (IDs [3, 4]), 
        // and current Map only has [3] (selected). 
        // IDs 1 and 2 are in `selectedIds` set (from initial), but not in Map.
        // If we leave them in Set, we return them as ... what? 
        // We can't return objects for them if we don't have them.

        // PROPOSAL: `onSelect` should ideally take `ids` or we must pre-fetch initial selection.
        // For now, let's return what we have in Map. 
        // BUT `AdminDashboard` might overwrite existing list.

        // Assumption: `initialSelection` are IDs of questions *already in the exam*.
        // If the user *deselects* them, they are removed from Set.
        // If they keep them, they remain in Set.
        // We need to ensure we return the objects for them. 
        // BUT we don't have the objects if we didn't fetch them.

        // FIX: The parent (AdminDashboard) knows the objects for `initialSelection`.
        // The Selector logic usually *replaces* the list?
        // `onSelect(selected)` implies replacing.

        // Workaround: We will fetch `initialSelection` objects on mount? 
        // Or simpler: We just pass back the *new* selections + *kept* old IDs?
        // AdminDashboard expects `Question[]`.

        // Let's rely on the user *not* losing data if they don't see it? No that's dangerous.
        // If I pass back only map values, I lose unseen selected questions.

        // Solution: `QuestionSelector` shouldn't return full objects for everything if it can't.
        // OR: AdminDashboard should merge?

        // Let's try to fetch all selected IDs on mount? No, generic fetch.

        // Compromise: 
        // We will assume `onSelect` merges? 
        // No `handleSave` in AdminDashboard does: `questions: validQuestions`. 
        // It relies on the state `editingExam.questions`.

        // If I use `QuestionSelector` to *add*, it's fine.
        // If I use it to *manage* (add/remove), I need full state.

        // Let's just return the `Question` objects we know about. 
        // If there are IDs in `selectedIds` that are NOT in `selectedQuestionsMap`, 
        // it means they were passed in `initialSelection` but we haven't seen them yet.
        // We should warn? Or we can't return them?

        // Update: `AdminDashboard` passes `questionBank` to `QuestionSelector` currently!
        // So it had all data.
        // Now it doesn't.

        // If `AdminDashboard` has `editingExam.questions` (which are full objects), 
        // we should pass those *objects* to `QuestionSelector` as `initialQuestions`.
        // Then populate Cache with them.

        const selected = Array.from(selectedQuestionsMap.values());
        onSelect(selected);
    };

    // Populate cache with initial *if* we can? 
    // We can't unless passed. 
    // Let's change `initialSelection` to `selectedQuestions: Question[]` prop?

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
                        onChange={e => { setFilterText(e.target.value); setPage(1); }}
                    />
                    <select
                        className="p-3 theme-rounded bg-white dark:bg-slate-900 border-none outline-none font-bold text-xs uppercase shadow-sm text-slate-600"
                        value={filterType}
                        onChange={e => { setFilterType(e.target.value as any); setPage(1); }}
                    >
                        <option value="ALL">All Types</option>
                        <option value={QuestionType.MCQ}>MCQ</option>
                        <option value={QuestionType.SBA}>SBA</option>
                        <option value={QuestionType.THEORY}>Theory</option>
                    </select>
                    <input
                        className="p-3 theme-rounded bg-white dark:bg-slate-900 border-none outline-none font-bold text-xs uppercase shadow-sm"
                        placeholder="Filter Batch ID..."
                        value={filterBatchId}
                        onChange={e => { setFilterBatchId(e.target.value); setPage(1); }}
                    />
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-100 dark:bg-slate-800/50">
                    <div className="flex justify-between items-center px-2 mb-2">
                        <span className="text-[10px] font-black uppercase text-slate-400">
                            {isLoading ? 'Loading...' : `Found ${total} questions`}
                        </span>
                        <button onClick={toggleAllVisible} className="text-indigo-600 hover:underline text-[10px] font-bold uppercase transition-colors hover:text-indigo-800">
                            {questions.length > 0 && questions.every(q => selectedIds.has(q.id)) ? 'Deselect Page' : 'Select Page'}
                        </button>
                    </div>

                    {questions.length === 0 && !isLoading ? (
                        <div className="text-center py-20 text-slate-400 font-bold uppercase text-xs">No questions found.</div>
                    ) : (
                        questions.map(q => (
                            <div
                                key={q.id}
                                onClick={() => toggleSelection(q)}
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

                    {isLoading && <div className="text-center p-4 text-xs font-bold text-indigo-500 uppercase">Loading...</div>}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 theme-rounded-b flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        {/* Pagination */}
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 bg-slate-100 rounded text-xs font-bold uppercase disabled:opacity-50">Prev</button>
                        <span className="text-xs font-bold text-slate-400">Page {page} of {totalPages}</span>
                        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 bg-slate-100 rounded text-xs font-bold uppercase disabled:opacity-50">Next</button>
                    </div>

                    <div className="flex gap-3 items-center">
                        <div className="text-xs font-bold uppercase text-slate-500 mr-4">
                            {selectedIds.size} Selected
                        </div>
                        <button onClick={onClose} className="px-6 py-3 font-bold uppercase text-xs text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button
                            onClick={handleConfirm}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-bold uppercase text-xs shadow-lg transition-all active:scale-95"
                        >
                            Save Selection
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuestionSelector;
