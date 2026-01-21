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
  const [authView, setAuthView] = useState<'login' | 'register' | 'forgot' | 'verify_sent' | 'reset_sent'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.BASIC);
  const [error, setError] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = sanitize(email);
    if (!cleanEmail || !password) {
      setError('Email and password are required.');
      return;
    }

    try {
      const response = await api.auth.login(cleanEmail, password);
      // FIX: The api.auth.login method returns the user object directly.
      onLogin(response);
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

    // Simplified password check for development ease
    if (password.length < 3) {
      setError('Password must be at least 3 characters.');
      return;
    }

    try {
      await api.auth.register({ name: cleanName, email: cleanEmail, password, role });
      setAuthView('verify_sent');
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthView('reset_sent');
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
        <div className="p-10 text-center text-white relative" style={{ backgroundColor: branding.primaryColor }}>
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
            <form onSubmit={handleLoginSubmit} className="p-10 space-y-6">
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
                <input type="password" className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-indigo-500 dark:focus:border-indigo-500 outline-none text-slate-900 dark:text-white font-medium transition-all" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <button type="submit" className="w-full text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl active:scale-95 hover:brightness-110" style={{ backgroundColor: branding.primaryColor }}>Login</button>
            </form>
          </>
        )}

        {authView === 'register' && (
          <>
            <div className="flex border-b border-slate-100 dark:border-slate-800">
              <button onClick={() => { setAuthView('login'); setError(''); }} className="flex-1 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Sign In</button>
              <button className="flex-1 py-5 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400">Register</button>
            </div>
            <form onSubmit={handleRegisterSubmit} className="p-10 space-y-5">
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
                  <input type="password" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none text-slate-900 dark:text-white" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Role</label>
                  <select className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl outline-none text-slate-900 dark:text-white font-bold" value={role} onChange={e => setRole(e.target.value as UserRole)}>
                    <option value={UserRole.BASIC}>Candidate</option>
                    <option value={UserRole.ADMIN}>Administrator</option>
                    <option value={UserRole.SUPERADMIN}>Super Admin</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl hover:brightness-110 mt-2" style={{ backgroundColor: branding.primaryColor }}>Create Account</button>
            </form>
          </>
        )}

        {authView === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="p-10 space-y-6">
            <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Reset Password</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">We will send a password reset link to your email.</p>
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