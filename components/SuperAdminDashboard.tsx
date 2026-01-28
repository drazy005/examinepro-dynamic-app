
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

interface SuperAdminDashboardProps {
  dbConfigs: DatabaseConfig[];
  announcements: BlogPost[];
  onUpdateAnnouncements: (posts: BlogPost[]) => void;
  onSaveDbConfig: (config: DatabaseConfig) => void;
  onDeleteDbConfig: (id: string) => void;
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = memo(({ announcements, onUpdateAnnouncements, onDeleteDbConfig }) => {
  const { settings, setSettings, branding, setBranding } = useSystem();
  const { users } = useUsers();
  const { addToast } = useToast();

  const [activeView, setActiveView] = useState<'system' | 'appearance' | 'audit' | 'users' | 'database' | 'api-keys' | 'deployment' | 'announcements'>('system');
  const [logFilter, setLogFilter] = useState<AuditLog['severity'] | 'ALL'>('ALL');
  const [logSearch, setLogSearch] = useState('');
  const [systemLoad, setSystemLoad] = useState(42);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [editingPost, setEditingPost] = useState<Partial<BlogPost> | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await api.admin.getLogs();
        setLogs(data);
      } catch (e) {
        addToast('Failed to fetch audit logs.', 'error');
      }
    };
    if (activeView === 'audit') fetchLogs();
  }, [activeView, addToast]);

  const [apiKeys, setApiKeys] = useState<ApiKey[]>(() => SecureStorage.load(STORAGE_KEYS.API_KEYS, []));

  useEffect(() => {
    const interval = setInterval(() => setSystemLoad(prev => Math.max(10, Math.min(95, prev + (Math.random() * 10 - 5)))), 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    SecureStorage.save(STORAGE_KEYS.API_KEYS, apiKeys);
  }, [apiKeys]);

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
      // Mock backup for now
      addToast('System backup initiated.', 'success');
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
        {['system', 'users', 'audit', 'announcements'].map((view) => (
          <button
            key={view}
            onClick={() => setActiveView(view as any)}
            className={`px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all whitespace-nowrap ${activeView === view
                ? 'bg-slate-900 text-white shadow-lg scale-105'
                : 'bg-white dark:bg-slate-900 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
          >
            {view}
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
                  <button onClick={() => setSettings({ ...settings, aiGradingEnabled: !settings.aiGradingEnabled })}
                    className={`px-4 py-2 rounded font-bold text-xs uppercase ${settings.aiGradingEnabled ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {settings.aiGradingEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-xl">
                  <span className="font-bold">Maintenance Mode</span>
                  <button className="px-4 py-2 rounded font-bold text-xs uppercase bg-slate-200 text-slate-500">Disabled</button>
                </div>
                <button onClick={handleBackup} className="w-full py-4 bg-slate-900 text-white font-black uppercase rounded-xl hover:bg-slate-800">Download System Backup</button>
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

      </main>
    </div>
  );
});

export default SuperAdminDashboard;
