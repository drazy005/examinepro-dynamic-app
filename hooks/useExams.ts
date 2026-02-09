
import { useState, useEffect, useCallback } from 'react';
import { Exam } from '../services/types';
import { api } from '../services/api';
import { useToast } from '../services/ToastContext';

export const useExams = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const { addToast } = useToast();

  // Auto-fetch removed to prevent 401s on non-admin users.
  // App.tsx or specific components will call refreshExams when appropriate.
  // useEffect(() => {
  //   const fetchExams = async () => { ... }
  //   fetchExams();
  // }, [addToast]);

  const saveExam = useCallback(async (exam: Exam) => {
    try {
      const isUpdate = exams.some(x => x.id === exam.id);
      let saved: Exam;

      if (isUpdate) {
        saved = await api.exams.update(exam.id, exam);
      } else {
        saved = await api.exams.create(exam);
      }

      setExams(prev =>
        prev.some(x => x.id === saved.id)
          ? prev.map(x => x.id === saved.id ? saved : x)
          : [saved, ...prev]
      );
      addToast('Exam saved successfully!', 'success');
      return saved;
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to save exam.', 'error');
      throw err;
    }
  }, [exams, addToast]);

  const deleteExam = useCallback(async (id: string) => {
    const originalExams = [...exams];
    setExams(prev => prev.filter(x => x.id !== id)); // Optimistic update
    try {
      await api.exams.delete(id);
      addToast('Exam deleted.', 'success');
    } catch (err) {
      addToast('Failed to delete exam.', 'error');
      setExams(originalExams); // Revert on error
    }
  }, [exams, addToast]);

  const bulkDeleteExams = useCallback(async (ids: string[]) => {
    const originalExams = [...exams];
    setExams(prev => prev.filter(x => !ids.includes(x.id))); // Optimistic update
    try {
      await Promise.all(ids.map(id => api.exams.delete(id)));
      addToast(`${ids.length} exams deleted.`, 'success');
    } catch (err) {
      addToast('Bulk deletion failed.', 'error');
      setExams(originalExams); // Revert on error
    }
  }, [exams, addToast]);

  const refreshExams = useCallback(async (silent = false) => {
    try {
      const examsData = await api.exams.list();
      setExams(examsData);
    } catch (e: any) {
      if (!silent && e.message !== 'Unauthorized' && e.message !== 'Forbidden') {
        addToast('Failed to load exams.', 'error');
      }
    }
  }, [addToast]);

  return { exams, setExams, saveExam, deleteExam, bulkDeleteExams, refreshExams };
};
