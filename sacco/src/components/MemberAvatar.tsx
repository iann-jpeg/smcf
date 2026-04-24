import { cn } from "@/lib/utils";

interface MemberAvatarProps {
  name: string;
  photo?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-20 w-20 text-xl",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function MemberAvatar({ name, photo, size = "md", className }: MemberAvatarProps) {
  const cls = cn("rounded-full flex-shrink-0", SIZE_CLASSES[size], className);

  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        className={cn(cls, "object-cover")}
      />
    );
  }

  return (
    <div className={cn(cls, "bg-primary/10 text-primary font-semibold flex items-center justify-center select-none")}>
      {getInitials(name)}
    </div>
  );
}
