import { ArrowRight, CheckCircle2, CircleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

type NextActionCardProps = {
  title?: string;
  description: string;
  actionLabel: string;
  onAction?: () => void;
  href?: string;
  complete?: boolean;
};

export function NextActionCard({ title = "Next best action", description, actionLabel, onAction, href, complete = false }: NextActionCardProps) {
  return (
    <Card className={complete ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/10" : "border-primary/20 bg-primary/5"}>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base font-heading">{complete ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <CircleAlert className="h-4 w-4 text-primary" />}{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        {!complete && <Button size="sm" onClick={onAction} asChild={Boolean(href)}>{href ? <Link to={href}>{actionLabel}<ArrowRight className="ml-2 h-3.5 w-3.5" /></Link> : <>{actionLabel}<ArrowRight className="ml-2 h-3.5 w-3.5" /></>}</Button>}
      </CardContent>
    </Card>
  );
}
