import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

function prettifyPath(path?: string): string {
  if (!path || path === "/") return "Dashboard";
  const clean = path.replace(/^\//, "").replace(/[-_]/g, " ").replace(/\//g, " > ");
  return clean
    .split(" ")
    .map((word) => (word ? `${word[0].toUpperCase()}${word.slice(1)}` : word))
    .join(" ");
}

export default function Forbidden() {
  const navigate = useNavigate();
  const location = useLocation();
  const deniedPath = (location.state as { from?: string } | null)?.from;
  const sectionName = prettifyPath(deniedPath);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <Card className="max-w-lg w-full border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ShieldAlert className="h-6 w-6 text-destructive" />
            Access Denied
          </CardTitle>
          <CardDescription>
            Your role does not have permission to view this section.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            Attempted section: <span className="font-semibold">{sectionName}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            If you believe this is a mistake, contact an administrator to update your role permissions.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/")}>Go to Dashboard</Button>
            <Button variant="outline" onClick={() => navigate("/notifications")}>View Notifications</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
