import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TopSaverBadgeProps {
  isTopSaver?: boolean;
  currentBalance?: number;
  className?: string;
}

const TopSaverBadge = ({ isTopSaver, currentBalance, className = "" }: TopSaverBadgeProps) => {
  if (!isTopSaver) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="default" 
            className={`bg-gradient-to-r from-yellow-400 to-yellow-600 text-white hover:from-yellow-500 hover:to-yellow-700 ${className}`}>
            <Star className="w-3 h-3 mr-1 fill-white" />
            Top Saver
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Highest total deposits: KES {currentBalance?.toLocaleString() || 0}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default TopSaverBadge;
