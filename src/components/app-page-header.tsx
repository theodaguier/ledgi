import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface AppPageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function AppPageHeader({
  title,
  description,
  actions,
  className,
}: AppPageHeaderProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10",
        "bg-background/80 backdrop-blur-md",
        "-mx-6 px-6 border-b border-border",
        "h-[73px] flex items-center justify-between gap-4",
        className,
      )}
    >
      <div>
        <h1 className="text-xl">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
