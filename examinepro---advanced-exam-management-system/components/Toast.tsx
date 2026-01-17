
import React from 'react';
import { useToast } from '../services/ToastContext';

const Toast: React.FC<{ message: string, type: 'success' | 'error' | 'info', onDismiss: () => void }> = ({ message, type, onDismiss }) => {
  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️'
  };
  const colors = {
    success: 'bg-green-600 border-green-700',
    error: 'bg-red-600 border-red-700',
    info: 'bg-blue-600 border-blue-700'
  };

  return (
    <div 
      className={`flex items-center gap-4 text-white p-4 theme-rounded shadow-2xl animate-in fade-in slide-in-from-bottom-5 w-full max-w-sm border-b-4 ${colors[type]}`}
      onClick={onDismiss}
    >
      <span className="text-xl">{icons[type]}</span>
      <p className="font-bold text-sm flex-grow">{message}</p>
      <button onClick={onDismiss} className="text-white/50 hover:text-white">&times;</button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-8 right-8 z-[100] space-y-4">
      {toasts.map(toast => (
        <Toast 
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onDismiss={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};
