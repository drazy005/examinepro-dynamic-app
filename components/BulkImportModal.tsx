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
    const [showExamples, setShowExamples] = useState(false);

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
        let parseErrors: string[] = [];

        // 1. Attempt JSON
        try {
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                let json = JSON.parse(trimmed);

                // Normalize: if object with "questions", use that
                if (!Array.isArray(json) && json.questions && Array.isArray(json.questions)) {
                    json = json.questions;
                }

                if (Array.isArray(json)) {
                    isJson = true;
                    json.forEach((item: any, idx) => {
                        const type = Object.values(QuestionType).includes(item.type) ? item.type : QuestionType.MCQ;
                        const text = sanitize(item.text);

                        if (!text) {
                            parseErrors.push(`Item ${idx + 1}: Missing text`);
                            return;
                        }

                        const options = Array.isArray(item.options) ? item.options.map((o: any) => sanitize(String(o))).filter(Boolean) : [];

                        if (type !== QuestionType.THEORY && options.length > 5) {
                            parseErrors.push(`Item ${idx + 1}: Too many options (Max 5). Found ${options.length}.`);
                            return;
                        }

                        let correctAnswer = sanitize(item.correctAnswer || '');

                        // Map Letter Answers (A, B, C...) to Option Text if answer is single letter
                        if (/^[A-E]$/i.test(correctAnswer) && options.length > 0) {
                            const index = correctAnswer.toUpperCase().charCodeAt(0) - 65; // A=0, B=1...
                            if (options[index]) {
                                correctAnswer = options[index];
                            }
                        }

                        if (type !== QuestionType.THEORY && !correctAnswer) {
                            parseErrors.push(`Item ${idx + 1}: Missing correct answer.`);
                            return;
                        }

                        parsed.push({
                            id: uuidv4(),
                            type,
                            text,
                            options,
                            correctAnswer,
                            points: Number(item.points) || (type === QuestionType.THEORY ? 10 : 1),
                            category: sanitize(item.category || 'General'),
                            imageUrl: sanitize(item.imageUrl || '')
                        });
                    });
                }
            }
        } catch (e: any) {
            console.error(e);
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                parseErrors.push(`JSON Parsing Failed: ${e.message}`);
            }
        }

        // 2. CSV / PSV Mode (Only if JSON failed or empty)
        if (!isJson && parsed.length === 0) {
            // If it looked like JSON but failed parse, don't try CSV, just show JSON error
            if (parseErrors.length > 0) {
                // Do nothing, let it fall through to error display
            } else {
                lines.forEach((line, idx) => {
                    const cleanLine = line.trim();
                    if (!cleanLine) return;

                    // Support Pipe (|) 
                    const parts = cleanLine.split('|').map(s => s.trim());

                    if (parts.length >= 2) {
                        const [rawText, rawType, rawCorrect, rawOpts] = parts;

                        const text = sanitize(rawText);
                        if (!text) return;

                        let type = QuestionType.MCQ;
                        const typeUpper = rawType?.toUpperCase() || '';
                        if (typeUpper === 'SBA') type = QuestionType.SBA;
                        else if (typeUpper === 'THEORY') type = QuestionType.THEORY;

                        // Clean Options (Handle simple comma split)
                        const options = rawOpts
                            ? rawOpts.split(',').map(o => sanitize(o)).filter(Boolean)
                            : [];

                        // Validation: Max 5 Options
                        if (type !== QuestionType.THEORY && options.length > 5) {
                            parseErrors.push(`Line ${idx + 1}: Too many options (Max 5). Found ${options.length}.`);
                            return;
                        }

                        let correctAnswer = sanitize(rawCorrect || '');

                        // Map Letter Answers (A, B, C...) to Option Text
                        if (/^[A-E]$/i.test(correctAnswer) && options.length > 0) {
                            const index = correctAnswer.toUpperCase().charCodeAt(0) - 65; // A=0, B=1...
                            if (options[index]) {
                                correctAnswer = options[index];
                            }
                        }

                        // Validation: Answer must exist for non-theory
                        if (type !== QuestionType.THEORY && !correctAnswer) {
                            parseErrors.push(`Line ${idx + 1}: Missing correct answer.`);
                            return;
                        }

                        parsed.push({
                            id: uuidv4(),
                            text,
                            type,
                            correctAnswer,
                            options,
                            points: type === QuestionType.THEORY ? 10 : 1,
                            category: 'General'
                        });
                    } else if (cleanLine.length > 0) {
                        // parseErrors.push(`Line ${idx + 1}: Check separators ( | ).`);
                    }
                });
            }
        }

        if (parsed.length === 0) {
            setError(parseErrors.length > 0 ? parseErrors.join('\n') : 'No valid questions found. Please use the examples above to check your format.');
        } else {
            setPreview(parsed);
        }
    };

    const handleConfirm = async () => {
        setIsProcessing(true);
        try {
            await onImport(preview);
            onClose();
        } catch (e: any) {
            console.error(e);
            setError(e.message || 'Import failed on server.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-3xl theme-rounded shadow-2xl p-8 animate-in zoom-in-95 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-2xl font-black uppercase">Secure Bulk Import</h2>
                        <p className="text-xs text-slate-500 font-bold">Import MCQs, SBAs, and Theory questions.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500 font-bold text-xl">&times;</button>
                </div>

                {!preview.length ? (
                    <div className="flex-1 overflow-y-auto min-h-0">
                        <div className="mb-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-xs text-slate-500 border border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold uppercase text-indigo-600">Quick Guide</span>
                                <button onClick={() => setShowExamples(!showExamples)} className="underline decoration-dashed hover:text-indigo-600 font-bold">
                                    {showExamples ? 'Hide Examples' : 'Show Format Examples'}
                                </button>
                            </div>

                            {showExamples ? (
                                <div className="space-y-4 mt-4 animate-in slide-in-from-top-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white dark:bg-slate-900 p-3 rounded border">
                                            <p className="font-black text-[10px] uppercase text-slate-400 mb-2">Pipe Separated (PSV)</p>
                                            <pre className="font-mono text-[10px] bg-slate-100 dark:bg-slate-950 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                                                {`Question Text | Type | Answer | Options...

// Examples:
Which nerve? | SBA | A | Vagus, Phrenic, Sciatic
What is 2+2? | MCQ | 4 | 2, 3, 4, 5
Describe the... | THEORY | | `}
                                            </pre>
                                            <p className="mt-2 text-[10px] text-amber-600">
                                                * Answer can be the text OR letter (A, B, C...)<br />
                                                * Options are comma-separated.
                                            </p>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 p-3 rounded border">
                                            <p className="font-black text-[10px] uppercase text-slate-400 mb-2">JSON Array</p>
                                            <pre className="font-mono text-[10px] bg-slate-100 dark:bg-slate-950 p-2 rounded overflow-x-auto">
                                                {`[
  {
    "text": "Which nerve?",
    "type": "SBA",
    "options": ["Vagus", "Phrenic"],
    "correctAnswer": "Vagus",
    "points": 5
  }
]`}
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p>Use <b>JSON</b> for complex data or <b>Pipe-Separated (|)</b> for quick lists. Answers can be matched by text or index letter (A, B, C...).</p>
                            )}
                        </div>

                        <textarea
                            className="w-full h-64 p-4 bg-slate-50 dark:bg-slate-950 border rounded-xl font-mono text-sm focus:ring-2 ring-indigo-500 outline-none"
                            placeholder="Paste your questions here..."
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                        />
                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs font-bold mt-2 whitespace-pre-wrap border border-red-100">
                                {error}
                            </div>
                        )}
                        <div className="flex justify-end gap-4 mt-6">
                            <button onClick={onClose} className="px-6 py-2 text-slate-500 font-bold uppercase text-xs hover:text-slate-700">Cancel</button>
                            <button onClick={parseInput} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold uppercase text-xs hover:bg-indigo-700 transition-colors">Preview & Validate</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-sm text-slate-500">Found <b>{preview.length}</b> valid questions.</p>
                            <button onClick={() => setPreview([])} className="text-[10px] uppercase font-bold text-indigo-600 hover:underline">Edit Input</button>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-800 rounded-xl p-2 space-y-2 border border-slate-200 dark:border-slate-700">
                            {preview.map((q, i) => (
                                <div key={i} className="p-3 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-700 shadow-sm relative group">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm truncate" title={q.text}>{q.text}</p>
                                            <div className="flex flex-wrap gap-2 text-[10px] text-slate-400 mt-1">
                                                <span>Ans: <b className="text-green-600">{q.correctAnswer || '(None)'}</b></span>
                                                <span>Opts: {q.options?.length}</span>
                                                <span className="truncate max-w-[200px]" title={q.options?.join(', ')}>({q.options?.join(', ')})</span>
                                            </div>
                                        </div>
                                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${q.type === 'THEORY' ? 'bg-purple-100 text-purple-700' :
                                            q.type === 'SBA' ? 'bg-emerald-100 text-emerald-700' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>{q.type}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end gap-4 mt-4">
                            <button onClick={() => setPreview([])} className="px-6 py-2 text-slate-500 font-bold uppercase text-xs hover:text-slate-700">Back</button>
                            <button onClick={handleConfirm} disabled={isProcessing} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold uppercase text-xs hover:bg-green-700 shadow-lg shadow-green-200/50 transition-all disabled:opacity-50 disabled:shadow-none">
                                {isProcessing ? 'Importing...' : 'Confirm Import'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BulkImportModal;
