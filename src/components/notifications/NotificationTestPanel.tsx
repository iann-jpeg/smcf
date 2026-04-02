import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNotification } from '@/hooks/use-notification';
import { playNotificationSound, NotificationSoundType } from '@/lib/notificationSounds';
import { Bell, Volume2 } from 'lucide-react';

// Test component for notification system - can be added temporarily to any page for testing
export function NotificationTestPanel() {
  const { 
    notify, 
    notifySuccess, 
    notifyError, 
    notifyWarning, 
    notifyPayment, 
    notifyLoan, 
    notifySavings, 
    notifyAnnouncement 
  } = useNotification();

  const testSound = async (type: NotificationSoundType) => {
    await playNotificationSound(type);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Test Panel
        </CardTitle>
        <CardDescription>
          Test different notification types and sounds
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sound Tests */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Sound Tests
          </h4>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => testSound('default')}>
              Default
            </Button>
            <Button size="sm" variant="outline" onClick={() => testSound('success')}>
              Success
            </Button>
            <Button size="sm" variant="outline" onClick={() => testSound('warning')}>
              Warning
            </Button>
            <Button size="sm" variant="outline" onClick={() => testSound('error')}>
              Error
            </Button>
            <Button size="sm" variant="outline" onClick={() => testSound('message')}>
              Message
            </Button>
          </div>
        </div>

        {/* Notification Tests */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notification Tests
          </h4>
          <div className="flex flex-wrap gap-2">
            <Button 
              size="sm" 
              variant="default"
              onClick={() => notifySuccess('Success!', 'This is a success notification')}
            >
              Success
            </Button>
            <Button 
              size="sm" 
              variant="destructive"
              onClick={() => notifyError('Error!', 'This is an error notification')}
            >
              Error
            </Button>
            <Button 
              size="sm" 
              variant="secondary"
              onClick={() => notifyWarning('Warning!', 'This is a warning notification')}
            >
              Warning
            </Button>
            <Button 
              size="sm" 
              className="bg-blue-500 hover:bg-blue-600 text-white"
              onClick={() => notifyPayment('Payment Received', 'John Doe paid KES 1,000')}
            >
              Payment
            </Button>
            <Button 
              size="sm" 
              className="bg-purple-500 hover:bg-purple-600 text-white"
              onClick={() => notifyLoan('Loan Request', 'New loan request from Jane')}
            >
              Loan
            </Button>
            <Button 
              size="sm" 
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={() => notifySavings('Savings Deposit', 'KES 500 deposited')}
            >
              Savings
            </Button>
            <Button 
              size="sm" 
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => notifyAnnouncement('New Announcement', 'Important update for all members')}
            >
              Announcement
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
