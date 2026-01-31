import React, { useState, useRef } from 'react';

interface ImageUploadProps {
    label: string;
    value: string | undefined;
    onChange: (value: string) => void;
    placeholder?: string;
    description?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ label, value, onChange, placeholder, description }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 500 * 1024) { // 500KB limit
            setError('File too large (Max 500KB). Use URL for larger images.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            onChange(result);
            setError(null);
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="space-y-2">
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400">{label}</label>

            {/* Preview Area */}
            <div className="flex gap-4 items-start">
                <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0 relative group">
                    {value ? (
                        <img src={value} className="w-full h-full object-contain p-1" alt="Preview" />
                    ) : (
                        <span className="text-slate-300 text-[10px] font-bold uppercase">No Img</span>
                    )}
                    {value && (
                        <button
                            onClick={() => onChange('')}
                            className="absolute inset-0 bg-black/50 text-white text-[9px] font-bold uppercase opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        >
                            Remove
                        </button>
                    )}
                </div>

                <div className="flex-1 space-y-3">
                    {/* Type Link Input */}
                    <input
                        className="w-full p-2 text-xs font-bold bg-slate-50 dark:bg-slate-950 rounded-lg border border-transparent focus:border-indigo-500 outline-none transition-colors"
                        placeholder={placeholder || "Paste Image URL..."}
                        value={value || ''}
                        onChange={e => {
                            onChange(e.target.value);
                            setError(null);
                        }}
                    />

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400">OR</span>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[10px] font-black uppercase hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                        >
                            Upload File
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                        <span className="text-[9px] text-slate-400 italic">Max 500KB (Base64)</span>
                    </div>
                    {error && <p className="text-red-500 text-[10px] font-bold uppercase animate-pulse">{error}</p>}
                    {description && <p className="text-[10px] text-slate-400">{description}</p>}
                </div>
            </div>
        </div>
    );
};

export default ImageUpload;
