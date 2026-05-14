import React, { useState, useEffect, memo, useCallback } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../theme.js';

// Notification types
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'security';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  action?: {
    label: string;
    key: string;
    handler: () => void;
  };
  duration?: number; // ms, 0 = no auto-dismiss
  timestamp: number;
}

// Notification context for managing global notifications
const NotificationContext = React.createContext<{
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
} | null>(null);

export function useNotifications() {
  const context = React.useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

// Notification Provider
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now(),
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-dismiss if duration is set
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration);
    }
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{ notifications, addNotification, removeNotification, clearAll }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// Individual toast component
const ToastItem = memo(function ToastItem({
  notification,
  onDismiss,
  onAction,
}: {
  notification: Notification;
  onDismiss: (id: string) => void;
  onAction?: (handler: () => void) => void;
}) {
  const theme = useTheme();
  const [isVisible, setIsVisible] = useState(false);

  // Fade-in animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const getTypeColor = (type: NotificationType): string => {
    switch (type) {
      case 'success':
        return theme.success;
      case 'warning':
        return theme.warning;
      case 'error':
        return theme.error;
      case 'security':
        return theme.error; // Red for security warnings
      case 'info':
      default:
        return theme.accent;
    }
  };

  const getTypeIcon = (type: NotificationType): string => {
    switch (type) {
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'security':
        return '🔒';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  const borderColor = getTypeColor(notification.type);
  const icon = getTypeIcon(notification.type);

  if (!isVisible) return null;

  return (
    <Box
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      marginBottom={0}
      flexDirection="column"
    >
      {/* Header with icon and title */}
      <Box flexDirection="row" columnGap={1}>
        <Text>{icon}</Text>
        <Text bold color={borderColor}>
          {notification.title}
        </Text>
        <Box flexGrow={1} />
        <Text dimColor bold>✕</Text>
      </Box>

      {/* Message */}
      {notification.message && (
        <Box paddingLeft={2} marginTop={0}>
          <Text>{notification.message}</Text>
        </Box>
      )}

      {/* Action button */}
      {notification.action && (
        <Box paddingLeft={2} marginTop={0}>
          <Text dimColor>Press </Text>
          <Text bold color={borderColor}>
            {notification.action.key}
          </Text>
          <Text dimColor> to {notification.action.label}</Text>
        </Box>
      )}
    </Box>
  );
});

// Main toast container
export const NotificationToast = memo(function NotificationToast() {
  const { notifications, removeNotification } = useNotifications();
  const [actionHandlers, setActionHandlers] = useState<Map<string, () => void>>(new Map());

  // Handle keyboard input for actions
  const handleAction = useCallback((handler: () => void) => {
    handler();
  }, []);

  // Only show recent notifications (last 3)
  const visibleNotifications = notifications.slice(-3);

  if (visibleNotifications.length === 0) return null;

  return (
    <Box
      flexDirection="column"
      width="100%"
    >
      {visibleNotifications.map(notification => (
        <ToastItem
          key={notification.id}
          notification={notification}
          onDismiss={removeNotification}
          onAction={handleAction}
        />
      ))}
    </Box>
  );
});

// Utility hooks for common notification types
export function useToast() {
  const { addNotification } = useNotifications();

  const toast = {
    info: (title: string, message?: string, duration = 3000) =>
      addNotification({ type: 'info', title, message, duration }),

    success: (title: string, message?: string, duration = 3000) =>
      addNotification({ type: 'success', title, message, duration }),

    warning: (title: string, message?: string, duration = 4000) =>
      addNotification({ type: 'warning', title, message, duration }),

    error: (title: string, message?: string, duration = 5000) =>
      addNotification({ type: 'error', title, message, duration }),

    security: (title: string, message?: string, action?: Notification['action']) =>
      addNotification({
        type: 'security',
        title,
        message,
        action,
        duration: 0, // Security warnings don't auto-dismiss
      }),
  };

  return toast;
}

// Clipboard utilities (for code copying)
export function useClipboard() {
  const toast = useToast();

  const copyToClipboard = async (text: string, label = 'Content') => {
    try {
      // Try browser clipboard API first
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard', `${label} copied successfully`);
        return true;
      }

      // For terminal environments, we can't safely copy to clipboard
      // Instead, show the content for manual copying
      toast.info('Copy manually', `Select and copy: ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`);
      return true;
    } catch (error) {
      toast.error('Copy failed', `Could not copy ${label.toLowerCase()}`);
      return false;
    }
  };

  return { copyToClipboard };
}

// Security notification utilities
export function useSecurityNotifications() {
  const toast = useToast();

  const warnSensitivePath = (path: string, action: () => void) => {
    toast.security(
      'Sensitive File Access',
      `Attempting to access: ${path}`,
      {
        label: 'proceed anyway',
        key: 'y',
        handler: action,
      }
    );
  };

  const warnRiskyCommand = (command: string, action: () => void) => {
    toast.security(
      'Risky Command Detected',
      `Command: ${command}`,
      {
        label: 'execute',
        key: 'y',
        handler: action,
      }
    );
  };

  const warnNetworkRequest = (url: string, action: () => void) => {
    toast.security(
      'Network Request',
      `Accessing: ${url}`,
      {
        label: 'allow',
        key: 'y',
        handler: action,
      }
    );
  };

  return {
    warnSensitivePath,
    warnRiskyCommand,
    warnNetworkRequest,
  };
}

// Tooltip component for contextual help
export const Tooltip = memo(function Tooltip({
  text,
  children,
  position = 'top',
}: {
  text: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}) {
  const [isVisible, setIsVisible] = useState(false);
  const theme = useTheme();

  // For now, just show tooltip on hover (limited in terminal)
  // In a real implementation, this would be triggered by focus events

  return (
    <Box flexDirection="column" position="relative">
      {position === 'top' && isVisible && (
        <Box
          borderStyle="single"
          borderColor={theme.dim}
          paddingX={1}
        >
          <Text dimColor>{text}</Text>
        </Box>
      )}

      <Box>
        {children}
      </Box>

      {position === 'bottom' && isVisible && (
        <Box
          borderStyle="single"
          borderColor={theme.dim}
          paddingX={1}
        >
          <Text dimColor>{text}</Text>
        </Box>
      )}
    </Box>
  );
});