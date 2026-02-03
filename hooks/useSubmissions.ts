
import { useState, useEffect, useCallback } from 'react';
import { Submission } from '../services/types';
import { api } from '../services/api';
import { useToast } from '../services/ToastContext';

export const useSubmissions = () => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const { addToast } = useToast();

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const subsData = await api.submissions.list();
        setSubmissions(subsData);
      } catch (e) {
        addToast('Failed to load submissions.', 'error');
      }
    };
    fetchSubmissions();
  }, [addToast]);

  const updateSubmission = useCallback(async (sub: Submission) => {
    try {
      const updated = await api.submissions.update(sub);
      if (updated) {
        setSubmissions(prev => prev.map(s => s.id === updated.id ? updated : s));
      }
      return updated;
    } catch (e) {
      addToast('Failed to update submission.', 'error');
      throw e;
    }
  }, [addToast]);

  const bulkDeleteSubmissions = useCallback(async (ids: string[]) => {
    const originalSubs = [...submissions];
    setSubmissions(prev => prev.filter(s => !ids.includes(s.id)));
    try {
      await Promise.all(ids.map(id => api.submissions.delete(id)));
      addToast(`${ids.length} submissions deleted.`, 'success');
    } catch (err) {
      addToast('Bulk deletion failed.', 'error');
      setSubmissions(originalSubs);
    }
  }, [submissions, addToast]);

  const refreshSubmissions = useCallback(async () => {
    try {
      const subsData = await api.submissions.list();
      setSubmissions(subsData);
    } catch (e) {
      console.error(e); // Silent or toast
    }
  }, []);

  return { submissions, setSubmissions, updateSubmission, bulkDeleteSubmissions, refreshSubmissions };
};
