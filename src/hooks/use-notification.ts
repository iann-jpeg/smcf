import { useCallback } from 'react';
import { useNotifications, NotificationType } from '@/contexts/NotificationContext';

// Convenient hook for adding notifications
export function useNotification() {
  const { addNotification, state } = useNotifications();

  const notify = useCallback(
    (
      title: string,
      message: string,
      type: NotificationType = 'info',
      data?: any
    ) => {
      addNotification({
        type,
        title,
        message,
        data,
      });
    },
    [addNotification]
  );

  // Shorthand methods for different notification types
  const notifySuccess = useCallback(
    (title: string, message: string, data?: any) => {
      notify(title, message, 'success', data);
    },
    [notify]
  );

  const notifyError = useCallback(
    (title: string, message: string, data?: any) => {
      notify(title, message, 'error', data);
    },
    [notify]
  );

  const notifyWarning = useCallback(
    (title: string, message: string, data?: any) => {
      notify(title, message, 'warning', data);
    },
    [notify]
  );

  const notifyPayment = useCallback(
    (title: string, message: string, data?: any) => {
      notify(title, message, 'payment', data);
    },
    [notify]
  );

  const notifyLoan = useCallback(
    (title: string, message: string, data?: any) => {
      notify(title, message, 'loan', data);
    },
    [notify]
  );

  const notifySavings = useCallback(
    (title: string, message: string, data?: any) => {
      notify(title, message, 'savings', data);
    },
    [notify]
  );

  const notifyAnnouncement = useCallback(
    (title: string, message: string, data?: any) => {
      notify(title, message, 'announcement', data);
    },
    [notify]
  );

  const notifyInfo = useCallback(
    (title: string, message: string, data?: any) => {
      notify(title, message, 'info', data);
    },
    [notify]
  );

  return {
    notify,
    notifySuccess,
    notifyError,
    notifyWarning,
    notifyPayment,
    notifyLoan,
    notifySavings,
    notifyAnnouncement,
    notifyInfo,
    unreadCount: state.unreadCount,
    soundEnabled: state.soundEnabled,
  };
}
