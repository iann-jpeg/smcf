import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { 
  playNotificationSoundIfEnabled, 
  vibrateDevice, 
  showBrowserNotification,
  NotificationSoundType,
  isSoundEnabled,
  toggleSound
} from '../lib/notificationSounds';
import { updateFaviconBadge, updateTitleBadge } from '@/lib/faviconBadge';
import { initializePushNotifications, showPushNotification, isPushSupported } from '@/lib/pushNotifications';

// Notification types
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'payment' | 'loan' | 'savings' | 'announcement';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: any;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isOpen: boolean;
  soundEnabled: boolean;
}

type NotificationAction =
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'MARK_AS_READ'; payload: string }
  | { type: 'MARK_ALL_AS_READ' }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'SET_IS_OPEN'; payload: boolean }
  | { type: 'TOGGLE_SOUND'; payload: boolean }
  | { type: 'LOAD_NOTIFICATIONS'; payload: Notification[] };

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  isOpen: false,
  soundEnabled: isSoundEnabled(),
};

function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case 'ADD_NOTIFICATION': {
      const notifications = [action.payload, ...state.notifications].slice(0, 50); // Keep last 50
      return {
        ...state,
        notifications,
        unreadCount: notifications.filter(n => !n.read).length,
      };
    }
    case 'MARK_AS_READ': {
      const notifications = state.notifications.map(n =>
        n.id === action.payload ? { ...n, read: true } : n
      );
      return {
        ...state,
        notifications,
        unreadCount: notifications.filter(n => !n.read).length,
      };
    }
    case 'MARK_ALL_AS_READ': {
      const notifications = state.notifications.map(n => ({ ...n, read: true }));
      return {
        ...state,
        notifications,
        unreadCount: 0,
      };
    }
    case 'REMOVE_NOTIFICATION': {
      const notifications = state.notifications.filter(n => n.id !== action.payload);
      return {
        ...state,
        notifications,
        unreadCount: notifications.filter(n => !n.read).length,
      };
    }
    case 'CLEAR_ALL':
      return {
        ...state,
        notifications: [],
        unreadCount: 0,
      };
    case 'SET_IS_OPEN':
      return {
        ...state,
        isOpen: action.payload,
      };
    case 'TOGGLE_SOUND':
      toggleSound(action.payload);
      return {
        ...state,
        soundEnabled: action.payload,
      };
    case 'LOAD_NOTIFICATIONS':
      return {
        ...state,
        notifications: action.payload,
        unreadCount: action.payload.filter(n => !n.read).length,
      };
    default:
      return state;
  }
}

// Map notification type to sound type
function getSoundType(notificationType: NotificationType): NotificationSoundType {
  switch (notificationType) {
    case 'success':
    case 'payment':
    case 'savings':
      return 'success';
    case 'warning':
      return 'warning';
    case 'error':
      return 'error';
    case 'announcement':
      return 'message';
    default:
      return 'default';
  }
}

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Context type
interface NotificationContextType {
  state: NotificationState;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  setIsOpen: (isOpen: boolean) => void;
  toggleSoundEnabled: (enabled: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Storage key
const STORAGE_KEY = 'smcf-notifications';

// Provider component
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const initialized = useRef(false);

  // Initialize push notifications on mount
  useEffect(() => {
    if (isPushSupported()) {
      initializePushNotifications().catch(console.error);
    }
  }, []);

  // Update favicon badge when unread count changes
  useEffect(() => {
    updateFaviconBadge(state.unreadCount);
    updateTitleBadge(state.unreadCount, 'SMCF');
  }, [state.unreadCount]);

  // Load notifications from localStorage on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        const notifications = parsed.map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp),
        }));
        dispatch({ type: 'LOAD_NOTIFICATIONS', payload: notifications });
      }
    } catch (error) {
      console.warn('Failed to load notifications from storage:', error);
    }
  }, []);

  // Save notifications to localStorage when they change
  useEffect(() => {
    if (!initialized.current) return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notifications));
    } catch (error) {
      console.warn('Failed to save notifications to storage:', error);
    }
  }, [state.notifications]);

  // Add notification with sound and optional browser notification
  const addNotification = useCallback(
    async (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
      const newNotification: Notification = {
        ...notification,
        id: generateId(),
        timestamp: new Date(),
        read: false,
      };

      dispatch({ type: 'ADD_NOTIFICATION', payload: newNotification });

      // Play sound (always play for notifications)
      const soundType = getSoundType(notification.type);
      await playNotificationSoundIfEnabled(soundType);

      // Vibrate on mobile (strong vibration pattern)
      vibrateDevice([300, 100, 300, 100, 300]);

      // Show push notification (works even when app is in background or closed)
      if (isPushSupported()) {
        await showPushNotification(notification.title, {
          body: notification.message,
          tag: newNotification.id,
          playSound: false, // Already played above
        });
      } else if (document.hidden) {
        // Fallback to browser notification
        await showBrowserNotification(notification.title, {
          body: notification.message,
          tag: newNotification.id,
        });
      }
    },
    []
  );

  const markAsRead = useCallback((id: string) => {
    dispatch({ type: 'MARK_AS_READ', payload: id });
  }, []);

  const markAllAsRead = useCallback(() => {
    dispatch({ type: 'MARK_ALL_AS_READ' });
  }, []);

  const removeNotification = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const setIsOpen = useCallback((isOpen: boolean) => {
    dispatch({ type: 'SET_IS_OPEN', payload: isOpen });
  }, []);

  const toggleSoundEnabled = useCallback((enabled: boolean) => {
    dispatch({ type: 'TOGGLE_SOUND', payload: enabled });
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        state,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearAll,
        setIsOpen,
        toggleSoundEnabled,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// Hook to use notification context
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
