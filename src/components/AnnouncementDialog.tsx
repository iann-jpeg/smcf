import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AnnouncementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AnnouncementDialog = ({ open, onOpenChange }: AnnouncementDialogProps) => {
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSendAnnouncement = async () => {
    if (!message.trim()) {
      toast({
        title: "Error",
        description: "Please enter an announcement message",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    // Simulate sending announcement
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: "Announcement Sent",
      description: `Your ${priority} priority announcement has been sent to all 12 members`,
    });
    
    setMessage('');
    setPriority('medium');
    setIsLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            Send Announcement to All Members
          </DialogTitle>
          <DialogDescription>
            Send important updates, reminders, or information to all SMCF members
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="priority">Priority Level</Label>
            <Select value={priority} onValueChange={(value: 'low' | 'medium' | 'high') => setPriority(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">🟢 Low Priority - General Info</SelectItem>
                <SelectItem value="medium">🟡 Medium Priority - Important Update</SelectItem>
                <SelectItem value="high">🔴 High Priority - Urgent Notice</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Announcement Message</Label>
            <Textarea
              id="message"
              placeholder="Enter your announcement message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="resize-none"
            />
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2 text-sm">Recipients</h4>
            <p className="text-sm text-muted-foreground">
              This announcement will be sent to all <strong>12 active members</strong> via:
            </p>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1">
              <li>• In-app notification on their dashboard</li>
              <li>• SMS notification to their registered M-Pesa numbers</li>
              <li>• Email notification (if available)</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSendAnnouncement}
            disabled={isLoading || !message.trim()}
          >
            {isLoading ? (
              <>Sending...</>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Announcement
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AnnouncementDialog;