
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
        const usersData = await api.admin.getUsers();
        setUsers(usersData);
      } catch (e) {
        addToast('Failed to load user list.', 'error');
      }
    };
    fetchUsers();
  }, [addToast]);

  const refreshUsers = async () => {
    try {
      const usersData = await api.admin.getUsers();
      setUsers(usersData);
    } catch (e) {
      // Silent error
    }
  };

  return { users, refreshUsers };
};
