import { Skeleton } from "@/components/ui/skeleton";

export function LoadingSkeleton({ rows = 3, className = "h-24" }: { rows?: number; className?: string }) {
  return <div className="space-y-3" aria-label="Loading"><Skeleton className="h-8 w-48" />{Array.from({ length: rows }).map((_, index) => <Skeleton key={index} className={className} />)}</div>;
}
