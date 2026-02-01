
import React, { useState, useEffect, useMemo, memo } from 'react';
import { User, UserRole, AuditLog, DatabaseConfig, ApiKey, ApiScope, BlogPost } from '../services/types';
import { STORAGE_KEYS } from '../constants';
import { generateApiKey, sanitize, logEvent } from '../services/securityService';
import { SecureStorage } from '../services/storageService';
import { api } from '../services/api';
import { CONFIG } from '../services/config';
import { v4 as uuidv4 } from 'uuid';
import { useSystem } from '../services/SystemContext';
import { useUsers } from '../hooks/useUsers';
import { useToast } from '../services/ToastContext';
import ImageUpload from './ImageUpload';

interface SuperAdminDashboardProps {
  announcements: BlogPost[];
  onUpdateAnnouncements: (posts: BlogPost[]) => void;
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = memo(({ announcements, onUpdateAnnouncements }) => {
  const { settings, setSettings, branding, setBranding } = useSystem();
  const { users } = useUsers();
  const { addToast } = useToast();

  const [activeView, setActiveView] = useState<'system' | 'appearance' | 'audit' | 'users' | 'database' | 'api-keys' | 'email-server' | 'announcements'>('system');
  const [logFilter, setLogFilter] = useState<AuditLog['severity'] | 'ALL'>('ALL');
  const [logSearch, setLogSearch] = useState('');
  const [systemLoad, setSystemLoad] = useState(42);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [editingPost, setEditingPost] = useState<Partial<BlogPost> | null>(null);

  // Transaction State
  const [saveModal, setSaveModal] = useState<{ show: boolean, status: 'processing' | 'success' | 'error', message: string }>({ show: false, status: 'processing', message: '' });

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await api.admin.getLogs();
        setLogs(data);
      } catch (e) {
        // Silent fail or toast
      }
    };
    if (activeView === 'audit') fetchLogs();
  }, [activeView]);

  // Use Settings from Context (Server Synced) directly
  const apiKeys = settings.apiKeys || [];
  const dbConfigs = settings.dbConfigs || [];

  const updateSettings = async (updates: Partial<typeof settings>) => {
    // Optimistic Update
    const oldSettings = { ...settings };
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);

    try {
      await api.admin.updateSettings(updates);
    } catch (e) {
      console.error("Settings Update Failed:", e);
      setSettings(oldSettings); // Revert on failure
      addToast('Failed to save settings (server error)', 'error');
    }
  };

  const handleSaveDbConfig = async (config: DatabaseConfig) => {
    const newConfigs = dbConfigs.some(c => c.id === config.id)
      ? dbConfigs.map(c => c.id === config.id ? config : c)
      : [config, ...dbConfigs];
    await updateSettings({ dbConfigs: newConfigs });
    addToast('Database Config Saved', 'success');
  };

  const handleDeleteDbConfig = async (id: string) => {
    const newConfigs = dbConfigs.filter(c => c.id !== id);
    await updateSettings({ dbConfigs: newConfigs });
    addToast('Database Config Deleted', 'info');
  };

  useEffect(() => {
    const interval = setInterval(() => setSystemLoad(prev => Math.max(10, Math.min(95, prev + (Math.random() * 10 - 5)))), 3000);
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const matchesSeverity = logFilter === 'ALL' || l.severity === logFilter;
      const matchesSearch = logSearch === '' ||
        l.action.toLowerCase().includes(logSearch.toLowerCase()) ||
        l.details.toLowerCase().includes(logSearch.toLowerCase());
      return matchesSeverity && matchesSearch;
    });
  }, [logs, logFilter, logSearch]);

  const handleBackup = async () => {
    try {
      const backupData = {
        timestamp: new Date().toISOString(),
        settings,
        branding,
        users: await api.admin.getUsers(), // Fetch fresh user list
        logs: await api.admin.getLogs(),
        announcements
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addToast('System backup downloaded.', 'success');
      // Log event
      logEvent(null, 'System Backup', 'User initiated full system backup download');
    } catch (e) {
      addToast("Backup failed to generate.", 'error');
    }
  };

  const handleSavePost = () => {
    if (!editingPost || !editingPost.title) return;
    const finalPost: BlogPost = {
      id: editingPost.id || uuidv4(),
      title: sanitize(editingPost.title),
      content: sanitize(editingPost.content || ''),
      authorId: 'SUPERADMIN',
      authorName: 'System Admin',
      createdAt: editingPost.createdAt || Date.now(),
      published: editingPost.published ?? true,
    };
    const updated = finalPost.id === editingPost.id
      ? announcements.map(p => (p.id === finalPost.id ? finalPost : p))
      : [finalPost, ...announcements];
    onUpdateAnnouncements(updated);
    setEditingPost(null);
  };

  return (
    <div className="space-y-10 pb-24">
      {/* Header */}
      <header className="flex justify-between items-center bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-sm">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 dark:text-white mb-2">System Core</h1>
          <div className="flex gap-4 items-center">
            <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] uppercase font-black tracking-widest rounded-full">Super Admin</span>
            <span className="text-xs font-bold text-slate-400">v2.4.0-stable</span>
          </div>
        </div>
        <div className="flex gap-6">
          <div className="text-right">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">System Load</div>
            <div className="text-2xl font-black text-indigo-600">{systemLoad.toFixed(1)}%</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Uptime</div>
            <div className="text-2xl font-black text-emerald-500">99.9%</div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="flex overflow-x-auto gap-2 pb-2">
        {['system', 'appearance', 'users', 'audit', 'announcements', 'database', 'api-keys', 'email-server'].map((view) => (
          <button
            key={view}
            onClick={() => setActiveView(view as any)}
            className={`px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all whitespace-nowrap ${activeView === view
              ? 'bg-slate-900 text-white shadow-lg scale-105'
              : 'bg-white dark:bg-slate-900 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
          >
            {view.replace('-', ' ')}
          </button>
        ))}
      </nav>

      {/* Content Area */}
      <main className="min-h-[500px]">

        {activeView === 'system' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-900 p-10 theme-rounded shadow-sm">
              <h2 className="font-black text-2xl uppercase mb-6">System Settings</h2>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-xl">
                  <span className="font-bold">AI Grading</span>
                  <button onClick={async () => {
                    const newSettings = { ...settings, aiGradingEnabled: !settings.aiGradingEnabled };
                    setSettings(newSettings); // Local update
                    try {
                      await api.admin.updateSettings(newSettings); // Server sync
                      addToast('Settings saved', 'success');
                    } catch {
                      addToast('Failed to save settings', 'error');
                    }
                  }}
                    className={`px-4 py-2 rounded font-bold text-xs uppercase ${settings.aiGradingEnabled ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {settings.aiGradingEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-xl">
                  <span className="font-bold">Maintenance Mode</span>
                  <button onClick={() => updateSettings({ maintenanceMode: !settings.maintenanceMode })}
                    className={`px-4 py-2 rounded font-bold text-xs uppercase ${settings.maintenanceMode ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {settings.maintenanceMode ? 'Active' : 'Disabled'}
                  </button>
                </div>
                <button onClick={handleBackup} className="w-full py-4 bg-slate-900 text-white font-black uppercase rounded-xl hover:bg-slate-800">Download System Backup</button>
              </div>
            </div>
          </div>
        )}

        {activeView === 'appearance' && (
          <div className="bg-white dark:bg-slate-900 p-10 theme-rounded shadow-sm animate-in fade-in slide-in-from-bottom-2">
            <h2 className="font-black text-2xl uppercase mb-6">Theme & Branding</h2>
            <div className="space-y-8 max-w-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">App Name</label>
                  <input
                    className="w-full p-4 font-bold bg-slate-50 dark:bg-slate-950 rounded-xl border-2 border-transparent focus:border-indigo-500 outline-none transition-colors"
                    value={branding.appName}
                    onChange={e => setBranding({ ...branding, appName: e.target.value })}
                  />
                </div>
                <div className="space-y-4">
                  <ImageUpload
                    label="App Logo (Header)"
                    value={branding.appIcon}
                    onChange={(val) => setBranding({ ...branding, appIcon: val })}
                    placeholder="https://... or Upload"
                  />
                  <ImageUpload
                    label="Favicon (Browser Tab)"
                    value={branding.faviconUrl}
                    onChange={(val) => setBranding({ ...branding, faviconUrl: val })}
                    placeholder="https://... or Upload"
                    description="If empty, defaults to App Logo."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Primary Color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      className="h-10 w-10 rounded cursor-pointer border-none bg-transparent"
                      value={branding.primaryColor}
                      onChange={e => setBranding({ ...branding, primaryColor: e.target.value })}
                    />
                    <input
                      className="flex-1 p-3 font-mono text-xs font-bold bg-slate-50 dark:bg-slate-950 rounded-xl outline-none uppercase"
                      value={branding.primaryColor}
                      onChange={e => setBranding({ ...branding, primaryColor: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Border Radius</label>
                  <select
                    className="w-full p-3 font-bold bg-slate-50 dark:bg-slate-950 rounded-xl outline-none"
                    value={branding.borderRadius}
                    onChange={e => setBranding({ ...branding, borderRadius: e.target.value })}
                  >
                    <option value="0px">Sharp (0px)</option>
                    <option value="8px">Soft (8px)</option>
                    <option value="16px">Rounded (16px)</option>
                    <option value="24px">Modern (24px)</option>
                  </select>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <label className="block text-xs font-black uppercase tracking-widest text-indigo-600 mb-2">Footer Customization</label>
                <p className="text-[10px] text-slate-400 mb-4 font-bold">
                  Super Admin Only. Use <span className="font-mono text-indigo-500 bg-white dark:bg-slate-900 px-1 rounded">{'{year}'}</span> as a placeholder for the current year.
                </p>
                <input
                  className="w-full p-3 font-bold bg-white dark:bg-slate-900 rounded-xl border-2 border-slate-200 dark:border-slate-800 focus:border-indigo-500 outline-none transition-colors placeholder:text-slate-300"
                  placeholder="© {year} ExaminePro. All Rights Reserved."
                  value={branding.footerText || ''}
                  onChange={e => setBranding({ ...branding, footerText: e.target.value })}
                />
                <div className="mt-2 text-right">
                  <span className="text-[9px] font-black uppercase text-slate-400">Preview: </span>
                  <span className="text-[10px] text-slate-500">
                    {branding.footerText
                      ? branding.footerText.replace('{year}', String(new Date().getFullYear()))
                      : `© ${new Date().getFullYear()} ${branding.appName}. All Rights Reserved.`
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'users' && (
          <div className="bg-white dark:bg-slate-900 p-10 theme-rounded shadow-sm">
            <h2 className="font-black text-2xl uppercase mb-6">User Management ({users.length})</h2>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-black uppercase text-slate-400">
                  <th className="p-3">User</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="p-3 font-bold">{u.name}<br /><span className="text-xs font-normal text-slate-400">{u.email}</span></td>
                    <td className="p-3"><span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-black">{u.role}</span></td>
                    <td className="p-3"><span className={`px-2 py-1 rounded text-[10px] font-black ${u.isVerified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{u.isVerified ? 'VERIFIED' : 'PENDING'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeView === 'audit' && (
          <div className="bg-white dark:bg-slate-900 p-10 theme-rounded shadow-sm">
            <div className="flex justify-between mb-6">
              <h2 className="font-black text-2xl uppercase">Audit Logs</h2>
              <input className="bg-slate-50 p-2 rounded border" placeholder="Search..." value={logSearch} onChange={e => setLogSearch(e.target.value)} />
            </div>
            <div className="space-y-2">
              {filteredLogs.slice(0, 50).map(log => (
                <div key={log.id} className="p-4 border-l-4 border-indigo-500 bg-slate-50 dark:bg-slate-950">
                  <div className="flex justify-between">
                    <span className="font-bold text-xs uppercase">{log.action}</span>
                    <span className="textxs text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-sm mt-1">{log.details}</p>
                  <div className="text-xs text-slate-400 mt-2">User: {log.userName}</div>
                </div>
              ))}
              {filteredLogs.length === 0 && <p>No logs found.</p>}
            </div>
          </div>
        )}

        {activeView === 'database' && (
          <div className="bg-white dark:bg-slate-900 p-10 theme-rounded shadow-sm">
            <div className="flex justify-between mb-6">
              <h2 className="font-black text-2xl uppercase">Database connections</h2>
              <button onClick={() => handleSaveDbConfig({ id: uuidv4(), name: 'New DB', type: 'postgres', host: 'localhost', port: 5432, username: 'postgres', database: 'postgres' })} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold uppercase text-xs">+ New Connection</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dbConfigs.map(config => (
                <div key={config.id} className="p-6 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-lg">{config.name}</h3>
                    <button onClick={() => handleDeleteDbConfig(config.id)} className="text-red-500 text-xs font-black uppercase hover:underline">Remove</button>
                  </div>
                  <div className="space-y-2 text-xs font-mono text-slate-500">
                    <div className="flex justify-between"><span>Type:</span> <span className="text-slate-900 dark:text-white uppercase">{config.type}</span></div>
                    <div className="flex justify-between"><span>Host:</span> <span className="text-slate-900 dark:text-white">{config.host}:{config.port}</span></div>
                    <div className="flex justify-between"><span>User:</span> <span className="text-slate-900 dark:text-white">{config.username}</span></div>
                    <div className="flex justify-between"><span>DB:</span> <span className="text-slate-900 dark:text-white">{config.database}</span></div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex gap-2">
                    <button className="flex-1 py-2 bg-slate-200 dark:bg-slate-800 rounded font-bold text-xs uppercase text-slate-500 hover:text-slate-900">Test Connection</button>
                  </div>
                </div>
              ))}
              {dbConfigs.length === 0 && <p className="col-span-2 text-center text-slate-400 py-10">No external databases configured.</p>}
            </div>
          </div>
        )}

        {activeView === 'api-keys' && (
          <div className="bg-white dark:bg-slate-900 p-10 theme-rounded shadow-sm">
            <div className="flex justify-between mb-6">
              <h2 className="font-black text-2xl uppercase">API Access Keys</h2>
              <button onClick={async () => {
                const newKey: ApiKey = {
                  id: uuidv4(),
                  key: generateApiKey(),
                  name: `Key ${apiKeys.length + 1}`,
                  scopes: [ApiScope.READ_ONLY],
                  createdAt: Date.now(),
                  // lastUsedAt: undefined // Optional parameter
                };
                await updateSettings({ apiKeys: [newKey, ...apiKeys] });
                addToast('New API Key Generated', 'success');
              }} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold uppercase text-xs">+ Generate Key</button>
            </div>
            <div className="space-y-4">
              {apiKeys.map(key => (
                <div key={key.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="font-bold">{key.name}</div>
                    <code className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded mt-1 block w-fit">{key.key}</code>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Scopes</div>
                      <div className="text-xs font-bold">{key.scopes.join(', ')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Created</div>
                      <div className="text-xs font-bold">{new Date(key.createdAt).toLocaleDateString()}</div>
                    </div>
                    <button onClick={async () => {
                      await updateSettings({ apiKeys: apiKeys.filter(k => k.id !== key.id) });
                      addToast('API Key Revoked', 'info');
                    }} className="text-red-500 text-xs font-black uppercase hover:underline">Revoke</button>
                  </div>
                </div>
              ))}
              {apiKeys.length === 0 && <p className="text-center text-slate-400 py-10">No active API keys.</p>}
            </div>
          </div>
        )}

        {activeView === 'announcements' && (
          <div className="bg-white dark:bg-slate-900 p-10 theme-rounded shadow-sm">
            <div className="flex justify-between mb-6">
              <h2 className="font-black text-2xl uppercase">Announcements</h2>
              <button onClick={() => setEditingPost({ title: '', content: '' })} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold uppercase text-xs">+ New Post</button>
            </div>

            {editingPost ? (
              <div className="space-y-4 bg-slate-50 p-6 rounded-xl">
                <input className="w-full p-2 font-bold" placeholder="Title" value={editingPost.title} onChange={e => setEditingPost({ ...editingPost, title: e.target.value })} />
                <textarea className="w-full p-2 h-32" placeholder="Content" value={editingPost.content} onChange={e => setEditingPost({ ...editingPost, content: e.target.value })} />
                <div className="flex gap-2">
                  <button onClick={handleSavePost} className="bg-green-600 text-white px-6 py-2 rounded font-bold uppercase text-xs">Publish</button>
                  <button onClick={() => setEditingPost(null)} className="text-slate-500 font-bold uppercase text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {announcements.map(post => (
                  <div key={post.id} className="p-4 border rounded bg-slate-50 group relative">
                    <h3 className="font-bold">{post.title}</h3>
                    <p className="text-sm text-slate-600 mt-1">{post.content}</p>
                    <div className="text-xs text-slate-400 mt-2">By {post.authorName} on {new Date(post.createdAt).toLocaleDateString()}</div>
                    <button onClick={() => setEditingPost(post)} className="absolute top-4 right-4 text-indigo-600 text-xs font-bold uppercase opacity-0 group-hover:opacity-100">Edit</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeView === 'email-server' && (
          <div className="bg-white dark:bg-slate-900 p-10 theme-rounded shadow-sm">
            <h2 className="font-black text-2xl uppercase mb-6">Email Server Config</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* SMTP CONFIG */}
              <div className="space-y-4">
                <h3 className="font-bold uppercase text-xs tracking-widest text-slate-400">SMTP Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="Host (e.g. smtp.gmail.com)" value={settings.smtpConfig?.host || ''} onChange={e => setSettings({ ...settings, smtpConfig: { ...settings.smtpConfig!, host: e.target.value } })} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg font-bold" />
                  <input placeholder="Port (e.g. 587)" value={settings.smtpConfig?.port || ''} onChange={e => setSettings({ ...settings, smtpConfig: { ...settings.smtpConfig!, port: parseInt(e.target.value) || 587 } })} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="User" value={settings.smtpConfig?.user || ''} onChange={e => setSettings({ ...settings, smtpConfig: { ...settings.smtpConfig!, user: e.target.value } })} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg font-bold" />
                  <input type="password" placeholder="Password" value={settings.smtpConfig?.pass || ''} onChange={e => setSettings({ ...settings, smtpConfig: { ...settings.smtpConfig!, pass: e.target.value } })} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="From Name" value={settings.smtpConfig?.fromName || ''} onChange={e => setSettings({ ...settings, smtpConfig: { ...settings.smtpConfig!, fromName: e.target.value } })} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg font-bold" />
                  <input placeholder="From Email" value={settings.smtpConfig?.fromEmail || ''} onChange={e => setSettings({ ...settings, smtpConfig: { ...settings.smtpConfig!, fromEmail: e.target.value } })} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg font-bold" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={settings.smtpConfig?.secure || false} onChange={e => setSettings({ ...settings, smtpConfig: { ...settings.smtpConfig!, secure: e.target.checked } })} />
                  <span className="text-sm font-bold text-slate-500">Secure (SSL/TLS)</span>
                </div>
                <div className="flex gap-4 items-center pt-4 border-t border-slate-100 dark:border-slate-800">
                  <input id="test-email-dest" placeholder="Test Dest Email" className="flex-1 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg font-bold text-xs" />
                  <button onClick={async () => {
                    const dest = (document.getElementById('test-email-dest') as HTMLInputElement).value;
                    if (!dest) { addToast('Enter email to test', 'error'); return; }

                    try {
                      // We save first to ensure we test current config
                      await updateSettings({ smtpConfig: settings.smtpConfig });
                      const res = await api.admin.testEmail(dest);
                      addToast(res.message, 'success');
                      // TODO: Modal? User asked for modal. Toast with message is success.
                      // Let's Alert for now or fancy modal if time.
                      alert(`Validation Response:\nSuccess: ${res.success}\nMessage: ${res.message}`);
                    } catch (e) {
                      addToast('Connection Test Failed', 'error');
                      alert('Connection Failed. Check console/network logs.');
                    }
                  }} className="bg-slate-800 text-white px-6 py-3 rounded-lg font-bold uppercase text-xs">Test Connection</button>
                </div>
                <button onClick={async () => {
                  setSaveModal({ show: true, status: 'processing', message: 'Verifying and Saving Configuration...' });
                  try {
                    await updateSettings({ smtpConfig: settings.smtpConfig });
                    setSaveModal({ show: true, status: 'success', message: 'SMTP Configuration Saved Successfully!' });
                    setTimeout(() => setSaveModal(prev => ({ ...prev, show: false })), 2000);
                  } catch (e) {
                    setSaveModal({ show: true, status: 'error', message: 'Failed to save configuration.' });
                  }
                }} className="w-full py-3 bg-indigo-600 text-white font-bold uppercase rounded-lg">Save Config</button>
              </div>

              {/* BROADCAST */}
              <div className="space-y-4 border-l pl-8 border-slate-100 dark:border-slate-800">
                <h3 className="font-bold uppercase text-xs tracking-widest text-slate-400">Broadcast Email</h3>
                <input id="broadcast-subject" placeholder="Subject" className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-lg font-bold" />
                <textarea id="broadcast-message" placeholder="Message (HTML allowed)" className="w-full h-32 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg text-sm" />
                <select id="broadcast-role" className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-lg font-bold text-xs uppercase">
                  <option value="ALL">All Users</option>
                  <option value="CANDIDATE">Candidates Only</option>
                  <option value="ADMIN">Admins Only</option>
                </select>
                <button onClick={async () => {
                  const subj = (document.getElementById('broadcast-subject') as HTMLInputElement).value;
                  const msg = (document.getElementById('broadcast-message') as HTMLTextAreaElement).value;
                  const role = (document.getElementById('broadcast-role') as HTMLSelectElement).value;
                  if (!subj || !msg) { addToast("Subject/Message required", 'error'); return; }
                  if (!confirm(`Send to ${role}?`)) return;

                  try {
                    const res = await fetch('/api/admin/broadcast', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ subject: subj, message: msg, targetRole: role })
                    });
                    const data = await res.json();
                    if (data.success) addToast(`Sent to ${data.sent} users.`, 'success');
                    else addToast('Failed to send.', 'error');
                  } catch (e) { addToast('Network error', 'error'); }
                }} className="w-full py-3 bg-emerald-600 text-white font-bold uppercase rounded-lg">Send Broadcast</button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Transaction Modal */}
      {saveModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center space-y-4 animate-in zoom-in-95">
            {saveModal.status === 'processing' && (
              <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            )}
            {saveModal.status === 'success' && (
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-3xl">✓</div>
            )}
            {saveModal.status === 'error' && (
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-3xl">✕</div>
            )}

            <h3 className="font-black text-xl uppercase">{saveModal.status === 'processing' ? 'Processing' : saveModal.status === 'success' ? 'Success' : 'Error'}</h3>
            <p className="text-slate-500 font-medium">{saveModal.message}</p>

            {saveModal.status === 'error' && (
              <button onClick={() => setSaveModal(prev => ({ ...prev, show: false }))} className="bg-slate-100 hover:bg-slate-200 text-slate-900 px-6 py-2 rounded-lg font-bold uppercase text-xs">Close</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default SuperAdminDashboard;
