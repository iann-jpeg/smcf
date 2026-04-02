import { cn } from "@/lib/utils";

interface StyledSMCFProps {
  className?: string;
}

export const StyledSMCF = ({ className }: StyledSMCFProps) => {
  return (
    <span className={cn("font-bold", className)}>
      <span style={{ color: "#D4AF37" }}>SM</span>
      <span style={{ color: "#22C55E" }}>CF</span>
    </span>
  );
};
