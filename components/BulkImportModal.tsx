import React, { useState } from 'react';
import { Question, QuestionType } from '../services/types';
import { v4 as uuidv4 } from 'uuid';
import DOMPurify from 'dompurify';

interface BulkImportModalProps {
    onImport: (questions: Partial<Question>[]) => Promise<void>;
    onClose: () => void;
}

const BulkImportModal: React.FC<BulkImportModalProps> = ({ onImport, onClose }) => {
    const [inputText, setInputText] = useState('');
    const [preview, setPreview] = useState<Partial<Question>[]>([]);
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Sanitize helper
    const sanitize = (text: string): string => {
        if (!text) return '';
        return DOMPurify.sanitize(text.trim());
    };

    const parseInput = () => {
        setError('');
        const trimmed = inputText.trim();
        if (!trimmed) {
            setError('Input is empty.');
            return;
        }

        const lines = trimmed.split('\n');
        const parsed: Partial<Question>[] = [];
        let isJson = false;

        // 1. Attempt JSON
        try {
            // Check if looks like JSON object or array
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                let json = JSON.parse(trimmed);

                // Normalize: if object with "questions", use that
                if (!Array.isArray(json) && json.questions && Array.isArray(json.questions)) {
                    json = json.questions;
                }

                if (Array.isArray(json)) {
                    isJson = true;
                    json.forEach((item: any) => {
                        // Basic Validation & Sanitization
                        const type = Object.values(QuestionType).includes(item.type) ? item.type : QuestionType.MCQ;
                        const text = sanitize(item.text);

                        if (!text) return; // Skip invalid

                        parsed.push({
                            id: uuidv4(),
                            type,
                            text,
                            options: Array.isArray(item.options) ? item.options.map((o: any) => sanitize(String(o))).filter(Boolean) : [],
                            correctAnswer: sanitize(item.correctAnswer || ''),
                            points: Number(item.points) || (type === QuestionType.THEORY ? 10 : 1),
                            category: sanitize(item.category || 'General'),
                            imageUrl: sanitize(item.imageUrl || '')
                        });
                    });
                }
            }
        } catch (e) {
            // Fallback to CSV if JSON parse fails but looked like JSON? 
            // Or just logging error? 
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                console.warn("JSON parse failed, trying CSV fallback just in case.");
            }
        }

        // 2. CSV / PSV Mode (Only if JSON failed or empty)
        if (!isJson && parsed.length === 0) {
            lines.forEach(line => {
                if (!line.trim()) return;

                // Support Pipe (|) 
                const parts = line.split('|').map(s => s.trim());

                if (parts.length >= 2) {
                    const [rawText, rawType, rawCorrect, rawOpts] = parts;

                    const text = sanitize(rawText);
                    if (!text) return;

                    let type = QuestionType.MCQ;
                    const typeUpper = rawType?.toUpperCase() || '';
                    if (typeUpper === 'SBA') type = QuestionType.SBA;
                    else if (typeUpper === 'THEORY') type = QuestionType.THEORY;

                    // Clean Options
                    const options = rawOpts
                        ? rawOpts.split(',').map(o => sanitize(o)).filter(Boolean)
                        : [];

                    parsed.push({
                        id: uuidv4(),
                        text,
                        type,
                        correctAnswer: sanitize(rawCorrect || ''),
                        options,
                        points: type === QuestionType.THEORY ? 10 : 1,
                        category: 'General'
                    });
                }
            });
        }

        if (parsed.length === 0) {
            setError(isJson
                ? 'Invalid JSON format. Check syntax.'
                : 'No valid questions found. Format: "Question Text | Type | Answer | Options"'
            );
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
                <h2 className="text-2xl font-black uppercase mb-4">Secure Bulk Import</h2>

                {!preview.length ? (
                    <>
                        <div className="mb-4 bg-slate-50 dark:bg-slate-800 p-4 rounded text-xs text-slate-500">
                            <p className="font-bold mb-2">Supported Formats:</p>
                            <ul className="list-disc pl-4 space-y-1">
                                <li><b>JSON Array</b> (Recommended): <code>[{"{"} "text": "...", "type": "MCQ", ... {"}"}]</code></li>
                                <li><b>Pipe-Separated Values</b>: <code>Question Text | MCQ | Answer | Opt1, Opt2</code></li>
                            </ul>
                            <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-500 font-bold">
                                Note: All HTML content will be sanitized for security. Invalid questions are skipped.
                            </p>
                        </div>
                        <textarea
                            className="w-full h-64 p-4 bg-slate-50 dark:bg-slate-950 border rounded-xl font-mono text-sm focus:ring-2 ring-indigo-500 outline-none"
                            placeholder={`[
  {
    "text": "What is 2+2?",
    "type": "MCQ",
    "options": ["3", "4", "5"],
    "correctAnswer": "4"
  }
]`}
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                        />
                        {error && <p className="text-red-500 text-xs font-bold mt-2">{error}</p>}
                        <div className="flex justify-end gap-4 mt-6">
                            <button onClick={onClose} className="px-6 py-2 text-slate-500 font-bold uppercase text-xs hover:text-slate-700">Cancel</button>
                            <button onClick={parseInput} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold uppercase text-xs hover:bg-indigo-700 transition-colors">Preview & Validate</button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-sm text-slate-500">Found <b>{preview.length}</b> valid questions.</p>
                            <button onClick={parseInput} className="text-[10px] uppercase font-bold text-indigo-600 hover:underline">Re-validate</button>
                        </div>

                        <div className="max-h-64 overflow-y-auto mb-6 bg-slate-50 dark:bg-slate-800 rounded-xl p-2 space-y-2 border border-slate-200 dark:border-slate-700">
                            {preview.map((q, i) => (
                                <div key={i} className="p-3 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-700 shadow-sm">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm truncate" title={q.text}>{q.text}</p>
                                            <p className="text-[10px] text-slate-400 mt-1 truncate">
                                                Ans: <span className="text-green-600 font-medium">{q.correctAnswer || '(None)'}</span>
                                                {' • '}
                                                Opts: {q.options?.length || 0}
                                            </p>
                                        </div>
                                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${q.type === 'THEORY' ? 'bg-purple-100 text-purple-700' :
                                                q.type === 'SBA' ? 'bg-emerald-100 text-emerald-700' :
                                                    'bg-blue-100 text-blue-700'
                                            }`}>{q.type}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end gap-4">
                            <button onClick={() => setPreview([])} className="px-6 py-2 text-slate-500 font-bold uppercase text-xs hover:text-slate-700">Back</button>
                            <button onClick={handleConfirm} disabled={isProcessing} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold uppercase text-xs hover:bg-green-700 shadow-lg shadow-green-200/50 transition-all disabled:opacity-50 disabled:shadow-none">
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
