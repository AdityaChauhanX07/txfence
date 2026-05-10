import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "bg-bg-card border border-border-primary rounded-xl overflow-hidden",
        "transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:border-accent/30",
        className
      )}
    >
      {children}
    </div>
  );
}
