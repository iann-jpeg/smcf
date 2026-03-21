import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Circle, Users } from "lucide-react";
import { useEffect, useState } from "react";

interface OnlineUser {
  userId: string;
  username: string;
  role: string;
  timestamp: number;
}

interface OnlineMembersCardProps {
  currentUser?: any;
}

const OnlineMembersCard = ({ currentUser }: OnlineMembersCardProps) => {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    // Use the existing global socket instead of creating a new one
    const socket = (window as any).socket;

    if (!socket) {
      if (import.meta.env.DEV) {
        console.warn("Socket not available for OnlineMembersCard");
      }
      return;
    }

    if (import.meta.env.DEV) {
      console.log("OnlineMembersCard: Setting up socket listeners");
      console.log("Socket connected:", socket.connected);
      console.log("Socket ID:", socket.id);
    }

    // Listen for online users updates
    socket.on("users:online", (users: OnlineUser[]) => {
      if (import.meta.env.DEV) {
        console.log("OnlineMembersCard received users:online event:", users);
      }
      setOnlineUsers(users);
    });

    // Request current online users on mount
    if (socket.connected) {
      if (import.meta.env.DEV) {
        console.log("Requesting current online users list");
      }
      socket.emit("request:online-users");
    }

    // Cleanup on unmount
    return () => {
      if (socket) {
        if (import.meta.env.DEV) {
          console.log("OnlineMembersCard: Cleaning up socket listeners");
        }
        socket.off("users:online");
      }
    };
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getTimeSince = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const onlineMembers = onlineUsers.filter((user) => user.role !== "admin");
  const onlineAdmins = onlineUsers.filter((user) => user.role === "admin");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Online Members
          <Badge variant="secondary" className="ml-auto">
            {onlineUsers.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Members currently active in the system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {onlineUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No members online</p>
            </div>
          ) : (
            <div className="space-y-4">
              {onlineAdmins.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
                    Admins ({onlineAdmins.length})
                  </h4>
                  <div className="space-y-2">
                    {onlineAdmins.map((user) => (
                      <div
                        key={user.userId}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors">
                        <div className="relative">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {getInitials(user.username)}
                            </AvatarFallback>
                          </Avatar>
                          <Circle className="absolute -bottom-1 -right-1 h-4 w-4 fill-green-500 text-green-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {user.username}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {getTimeSince(user.timestamp)}
                          </p>
                        </div>
                        <Badge variant="default" className="shrink-0">
                          Admin
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {onlineMembers.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
                    Members ({onlineMembers.length})
                  </h4>
                  <div className="space-y-2">
                    {onlineMembers.map((user) => (
                      <div
                        key={user.userId}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors">
                        <div className="relative">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-secondary text-secondary-foreground">
                              {getInitials(user.username)}
                            </AvatarFallback>
                          </Avatar>
                          <Circle className="absolute -bottom-1 -right-1 h-4 w-4 fill-green-500 text-green-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {user.username}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {getTimeSince(user.timestamp)}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          Member
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default OnlineMembersCard;
