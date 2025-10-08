import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Phone, IdCard, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMemberAdded: (member: any) => void;
}

const AddMemberDialog = ({ open, onOpenChange, onMemberAdded }: AddMemberDialogProps) => {
  const [memberData, setMemberData] = useState({
    name: '',
    phone: '',
    idNumber: '',
    initialContribution: '200'
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleAddMember = async () => {
    if (!memberData.name || !memberData.phone || !memberData.idNumber) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      const payload = {
        name: memberData.name,
        phone: memberData.phone,
        id_number: memberData.idNumber,
        monthly_contribution: Number(memberData.initialContribution || 0),
        status: 'pending',
        amount: 0,
        join_date: new Date().toISOString()
      };

      const res = await fetch(`${API_BASE}/members`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to create member');
      const created = await res.json();

      // Notify parent and close
      onMemberAdded(created);
      setIsProcessing(false);
      toast({ title: 'Member Added Successfully', description: `${created.name} has been added to the group` });
      setMemberData({ name: '', phone: '', idNumber: '', initialContribution: '200' });
      onOpenChange(false);
    } catch (err) {
      console.error('Add member failed', err);
      setIsProcessing(false);
      toast({ title: 'Add Failed', description: 'Could not add member', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setMemberData({
      name: '',
      phone: '',
      idNumber: '',
      initialContribution: '200'
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetForm, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Add New Member
          </DialogTitle>
          <DialogDescription>
            Add a new member to the SMCF group
          </DialogDescription>
        </DialogHeader>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Member Information</CardTitle>
            <CardDescription>
              Enter the details for the new member
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="member-name">Full Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="member-name"
                  placeholder="e.g., John Kamau"
                  value={memberData.name}
                  onChange={(e) => setMemberData(prev => ({ ...prev, name: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="member-phone">Phone Number *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="member-phone"
                  placeholder="e.g., 0722123456"
                  value={memberData.phone}
                  onChange={(e) => setMemberData(prev => ({ ...prev, phone: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="member-id">ID Number *</Label>
              <div className="relative">
                <IdCard className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="member-id"
                  placeholder="e.g., 12345678"
                  value={memberData.idNumber}
                  onChange={(e) => setMemberData(prev => ({ ...prev, idNumber: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="initial-contribution">Monthly Contribution (KES)</Label>
              <Input
                id="initial-contribution"
                type="number"
                value={memberData.initialContribution}
                onChange={(e) => setMemberData(prev => ({ ...prev, initialContribution: e.target.value }))}
                className="text-center font-semibold"
              />
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Member will be added to the current cycle</p>
                <p>• They will be notified via SMS</p>
                <p>• Member ID will be auto-generated</p>
                <p>• Payment status will be set to pending</p>
              </div>
            </div>

            <Button 
              onClick={handleAddMember} 
              className="w-full" 
              variant="financial"
              size="lg"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                  Adding Member...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Member to Group
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

export default AddMemberDialog;