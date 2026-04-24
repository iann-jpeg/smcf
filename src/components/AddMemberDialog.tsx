import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";
import { IdCard, Phone, User, UserPlus, Wallet, Users } from "lucide-react";
import { useState } from "react";

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMemberAdded: (member: any) => void;
}

const AddMemberDialog = ({
  open,
  onOpenChange,
  onMemberAdded,
}: AddMemberDialogProps) => {
  const [memberData, setMemberData] = useState({
    name: "",
    phone: "",
    idNumber: "",
    password: "",
    initialContribution: "200",
    memberType: "regular" as "regular" | "wallet_only",
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleAddMember = async () => {
    if (
      !memberData.name ||
      !memberData.phone ||
      !memberData.idNumber ||
      !memberData.password
    ) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields including password",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const payload = {
        name: memberData.name,
        phone: memberData.phone,
        id_number: memberData.idNumber,
        password: memberData.password,
        monthly_contribution: memberData.memberType === "wallet_only" ? 0 : Number(memberData.initialContribution || 0),
        member_type: memberData.memberType,
        status: "pending",
        amount: 0,
        join_date: new Date().toISOString(),
      };

      console.log("📤 Sending member data:", payload);
      
      const res = await fetch(`${API_BASE}/api/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });
      
      const responseData = await res.json();
      console.log("📥 Server response:", responseData);
      
      if (!res.ok) {
        throw new Error(responseData.error || "Failed to create member");
      }
      
      const created = responseData.data || responseData;

      // Notify parent and close
      onMemberAdded(created);
      setIsProcessing(false);
      toast({
        title: "Member Added Successfully",
        description: `${created.name} has been added to the group`,
      });
      setMemberData({
        name: "",
        phone: "",
        idNumber: "",
        password: "",
        memberType: "regular",
        initialContribution: "200",
      });
      onOpenChange(false);
    } catch (err: any) {
      console.error("Add member failed", err);
      setIsProcessing(false);
      toast({
        title: "Add Failed",
        description: err.message || "Could not add member",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setMemberData({
      name: "",
      phone: "",
      idNumber: "",
      memberType: "regular",
      password: "",
      initialContribution: "200",
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetForm, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Add New Member
          </DialogTitle>
          <DialogDescription>
            Add a new member to the group
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
                  onChange={(e) =>
                    setMemberData((prev) => ({ ...prev, name: e.target.value }))
                  }
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
                  onChange={(e) =>
                    setMemberData((prev) => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
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
                  onChange={(e) =>
                    setMemberData((prev) => ({
                      ...prev,
                      idNumber: e.target.value,
                    }))
                  }
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="member-password">Password *</Label>
              <Input
                id="member-password"
                type="password"
                placeholder="Set initial password"
                value={memberData.password}
                onChange={(e) =>
                  setMemberData((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-3">
              <Label>Membership Type *</Label>
              <RadioGroup
                value={memberData.memberType}
                onValueChange={(value: "regular" | "wallet_only") =>
                  setMemberData((prev) => ({ ...prev, memberType: value }))
                }
                className="space-y-3"
              >
                <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 cursor-pointer hover:bg-accent transition-colors">
                  <RadioGroupItem value="regular" id="regular" />
                  <div className="flex-1">
                    <Label htmlFor="regular" className="cursor-pointer flex items-center gap-2 font-semibold">
                      <Users className="w-4 h-4" />
                      Regular Member
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Participates in cycles, makes monthly contributions, and receives disbursements
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 cursor-pointer hover:bg-accent transition-colors">
                  <RadioGroupItem value="wallet_only" id="wallet_only" />
                  <div className="flex-1">
                    <Label htmlFor="wallet_only" className="cursor-pointer flex items-center gap-2 font-semibold">
                      <Wallet className="w-4 h-4" />
                      Wallet Only
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Access to savings wallet and transactions only, no cycle participation
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {memberData.memberType === "regular" && (
              <div className="space-y-2">
                <Label htmlFor="initial-contribution">
                  Monthly Contribution (KES)
                </Label>
                <Input
                  id="initial-contribution"
                  type="number"
                  value={memberData.initialContribution}
                  onChange={(e) =>
                    setMemberData((prev) => ({
                      ...prev,
                      initialContribution: e.target.value,
                    }))
                  }
                  className="text-center font-semibold"
                />
              </div>
            )}

            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="text-sm text-muted-foreground space-y-1">
                {memberData.memberType === "regular" ? (
                  <>
                    <p>• Member will be added to the current cycle</p>
                    <p>• They will be notified via SMS</p>
                    <p>• Member ID will be auto-generated</p>
                    <p>• Payment status will be set to pending</p>
                  </>
                ) : (
                  <>
                    <p>• Member can use savings wallet features</p>
                    <p>• No cycle contribution required</p>
                    <p>• No disbursement participation</p>
                    <p>• Can deposit and withdraw from wallet</p>
                  </>
                )}
              </div>
            </div>

            <Button
              onClick={handleAddMember}
              className="w-full"
              variant="financial"
              size="lg"
              disabled={isProcessing}>
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
