import React from 'react';
import { useSystem } from '../services/SystemContext';

const Footer: React.FC = () => {
    // Ideally this comes from useSystem() -> settings containing footer text
    // For now we use a hardcoded default or env var if available, but structured to be editable.
    const { branding } = useSystem();
    const currentYear = new Date().getFullYear();

    return (
        <footer className="w-full py-8 mt-auto bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
            <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-400">
                <div className="text-[10px] font-black uppercase tracking-widest">
                    {branding?.footerText ? (
                        <span>{branding.footerText.replace('{year}', String(currentYear))}</span>
                    ) : (
                        <span>&copy; {currentYear} {branding?.appName || 'ExaminePro'}. All Rights Reserved.</span>
                    )}
                </div>
                <div className="flex gap-6">
                    <a href="#" className="text-[10px] font-bold uppercase hover:text-indigo-600 transition-colors">Privacy Policy</a>
                    <a href="#" className="text-[10px] font-bold uppercase hover:text-indigo-600 transition-colors">Terms of Service</a>
                    <a href="#" className="text-[10px] font-bold uppercase hover:text-indigo-600 transition-colors">Support</a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
