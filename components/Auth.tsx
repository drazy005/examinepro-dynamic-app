
import React, { useState } from 'react';
import { User, UserRole } from '../services/types';
import { validateEmail, validatePasswordStrength, sanitize } from '../services/securityService';
import { useSystem } from '../services/SystemContext';
import { api } from '../services/api';

interface AuthProps {
  onLogin: (user: User) => void;
  onRegister: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const { branding, isDarkMode } = useSystem();
  const [authView, setAuthView] = useState<'login' | 'register' | 'forgot' | 'verify_sent' | 'reset_sent' | 'reset_password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.CANDIDATE);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false); // Toggle state

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = sanitize(email);
    if (!cleanEmail || !password) {
      setError('Email and password are required.');
      return;
    }

    try {
      // FIX: Pass object matching { email, password }
      const response = await api.auth.login({ email: cleanEmail, password });
      onLogin(response.user || response); // Handle { user: ... } or just user object
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = sanitize(email);
    const cleanName = sanitize(name);

    if (!cleanEmail || !password || !cleanName) {
      setError('All fields are required.');
      return;
    }

    if (!validateEmail(cleanEmail)) {
      setError('Invalid email format.');
      return;
    }

    if (password.length < 3) {
      setError('Password must be at least 3 characters.');
      return;
    }

    try {
      await api.auth.register({ name: cleanName, email: cleanEmail, password });
      setAuthView('verify_sent');
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = sanitize(email);
    if (!cleanEmail) {
      setError('Email is required.');
      return;
    }

    try {
      await api.auth.forgotPassword(cleanEmail); // Ensure this method exists in api.ts types if used
      setAuthView('reset_sent');
    } catch (err: any) {
      setError(err.message || 'Failed to request reset link.');
    }
  };

  const authBgStyle = branding.backgroundImage
    ? { backgroundImage: `url(${branding.backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};

  return (
    <div
      className={`min-h-screen ${isDarkMode ? 'bg-slate-950' : 'bg-slate-900'} flex items-center justify-center p-4 transition-colors duration-500 relative`}
      style={authBgStyle}
    >
      {branding.backgroundImage && (
        <div className={`absolute inset-0 ${isDarkMode ? 'bg-slate-950/90' : 'bg-slate-900/80'} backdrop-blur-sm pointer-events-none z-0`}></div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden transition-all duration-300 border-b-8 z-10 relative animate-in fade-in zoom-in-95" style={{ borderColor: branding.primaryColor }}>
        <div className="p-6 md:p-10 text-center text-white relative" style={{ backgroundColor: branding.primaryColor }}>
          <div className="bg-white dark:bg-slate-800 p-2 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            {branding.appIcon ? (
              <img src={branding.appIcon} className="w-full h-full object-contain rounded-lg" alt="Logo" />
            ) : (
              <div className="font-black text-3xl select-none" style={{ color: branding.primaryColor }}>{branding.appName[0].toUpperCase()}</div>
            )}
          </div>
          <h1 className="text-3xl font-black tracking-tighter uppercase">{branding.appName}</h1>
          <p className="text-white/80 text-[10px] font-black uppercase tracking-widest mt-2">Secure Assessment Portal</p>
        </div>

        {authView === 'login' && (
          <>
            <div className="flex border-b border-slate-100 dark:border-slate-800">
              <button className="flex-1 py-5 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400">Sign In</button>
              <button onClick={() => { setAuthView('register'); setError(''); }} className="flex-1 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Register</button>
            </div>
            <form onSubmit={handleLoginSubmit} className="p-6 md:p-10 space-y-6">
              {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-[10px] font-black uppercase rounded-xl border border-red-100 dark:border-red-900/30">{error}</div>}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Email Address</label>
                <input type="email" className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-indigo-500 dark:focus:border-indigo-500 outline-none text-slate-900 dark:text-white font-medium transition-all" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1 ml-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Password</label>
                  <button type="button" onClick={() => setAuthView('forgot')} className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase hover:underline">Forgotten Password?</button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-indigo-500 dark:focus:border-indigo-500 outline-none text-slate-900 dark:text-white font-medium transition-all pr-12"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>
              <button type="submit" className="w-full text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl active:scale-95 hover:brightness-110" style={{ backgroundColor: branding.primaryColor }}>Login</button>

              <div className="flex items-center gap-4 my-2">
                <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1"></div>
                <span className="text-[10px] uppercase font-black text-slate-300">OR</span>
                <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1"></div>
              </div>

              <button
                type="button"
                onClick={() => window.location.href = '/api/auth/google'}
                className="w-full py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-black uppercase tracking-widest text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </button>
            </form>
          </>
        )}

        {authView === 'register' && (
          <>
            <div className="flex border-b border-slate-100 dark:border-slate-800">
              <button onClick={() => { setAuthView('login'); setError(''); }} className="flex-1 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Sign In</button>
              <button className="flex-1 py-5 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400">Register</button>
            </div>
            <form onSubmit={handleRegisterSubmit} className="p-6 md:p-10 space-y-5">
              {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-[10px] font-black uppercase rounded-xl border border-red-100 dark:border-red-900/30">{error}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Identity</label>
                  <input type="text" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none text-slate-900 dark:text-white font-bold" value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Contact</label>
                  <input type="email" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none text-slate-900 dark:text-white" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email Address" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none text-slate-900 dark:text-white pr-12"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <button type="submit" className="w-full text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl hover:brightness-110 mt-2" style={{ backgroundColor: branding.primaryColor }}>Create Account</button>
            </form>
          </>
        )}

        {authView === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="p-6 md:p-10 space-y-6">
            <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Reset Password</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">We will send a password reset link to your email.</p>
            {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-[10px] font-black uppercase rounded-lg border border-red-100 dark:border-red-900/30">{error}</div>}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Email Address</label>
              <input type="email" className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none text-slate-900 dark:text-white font-medium" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" required />
            </div>
            <div className="flex gap-4 pt-2">
              <button type="button" onClick={() => setAuthView('login')} className="flex-1 text-slate-400 dark:text-slate-500 font-black uppercase text-[10px] py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
              <button type="submit" className="flex-1 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:brightness-110" style={{ backgroundColor: branding.primaryColor }}>Send Link</button>
            </div>
          </form>
        )}

        {authView === 'verify_sent' && (
          <div className="p-16 text-center space-y-8">
            <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto text-4xl shadow-inner">📨</div>
            <div>
              <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-white mb-2">Verification Sent</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">A verification link has been sent to <b>{email}</b>. Please check your inbox.</p>
            </div>
            <button onClick={() => setAuthView('login')} className="w-full text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:brightness-110" style={{ backgroundColor: branding.primaryColor }}>Return to Login</button>
          </div>
        )}

        {authView === 'reset_sent' && (
          <div className="p-16 text-center space-y-8">
            <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto text-4xl shadow-inner">🔐</div>
            <div>
              <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-white mb-2">Email Sent</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">If this email exists in our system, a reset link has been sent.</p>
            </div>
            <button onClick={() => setAuthView('login')} className="w-full text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:brightness-110" style={{ backgroundColor: branding.primaryColor }}>Return to Login</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;