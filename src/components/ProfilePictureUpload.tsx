import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useToast } from "@/hooks/use-toast";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";
import { Camera, Upload, User, X } from "lucide-react";
import { useRef, useState } from "react";

interface Member {
  _id?: string;
  name: string;
  profile_picture?: string;
  [key: string]: unknown;
}

interface ProfilePictureUploadProps {
  userData: Member;
  onUpdate?: (profilePicture: string) => void;
}

export default function ProfilePictureUpload({ userData, onUpdate }: ProfilePictureUploadProps) {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 2MB",
        variant: "destructive",
      });
      return;
    }

    // Read file and convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
      setShowUploadDialog(true);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedImage) return;

    setIsUploading(true);
    try {
      const res = await fetch(`${API_BASE}/api/members/upload-profile-picture`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify({
          profile_picture: selectedImage,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to upload profile picture");
      }

      toast({
        title: "Success!",
        description: "Profile picture updated successfully",
      });

      // Update parent component
      if (onUpdate) {
        onUpdate(data.profile_picture);
      }

      // Update userData in localStorage
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        const user = JSON.parse(storedUser);
        user.profile_picture = data.profile_picture;
        localStorage.setItem("user", JSON.stringify(user));
        
        // Update userData prop directly
        userData.profile_picture = data.profile_picture;
      }

      setShowUploadDialog(false);
      setSelectedImage(null);

      // Trigger a soft refresh by reloading after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Could not upload profile picture",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePicture = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/members/upload-profile-picture`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify({
          profile_picture: "",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to remove profile picture");
      }

      toast({
        title: "Success!",
        description: "Profile picture removed successfully",
      });

      // Update parent component
      if (onUpdate) {
        onUpdate("");
      }

      // Update userData in localStorage
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        const user = JSON.parse(storedUser);
        user.profile_picture = "";
        localStorage.setItem("user", JSON.stringify(user));
        
        // Update userData prop directly
        userData.profile_picture = "";
      }

      // Trigger a soft refresh
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      toast({
        title: "Failed",
        description: error instanceof Error ? error.message : "Could not remove profile picture",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile Picture
          </CardTitle>
          <CardDescription>Upload your profile picture</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="w-24 h-24">
              <AvatarImage src={userData?.profile_picture} alt={userData?.name} />
              <AvatarFallback className="text-2xl">
                {getInitials(userData?.name || "Member")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                aria-label="Upload profile picture"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-full"
              >
                <Camera className="w-4 h-4 mr-2" />
                {userData?.profile_picture ? "Change Photo" : "Upload Photo"}
              </Button>
              {userData?.profile_picture && (
                <Button
                  onClick={handleRemovePicture}
                  variant="outline"
                  className="w-full text-red-600 hover:text-red-700"
                >
                  <X className="w-4 h-4 mr-2" />
                  Remove Photo
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                JPG, PNG or GIF. Max size 2MB
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Preview Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Profile Picture</DialogTitle>
            <DialogDescription>
              Preview your profile picture before uploading
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center">
              <Avatar className="w-40 h-40">
                <AvatarImage src={selectedImage || undefined} alt="Preview" />
                <AvatarFallback>
                  <User className="w-20 h-20" />
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowUploadDialog(false);
                  setSelectedImage(null);
                }}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleUpload}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>Uploading...</>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
