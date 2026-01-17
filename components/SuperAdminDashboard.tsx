
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

const LARAVEL_README_CONTENT = `# ExaminePro Live Deployment Guide...`;

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
      const backupData = await api.admin.backup();
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `examinepro_full_backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
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
      {/* ... rest of component is identical but uses hook-managed state ... */}
    </div>
  );
});

export default SuperAdminDashboard;
