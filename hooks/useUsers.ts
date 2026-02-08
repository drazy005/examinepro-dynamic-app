import { useState, useEffect, useCallback } from 'react';
import { User } from '../services/types';
import { api } from '../services/api';
import { useToast } from '../services/ToastContext';

export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const { addToast } = useToast();

  const fetchUsers = useCallback(async (silent = false) => {
    try {
      const response: any = await api.admin.users();
      // Handle both direct array and paginated response { data: [] }
      const usersList = Array.isArray(response) ? response : (response.data || []);
      setUsers(usersList as User[]);
    } catch (e) {
      if (!silent) addToast('Failed to load user list.', 'error');
    }
  }, [addToast]);

  useEffect(() => {
    fetchUsers(true); // Silent initial fetch
  }, [fetchUsers]);

  const refreshUsers = (silent = false) => fetchUsers(silent);

  return { users, refreshUsers };
};
