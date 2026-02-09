import React, { useState } from 'react';
import { Question, QuestionType } from '../services/types';
import { v4 as uuidv4 } from 'uuid';

interface BulkImportModalProps {
    onImport: (questions: Partial<Question>[]) => Promise<void>;
    onClose: () => void;
}

const BulkImportModal: React.FC<BulkImportModalProps> = ({ onImport, onClose }) => {
    const [inputText, setInputText] = useState('');
    const [preview, setPreview] = useState<Partial<Question>[]>([]);
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const parseInput = () => {
        setError('');
        const trimmed = inputText.trim();
        const lines = trimmed.split('\n');
        const parsed: Partial<Question>[] = [];

        // Attempt JSON parse first regardless of starting char (could be wrapped)
        try {
            const json = JSON.parse(trimmed);
            // Handle array directly
            if (Array.isArray(json)) {
                setPreview(json);
                return;
            }
            // Handle { "questions": [...] } format common in exports
            if (json.questions && Array.isArray(json.questions)) {
                setPreview(json.questions);
                return;
            }
        } catch (e) {
            // Not valid JSON, proceed to CSV/Text parsing
        }

        // CSV Mode
        // Format: Question Text | Type | Correct Answer | Options(comma sep)
        lines.forEach(line => {
            const parts = line.split('|').map(s => s.trim());
            if (parts.length >= 2) {
                const [text, typeStr, correct, optsStr] = parts;
                let type = QuestionType.MCQ;
                if (typeStr?.toUpperCase() === 'SBA') type = QuestionType.SBA;
                if (typeStr?.toUpperCase() === 'THEORY') type = QuestionType.THEORY;

                parsed.push({
                    id: uuidv4(),
                    text,
                    type,
                    correctAnswer: correct || '',
                    options: optsStr ? optsStr.split(',').map(o => o.trim()) : [],
                    points: type === QuestionType.THEORY ? 10 : 1
                });
            }
        });

        if (parsed.length === 0) {
            setError('Could not parse input. formatting: JSON Array or "Text | Type | Answer | Options"');
        } else {
            setPreview(parsed);
        }
    };

    const handleConfirm = async () => {
        setIsProcessing(true);
        try {
            await onImport(preview);
            onClose();
        } catch (e) {
            setError('Import failed on server.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl theme-rounded shadow-2xl p-8 animate-in zoom-in-95">
                <h2 className="text-2xl font-black uppercase mb-4">Bulk Import Questions</h2>

                {!preview.length ? (
                    <>
                        <div className="mb-4 bg-slate-50 dark:bg-slate-800 p-4 rounded text-xs text-slate-500">
                            <p className="font-bold mb-2">Supported Formats:</p>
                            <ul className="list-disc pl-4 space-y-1">
                                <li><b>JSON Array</b> (Standard format)</li>
                                <li><b>Pipe-Separated Values</b>: <code>Question Text | MCQ | Correct Answer | Opt A, Opt B, Opt C</code></li>
                            </ul>
                        </div>
                        <textarea
                            className="w-full h-64 p-4 bg-slate-50 dark:bg-slate-950 border rounded-xl font-mono text-sm"
                            placeholder={`Paste data here...\nExample:\nWhat is 2+2? | MCQ | 4 | 2, 3, 4, 5`}
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                        />
                        {error && <p className="text-red-500 text-xs font-bold mt-2">{error}</p>}
                        <div className="flex justify-end gap-4 mt-6">
                            <button onClick={onClose} className="px-6 py-2 text-slate-500 font-bold uppercase text-xs">Cancel</button>
                            <button onClick={parseInput} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold uppercase text-xs">Preview</button>
                        </div>
                    </>
                ) : (
                    <>
                        <p className="text-sm text-slate-500 mb-4">Found <b>{preview.length}</b> questions ready to import.</p>
                        <div className="max-h-64 overflow-y-auto mb-6 bg-slate-50 dark:bg-slate-800 rounded-xl p-2 space-y-2">
                            {preview.map((q, i) => (
                                <div key={i} className="p-3 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-700">
                                    <div className="flex justify-between">
                                        <span className="font-bold text-sm truncate w-3/4">{q.text}</span>
                                        <span className="text-[10px] font-black uppercase bg-slate-200 dark:bg-slate-700 px-2 rounded">{q.type}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end gap-4">
                            <button onClick={() => setPreview([])} className="px-6 py-2 text-slate-500 font-bold uppercase text-xs">Back</button>
                            <button onClick={handleConfirm} disabled={isProcessing} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold uppercase text-xs">
                                {isProcessing ? 'Importing...' : 'Confirm Import'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default BulkImportModal;
