import { useNotifications } from '@/contexts/NotificationContext';
import { cn } from '@/lib/utils';

interface NotificationBadgeProps {
  className?: string;
  showZero?: boolean;
  max?: number;
}

export function NotificationBadge({ 
  className, 
  showZero = false, 
  max = 99 
}: NotificationBadgeProps) {
  const { state } = useNotifications();
  const { unreadCount } = state;

  if (!showZero && unreadCount === 0) {
    return null;
  }

  const displayCount = unreadCount > max ? `${max}+` : unreadCount;

  return (
    <span
      className={cn(
        'absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center',
        'bg-red-500 text-white text-xs font-bold rounded-full',
        'animate-pulse shadow-lg',
        'px-1',
        className
      )}
    >
      {displayCount}
    </span>
  );
}

// Simple dot indicator (no count)
export function NotificationDot({ className }: { className?: string }) {
  const { state } = useNotifications();
  const { unreadCount } = state;

  if (unreadCount === 0) {
    return null;
  }

  return (
    <span
      className={cn(
        'absolute top-0 right-0 w-3 h-3',
        'bg-red-500 rounded-full',
        'animate-pulse shadow-lg',
        'ring-2 ring-background',
        className
      )}
    />
  );
}
