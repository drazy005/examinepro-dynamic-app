import React, { useState, useEffect } from 'react';
import { Question, QuestionType } from '../services/types';
import { useToast } from '../services/ToastContext';

interface QuestionEditorProps {
    initialQuestion?: Partial<Question>;
    onSave: (question: Partial<Question>) => Promise<void>;
    onDelete?: () => void;
    onCancel?: () => void;
    isNew?: boolean;
}

const QuestionEditor: React.FC<QuestionEditorProps> = ({
    initialQuestion,
    onSave,
    onDelete,
    onCancel,
    isNew = false
}) => {
    const { addToast } = useToast();
    const [question, setQuestion] = useState<Partial<Question>>({
        type: QuestionType.MCQ,
        text: '',
        points: 1,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 'Option A',
        ...initialQuestion
    });

    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    // Update local state helper
    const updateField = (field: keyof Question, value: any) => {
        setQuestion(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        if (!question.text || !question.correctAnswer) {
            addToast('Question text and correct answer are required', 'error');
            return;
        }

        setIsSaving(true);
        try {
            await onSave(question);
            setIsDirty(false);
            // If it's new, we might want to reset or keep it? 
            // Parent handles closing/clearing usually.
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={`p-6 border rounded-2xl bg-white dark:bg-slate-900 transition-all shadow-sm ${isNew ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200 dark:border-slate-800'}`}>
            <div className="flex justify-between items-start mb-4">
                <div className="flex gap-2">
                    {isNew && <span className="bg-indigo-600 text-white px-2 py-1 rounded text-[10px] font-black uppercase">New</span>}
                    <select
                        className="bg-slate-100 dark:bg-slate-800 rounded px-2 py-1 text-[10px] font-black uppercase outline-none"
                        value={question.type}
                        onChange={e => updateField('type', e.target.value)}
                        disabled={!isNew} // Usually changing type after creation is messy, but allowed if needed.
                    >
                        <option value={QuestionType.MCQ}>MCQ</option>
                        <option value={QuestionType.SBA}>SBA</option>
                        <option value={QuestionType.THEORY}>Theory</option>
                    </select>
                    <input
                        type="number"
                        className="bg-slate-100 dark:bg-slate-800 rounded w-16 px-2 py-1 text-[10px] font-black uppercase outline-none"
                        value={question.points}
                        onChange={e => updateField('points', parseInt(e.target.value) || 0)}
                        placeholder="Pts"
                    />
                </div>
                <div className="flex gap-2">
                    {isDirty && <span className="text-orange-500 text-[10px] font-bold uppercase animate-pulse">Unsaved Changes</span>}
                </div>
            </div>

            <input
                className="font-bold text-lg bg-transparent w-full outline-none border-b border-transparent focus:border-indigo-500 transition-colors mb-4 placeholder-slate-300"
                value={question.text}
                onChange={(e) => updateField('text', e.target.value)}
                placeholder="Enter Question Text Here..."
                autoFocus={isNew}
            />

            <div className="space-y-4">
                {question.type === QuestionType.THEORY ? (
                    <div className="w-full">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Model Answer / Grading Rubric</label>
                        <textarea
                            className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg mt-1 h-24 font-mono focus:border-indigo-500 outline-none"
                            value={question.correctAnswer}
                            onChange={(e) => updateField('correctAnswer', e.target.value)}
                            placeholder="Enter model answer keywords..."
                        />
                    </div>
                ) : (
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Options (Select Correct)</label>
                        {question.options?.map((opt, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    name={`correct-${isNew ? 'new' : question.id}`}
                                    checked={opt === question.correctAnswer}
                                    onChange={() => updateField('correctAnswer', opt)}
                                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                                <input
                                    className={`text-sm bg-transparent w-full outline-none border-b border-transparent focus:border-slate-300 ${opt === question.correctAnswer ? 'text-green-600 font-bold' : 'text-slate-500'}`}
                                    value={opt}
                                    onChange={(e) => {
                                        const newOptions = [...(question.options || [])];
                                        newOptions[idx] = e.target.value;
                                        // Sync correct answer if it was selected
                                        if (question.correctAnswer === opt) {
                                            updateField('correctAnswer', e.target.value);
                                        }
                                        updateField('options', newOptions);
                                    }}
                                />
                                <button onClick={() => {
                                    const newOptions = question.options?.filter((_, i) => i !== idx);
                                    updateField('options', newOptions);
                                }} className="text-slate-300 hover:text-red-500 px-2">×</button>
                            </div>
                        ))}
                        <button onClick={() => updateField('options', [...(question.options || []), `Option ${String.fromCharCode(65 + (question.options?.length || 0))}`])} className="text-xs text-indigo-600 font-bold uppercase hover:underline">+ Add Option</button>
                    </div>
                )}
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t pt-4 border-slate-100 dark:border-slate-800">
                {isNew && onCancel && (
                    <button onClick={onCancel} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-bold text-[10px] uppercase hover:bg-slate-200">Cancel</button>
                )}
                {!isNew && onDelete && (
                    <button onClick={() => { if (confirm('Delete this question?')) onDelete() }} className="text-red-500 px-4 py-2 font-bold text-[10px] uppercase hover:underline">Delete</button>
                )}
                <button
                    onClick={handleSave}
                    disabled={!isDirty && !isNew}
                    className={`px-6 py-2 rounded-lg font-bold text-[10px] uppercase shadow-lg transition-all ${isDirty || isNew ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                >
                    {isSaving ? 'Saving...' : (isNew ? 'Create Question' : 'Save Changes')}
                </button>
            </div>
        </div>
    );
};

export default QuestionEditor;
