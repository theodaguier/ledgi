import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface AppPageShellProps {
  children: ReactNode;
  className?: string;
}

export function AppPageShell({ children, className }: AppPageShellProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>{children}</div>
  );
}
