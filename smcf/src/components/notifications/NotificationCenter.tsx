import { useState } from 'react';
import { useNotifications, Notification, NotificationType } from '@/contexts/NotificationContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { NotificationBadge } from './NotificationBadge';
import { 
  Bell, 
  BellOff,
  Check, 
  CheckCheck, 
  Trash2, 
  Volume2, 
  VolumeX,
  DollarSign,
  Wallet,
  CreditCard,
  Megaphone,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Info,
  X
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// Get icon for notification type
function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'payment':
      return <DollarSign className="h-4 w-4 text-blue-500" />;
    case 'loan':
      return <CreditCard className="h-4 w-4 text-purple-500" />;
    case 'savings':
      return <Wallet className="h-4 w-4 text-emerald-500" />;
    case 'announcement':
      return <Megaphone className="h-4 w-4 text-orange-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
}

// Get background color for notification type
function getNotificationBg(type: NotificationType, read: boolean) {
  if (read) return 'bg-muted/30';
  
  switch (type) {
    case 'success':
      return 'bg-green-50 dark:bg-green-950/30';
    case 'error':
      return 'bg-red-50 dark:bg-red-950/30';
    case 'warning':
      return 'bg-yellow-50 dark:bg-yellow-950/30';
    case 'payment':
      return 'bg-blue-50 dark:bg-blue-950/30';
    case 'loan':
      return 'bg-purple-50 dark:bg-purple-950/30';
    case 'savings':
      return 'bg-emerald-50 dark:bg-emerald-950/30';
    case 'announcement':
      return 'bg-orange-50 dark:bg-orange-950/30';
    default:
      return 'bg-blue-50 dark:bg-blue-950/30';
  }
}

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onRemove: (id: string) => void;
}

function NotificationItem({ notification, onMarkAsRead, onRemove }: NotificationItemProps) {
  return (
    <div
      className={cn(
        'p-3 border-b last:border-b-0 transition-colors',
        getNotificationBg(notification.type, notification.read),
        !notification.read && 'border-l-2 border-l-primary'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getNotificationIcon(notification.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className={cn(
              'text-sm truncate',
              !notification.read && 'font-semibold'
            )}>
              {notification.title}
            </h4>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          {notification.action && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 mt-1 text-xs"
              onClick={notification.action.onClick}
            >
              {notification.action.label}
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-1">
          {!notification.read && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onMarkAsRead(notification.id)}
              title="Mark as read"
            >
              <Check className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(notification.id)}
            title="Remove"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function NotificationCenter() {
  const { 
    state, 
    markAsRead, 
    markAllAsRead, 
    removeNotification, 
    clearAll,
    setIsOpen,
    toggleSoundEnabled 
  } = useNotifications();
  
  const { notifications, unreadCount, isOpen, soundEnabled } = state;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          {soundEnabled ? (
            <Bell className="h-5 w-5" />
          ) : (
            <BellOff className="h-5 w-5 text-muted-foreground" />
          )}
          <NotificationBadge />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 sm:w-96 p-0" 
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => toggleSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Mute notifications' : 'Unmute notifications'}
            >
              {soundEnabled ? (
                <Volume2 className="h-3.5 w-3.5" />
              ) : (
                <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={markAllAsRead}
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={clearAll}
                title="Clear all"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Notification list */}
        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
              <p className="text-xs">You'll see updates here</p>
            </div>
          ) : (
            <div>
              {notifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onRemove={removeNotification}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer - Sound toggle */}
        <div className="flex items-center justify-between p-3 border-t bg-muted/30">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
            <span>Sound notifications</span>
          </div>
          <Switch
            checked={soundEnabled}
            onCheckedChange={toggleSoundEnabled}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
