import { useState, useEffect } from 'react';
import { User } from '../services/types';
import { api } from '../services/api';
import { useToast } from '../services/ToastContext';

export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const { addToast } = useToast();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response: any = await api.admin.getUsers();
        // Handle both direct array and paginated response { data: [] }
        const usersList = Array.isArray(response) ? response : (response.data || []);
        setUsers(usersList as User[]);
      } catch (e) {
        addToast('Failed to load user list.', 'error');
      }
    };
    fetchUsers();
  }, [addToast]);

  const refreshUsers = async () => {
    try {
      const response: any = await api.admin.getUsers();
      const usersList = Array.isArray(response) ? response : (response.data || []);
      setUsers(usersList as User[]);
    } catch (e) {
      // Silent error
    }
  };

  return { users, refreshUsers };
};
