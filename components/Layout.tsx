import React, { useEffect, useState } from 'react';
import { User, AppBranding } from '../services/types';
import { subscribeToLoading } from '../services/api';
import { ToastContainer } from './Toast';
import Footer from './Footer';

interface LayoutProps {
  user: User | null;
  onLogout: () => void;
  children: React.ReactNode;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  branding: AppBranding;
  onDashboardClick?: () => void;
  onMyExamsClick?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ user, onLogout, children, isDarkMode, onToggleDarkMode, branding, onDashboardClick, onMyExamsClick }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToLoading(setIsLoading);

    const root = document.documentElement;
    root.style.setProperty('--primary-color', branding.primaryColor);
    root.style.setProperty('--app-radius', branding.borderRadius);
    root.style.setProperty('--font-family', branding.fontFamily === 'mono' ? 'monospace' : branding.fontFamily === 'serif' ? 'serif' : 'Inter, sans-serif');

    // Update Favicon
    const iconUrl = branding.faviconUrl || branding.appIcon;
    if (iconUrl) {
      const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']") || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = iconUrl;
      document.getElementsByTagName('head')[0].appendChild(link);
    }

    return () => unsubscribe();
  }, [branding]);

  const containerStyle: React.CSSProperties = {
    fontFamily: 'var(--font-family)',
    backgroundImage: branding.backgroundImage ? `url(${branding.backgroundImage})` : undefined,
    backgroundAttachment: 'fixed',
    backgroundSize: 'cover'
  };

  return (
    <div className="min-h-screen flex flex-col transition-all duration-300 dark:bg-slate-950 bg-slate-50 relative" style={containerStyle}>
      <style>{`
        * { border-radius: inherit; }
        .theme-rounded { border-radius: var(--app-radius) !important; }
        .theme-rounded-top { border-top-left-radius: var(--app-radius) !important; border-top-right-radius: var(--app-radius) !important; }
        .theme-rounded-bottom { border-bottom-left-radius: var(--app-radius) !important; border-bottom-right-radius: var(--app-radius) !important; }
        
        /* Loading Bar Animation */
        .loading-bar {
          position: fixed;
          top: 0;
          left: 0;
          height: 4px;
          background: ${branding.primaryColor};
          z-index: 9999;
          transition: width 0.2s ease, opacity 0.4s ease;
          box-shadow: 0 0 10px ${branding.primaryColor};
        }
      `}</style>

      {isLoading && (
        <div className="loading-bar w-full animate-pulse"></div>
      )}

      {branding.backgroundImage && (
        <div className="fixed inset-0 bg-slate-50/80 dark:bg-slate-950/90 pointer-events-none z-0"></div>
      )}

      <header
        className="text-white shadow-lg sticky top-0 z-50 transition-colors"
        style={{ backgroundColor: isDarkMode ? undefined : 'var(--primary-color)' }}
      >
        <style>{`
          @keyframes marquee {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
          }
          .animate-marquee {
            animation: marquee 25s linear infinite;
          }
          .animate-marquee:hover {
            animation-play-state: paused;
          }
        `}</style>
        {branding.marqueeMessage && (
          <div className="bg-indigo-600/90 text-white overflow-hidden py-2 relative z-[60]">
            <div className="whitespace-nowrap animate-marquee font-bold uppercase text-xs tracking-widest px-4">
              {branding.marqueeMessage}
            </div>
          </div>
        )}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.hash = ''}>
                {branding.appIcon ? (
                  <img src={branding.appIcon} className="w-10 h-10 object-contain rounded-lg bg-white p-1" alt="Logo" />
                ) : (
                  <div className="bg-white p-1 rounded-md text-slate-900 font-black text-xl w-10 h-10 flex items-center justify-center">
                    {branding.appName[0].toUpperCase()}
                  </div>
                )}
                <h1 className="text-xl font-black tracking-tighter uppercase hidden md:block">{branding.appName}</h1>
              </div>

              {/* Global Navigation Menu */}
              <nav className="hidden md:flex gap-6">
                <button onClick={(e) => { e.preventDefault(); if (onDashboardClick) onDashboardClick(); }} className="text-xs font-bold uppercase text-white/80 hover:text-white tracking-widest">Dashboard</button>
                {user?.role === 'CANDIDATE' && <button onClick={(e) => { e.preventDefault(); if (onMyExamsClick) onMyExamsClick(); }} className="text-xs font-bold uppercase text-white/80 hover:text-white tracking-widest">My Exams</button>}
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={onToggleDarkMode}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white"
              >
                {isDarkMode ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                )}
              </button>

              {user && (
                <>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-black uppercase tracking-tight">{user.name}</p>
                      <p className="text-[10px] text-white/70 font-black uppercase tracking-widest">{user.role}</p>
                    </div>
                    <button
                      onClick={onLogout}
                      className="hidden md:block text-[10px] bg-white/10 text-white px-4 py-2 rounded-xl font-black uppercase tracking-widest hover:bg-white/20 transition-all border border-white/20 theme-rounded"
                    >
                      Logout
                    </button>
                  </div>

                  {/* Mobile Menu Toggle */}
                  <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="md:hidden p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {isMobileMenuOpen ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                      )}
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          {isMobileMenuOpen && user && (
            <div className="md:hidden py-4 border-t border-white/10 space-y-4 animate-in slide-in-from-top-2 fade-in">
              <div className="flex flex-col gap-2">
                <button onClick={() => { if (onDashboardClick) onDashboardClick(); setIsMobileMenuOpen(false); }} className="px-4 py-3 bg-white/10 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-white/20 text-left">Dashboard</button>
                {user.role === 'CANDIDATE' && (
                  <button onClick={() => { if (onMyExamsClick) onMyExamsClick(); setIsMobileMenuOpen(false); }} className="px-4 py-3 bg-white/10 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-white/20 text-left">My Exams</button>
                )}
              </div>

              <div className="pt-4 border-t border-white/10 flex flex-col gap-2">
                <div className="px-2">
                  <p className="text-sm font-black uppercase tracking-tight">{user.name}</p>
                  <p className="text-[10px] text-white/70 font-black uppercase tracking-widest">{user.role}</p>
                </div>
                <button onClick={onLogout} className="px-4 py-3 bg-red-500/20 text-red-100 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-red-500/30 text-left">Logout</button>
              </div>
            </div>
          )}
        </div>
      </header>

      {branding.bannerImage && (
        <div className="w-full h-48 md:h-64 overflow-hidden relative shadow-inner z-10">
          <img src={branding.bannerImage} className="w-full h-full object-cover opacity-90" alt="Platform Banner" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-50 dark:from-slate-950 to-transparent"></div>
        </div>
      )}

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {children}
      </main>
      <Footer />

      <ToastContainer />
    </div>
  );
};

export default Layout;
