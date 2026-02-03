
import { useState, useEffect, useCallback } from 'react';
import { Question } from '../services/types';
import { api } from '../services/api';
import { useToast } from '../services/ToastContext';

export const useQuestions = () => {
    const [questions, setQuestions] = useState<Question[]>([]);
    const { addToast } = useToast();

    const fetchQuestions = useCallback(async () => {
        try {
            const data = await api.questions.list();
            setQuestions(data);
        } catch (e) {
            console.error(e);
            addToast('Failed to load questions', 'error');
        }
    }, [addToast]);

    // Removed auto-fetch to prevent 401 race condition. 
    // App.tsx handles the initial fetch when user is authenticated.
    // useEffect(() => {
    //    fetchQuestions();
    // }, [fetchQuestions]);

    const saveQuestion = async (question: Question) => {
        try {
            const saved = await api.questions.save(question);
            setQuestions(prev => {
                const idx = prev.findIndex(q => q.id === saved.id);
                if (idx > -1) {
                    const newArr = [...prev];
                    newArr[idx] = saved;
                    return newArr;
                }
                return [saved, ...prev];
            });
            addToast('Question saved', 'success');
            return saved;
        } catch (e) {
            addToast('Failed to save question', 'error');
            throw e;
        }
    };

    const deleteQuestion = async (id: string) => {
        try {
            await api.questions.delete(id);
            setQuestions(prev => prev.filter(q => q.id !== id));
            addToast('Question deleted', 'success');
        } catch (e) {
            addToast('Failed to delete question', 'error');
        }
    };

    return { questions, saveQuestion, deleteQuestion, refreshQuestions: fetchQuestions };
};
